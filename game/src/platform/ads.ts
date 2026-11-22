// Ads (GDD §11.1 / §11.2). Two layers:
//
//   AdPolicy   — pure frequency logic (interstitial rules, rewarded daily caps). Persisted in
//                the save, clock injected, unit-tested (tests/ads.test.ts).
//   AdProvider — the SDK that actually shows an ad. Today: FakeAdProvider (a 1.5 s
//                "Reklam (deneme)" layer, ui/adOverlay.ts). Later: an AdMob provider
//                (@capacitor-community/admob) implementing the same 3 methods.
//
// The game only talks to AdService (PolicyAdService = policy + provider).
import { localDay, systemClock, type Clock } from '../core/clock';

export type RewardedPlacement = 'continue' | 'double_win' | 'free_gold' | 'booster' | 'daily_double';
export const REWARDED_PLACEMENTS: readonly RewardedPlacement[] = ['continue', 'double_win', 'free_gold', 'booster', 'daily_double'];

/**
 * Rewarded caps per local day (GDD §11.1). `continue` (1 per attempt) and `double_win`
 * (first win only) are limited by the game flow, not per day.
 */
export const REWARDED_DAILY_LIMITS: Record<RewardedPlacement, number> = {
  continue: Infinity,
  double_win: Infinity,
  free_gold: 3,
  booster: 3,
  daily_double: 1,
};
/** All rewarded ads together per day. */
export const REWARDED_DAILY_TOTAL = 12;

/** Interstitial rules (GDD §11.2). */
export const INTERSTITIAL_RULES = {
  /** Level that must already be won (first interstitial at the end of level 9 at the earliest). */
  unlockLevel: 8,
  /** Level ends (win or loss) since the previous interstitial. */
  minLevelEnds: 3,
  /** Since the last ad of any kind (interstitial or rewarded). */
  minGapMs: 90_000,
  /** Minimum app session length. */
  minSessionMs: 180_000,
  /** Skip when the player just lost this level this many times in a row. */
  frustrationLosses: 3,
  maxPerHour: 4,
  maxPerDay: 20,
} as const;

const HOUR_MS = 3_600_000;
const DAY_MS = 86_400_000;

export interface AdData {
  /** Level ends (win or loss) since the last interstitial. */
  levelEnds: number;
  /** Timestamp of the last ad shown (any kind); 0 = never. */
  lastAdAt: number;
  /** Interstitial timestamps within the last 24 h (hour/day caps). */
  interstitials: number[];
  /** Local day of the rewarded counters below. */
  rewardDay: number;
  rewarded: Partial<Record<RewardedPlacement, number>>;
  rewardedTotal: number;
}

export function defaultAds(): AdData {
  return { levelEnds: 0, lastAdAt: 0, interstitials: [], rewardDay: -1, rewarded: {}, rewardedTotal: 0 };
}

const nn = (v: unknown) => Math.max(0, Math.floor(Number(v) || 0));

export function sanitizeAds(raw: unknown): AdData {
  const d = defaultAds();
  if (!raw || typeof raw !== 'object') return d;
  const r = raw as Partial<AdData>;
  d.levelEnds = nn(r.levelEnds);
  d.lastAdAt = nn(r.lastAdAt);
  if (Array.isArray(r.interstitials)) d.interstitials = r.interstitials.map(Number).filter((t) => Number.isFinite(t) && t > 0).slice(-50);
  d.rewardDay = Number.isInteger(r.rewardDay) ? (r.rewardDay as number) : -1;
  if (r.rewarded && typeof r.rewarded === 'object')
    for (const p of REWARDED_PLACEMENTS) if (r.rewarded[p] !== undefined) d.rewarded[p] = nn(r.rewarded[p]);
  d.rewardedTotal = nn(r.rewardedTotal);
  return d;
}

/** What the game knows about the level end that led to a possible interstitial. */
export interface InterstitialContext {
  /** Where the transition goes: only result → map / next level may show one (GDD §11.2 #2). */
  trigger: 'level_exit' | 'retry' | 'menu' | 'gameplay';
  /** INTERSTITIAL_RULES.unlockLevel was already won before this level ended. */
  unlocked: boolean;
  /** Consecutive losses on the level that just ended (0 after a win). */
  lossStreak: number;
}

export type InterstitialReason =
  | 'ok'
  | 'no_ads'
  | 'trigger'
  | 'locked'
  | 'level_gap'
  | 'cooldown'
  | 'session'
  | 'frustration'
  | 'hourly_cap'
  | 'daily_cap'
  | 'busy';

export interface InterstitialDecision {
  show: boolean;
  reason: InterstitialReason;
}

export class AdPolicy {
  /**
   * @param sessionStart app start time (rule 5); defaults to the clock's now
   */
  constructor(
    private readonly data: () => AdData,
    private readonly commit: () => void = () => {},
    private readonly clock: Clock = systemClock,
    private readonly sessionStart = clock.now(),
  ) {}

  // --- interstitial ---

  /** Count a finished level attempt (win or loss) for rule 3. */
  noteLevelEnd(): void {
    this.data().levelEnds++;
    this.commit();
  }

  decideInterstitial(ctx: InterstitialContext, noAds: boolean): InterstitialDecision {
    const R = INTERSTITIAL_RULES;
    const d = this.data();
    const now = this.clock.now();
    const no = (reason: InterstitialReason): InterstitialDecision => ({ show: false, reason });
    if (noAds) return no('no_ads');
    if (ctx.trigger !== 'level_exit') return no('trigger');
    if (!ctx.unlocked) return no('locked');
    if (d.levelEnds < R.minLevelEnds) return no('level_gap');
    if (d.lastAdAt > 0 && now - d.lastAdAt < R.minGapMs) return no('cooldown');
    if (now - this.sessionStart < R.minSessionMs) return no('session');
    if (ctx.lossStreak >= R.frustrationLosses) return no('frustration');
    const recent = d.interstitials.filter((t) => t <= now && now - t < DAY_MS);
    if (recent.filter((t) => now - t < HOUR_MS).length >= R.maxPerHour) return no('hourly_cap');
    if (recent.length >= R.maxPerDay) return no('daily_cap');
    return { show: true, reason: 'ok' };
  }

  noteInterstitialShown(): void {
    const d = this.data();
    const now = this.clock.now();
    d.interstitials = d.interstitials.filter((t) => t <= now && now - t < DAY_MS);
    d.interstitials.push(now);
    d.levelEnds = 0;
    d.lastAdAt = now;
    this.commit();
  }

  // --- rewarded ---

  private rollDay(): AdData {
    const d = this.data();
    const today = localDay(this.clock.now(), this.clock);
    if (d.rewardDay !== today) {
      d.rewardDay = today;
      d.rewarded = {};
      d.rewardedTotal = 0;
    }
    return d;
  }

  /** Rewarded ads left today for a placement (Infinity = only the flow limits it). */
  rewardedLeft(p: RewardedPlacement): number {
    const d = this.rollDay();
    const total = REWARDED_DAILY_TOTAL - d.rewardedTotal;
    const own = REWARDED_DAILY_LIMITS[p] - (d.rewarded[p] ?? 0);
    return Math.max(0, Math.min(total, own));
  }

  /** A rewarded ad was watched to the end (also resets the interstitial 90 s timer, rule 4). */
  noteRewardedShown(p: RewardedPlacement): void {
    const d = this.rollDay();
    d.rewarded[p] = (d.rewarded[p] ?? 0) + 1;
    d.rewardedTotal++;
    d.lastAdAt = this.clock.now();
    this.commit();
  }
}

// --- providers -----------------------------------------------------------------

/** The ad SDK. Swap FakeAdProvider for an AdMob implementation on native. */
export interface AdProvider {
  readonly name: string;
  /** True for the development stand-in (UI shows "deneme" notes). */
  readonly fake: boolean;
  /** Load SDK / consent (UMP) / preload. Must never throw. */
  init(): Promise<void>;
  /** @returns true if the reward was earned (ad watched to the end). */
  showRewarded(placement: RewardedPlacement): Promise<boolean>;
  /** @returns true if an ad was displayed. */
  showInterstitial(): Promise<boolean>;
}

/** Shows a fake ad layer for `ms`; resolves true when it ran to the end. */
export type FakeAdPresenter = (kind: 'rewarded' | 'interstitial', ms: number) => Promise<boolean>;

export const FAKE_REWARDED_MS = 1500;
export const FAKE_INTERSTITIAL_MS = 1500;

export class FakeAdProvider implements AdProvider {
  readonly name = 'fake';
  readonly fake = true;
  constructor(private readonly present: FakeAdPresenter) {}
  async init(): Promise<void> {}
  showRewarded(): Promise<boolean> {
    return this.present('rewarded', FAKE_REWARDED_MS);
  }
  showInterstitial(): Promise<boolean> {
    return this.present('interstitial', FAKE_INTERSTITIAL_MS);
  }
}

// --- service -------------------------------------------------------------------

export interface AdService {
  readonly fake: boolean;
  /** Rewarded ads left today for this placement. */
  rewardedLeft(placement: RewardedPlacement): number;
  canShowRewarded(placement: RewardedPlacement): boolean;
  /** Show a rewarded ad. @returns true when the reward must be granted. */
  showRewarded(placement: RewardedPlacement): Promise<boolean>;
  /** A level attempt ended (win or loss). */
  noteLevelEnd(): void;
  /** Show an interstitial if every GDD rule allows it. @returns true if one was shown. */
  maybeShowInterstitial(ctx: InterstitialContext): Promise<boolean>;
  /** Last interstitial decision (debug / tests). */
  readonly lastDecision: InterstitialDecision | null;
}

export class PolicyAdService implements AdService {
  private busy = false;
  lastDecision: InterstitialDecision | null = null;

  constructor(
    readonly policy: AdPolicy,
    private readonly provider: AdProvider,
    private readonly noAds: () => boolean,
  ) {}

  get fake(): boolean {
    return this.provider.fake;
  }

  rewardedLeft(p: RewardedPlacement): number {
    return this.policy.rewardedLeft(p);
  }

  canShowRewarded(p: RewardedPlacement): boolean {
    return !this.busy && this.policy.rewardedLeft(p) > 0;
  }

  async showRewarded(p: RewardedPlacement): Promise<boolean> {
    if (!this.canShowRewarded(p)) return false;
    this.busy = true;
    try {
      const ok = await this.provider.showRewarded(p).catch(() => false);
      if (ok) this.policy.noteRewardedShown(p);
      return ok;
    } finally {
      this.busy = false;
    }
  }

  noteLevelEnd(): void {
    this.policy.noteLevelEnd();
  }

  async maybeShowInterstitial(ctx: InterstitialContext): Promise<boolean> {
    const dec: InterstitialDecision = this.busy ? { show: false, reason: 'busy' } : this.policy.decideInterstitial(ctx, this.noAds());
    this.lastDecision = dec;
    if (!dec.show) return false;
    this.busy = true;
    try {
      const shown = await this.provider.showInterstitial().catch(() => false);
      if (shown) this.policy.noteInterstitialShown();
      return shown;
    } finally {
      this.busy = false;
    }
  }
}
