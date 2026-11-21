// Meta layer glue: one object (App.meta) holding the economy, daily reward, ads and purchases,
// plus the level-end bookkeeping that ties them together. UI lives in ui/shop.ts,
// ui/boosterBar.ts, ui/continueOffer.ts, ui/dailyReward.ts, ui/rewardPanel.ts.
import { systemClock, type Clock } from '../core/clock';
import { AdPolicy, INTERSTITIAL_RULES, PolicyAdService, type AdProvider, type AdService, type InterstitialContext } from '../platform/ads';
import { productDef, type IapService, type ProductId } from '../platform/iap';
import type { SaveStore } from '../platform/storage';
import { DailyRewards, scaleReward, type DailyStatus } from './daily';
import { Economy, endlessGold, type LevelReward, type Reward } from './economy';
import type { Session } from './session';

/** What a finished attempt paid out (shown on the result card). */
export interface SessionEndInfo {
  endless: boolean;
  /** Won level reward (null for losses / endless). */
  reward: LevelReward | null;
  /** Endless run gold. */
  endlessGold: number;
  /** For the interstitial decision when the result card is left. */
  adContext: InterstitialContext;
  /** The "2×" rewarded ad was used. */
  doubled: boolean;
}

export interface PurchaseOutcome {
  ok: boolean;
  cancelled?: boolean;
  gold: number;
}

export class Meta {
  readonly economy: Economy;
  readonly daily: DailyRewards;
  readonly ads: AdService;

  constructor(
    private readonly save: SaveStore,
    adProvider: AdProvider,
    readonly iap: IapService,
    clock: Clock = systemClock,
  ) {
    const commit = () => save.commit();
    this.economy = new Economy(() => save.economy, commit);
    this.daily = new DailyRewards(() => save.daily, commit, clock);
    this.ads = new PolicyAdService(new AdPolicy(() => save.ads, commit, clock), adProvider, () => save.economy.noAds);
  }

  /**
   * Call on `won` / `lost` BEFORE SaveStore.recordResult (needs the previous progress).
   * Grants the level / endless gold.
   */
  onSessionEnd(session: Session): SessionEndInfo {
    const info: SessionEndInfo = {
      endless: session.endless,
      reward: null,
      endlessGold: 0,
      adContext: { trigger: 'level_exit', unlocked: false, lossStreak: 0 },
      doubled: false,
    };
    if (session.endless) {
      info.endlessGold = this.economy.earn(endlessGold(session.score), 'endless');
      return info;
    }
    const id = session.level.id;
    const prev = this.save.level(id);
    const won = session.state === 'won';
    if (won) info.reward = this.economy.grantLevelWin(id, session.stars, prev);
    info.adContext = {
      trigger: 'level_exit',
      unlocked: !!this.save.level(INTERSTITIAL_RULES.unlockLevel)?.completed,
      lossStreak: won ? 0 : (prev?.lossStreak ?? 0) + 1,
    };
    return info;
  }

  /** "2 katına çıkar" on the win card: rewarded ad → level gold again (first win only). */
  async doubleWin(info: SessionEndInfo): Promise<number> {
    const r = info.reward;
    if (!r || !r.firstWin || info.doubled || r.levelGold <= 0) return 0;
    if (!(await this.ads.showRewarded('double_win'))) return 0;
    info.doubled = true;
    return this.economy.earn(r.levelGold, 'double_win');
  }

  dailyStatus(): DailyStatus {
    return this.daily.status();
  }

  /** Claim today's daily reward (×2 after a watched ad). @returns the granted reward or null */
  async claimDaily(double: boolean): Promise<Reward | null> {
    if (!this.daily.status().available) return null;
    if (double && !(await this.ads.showRewarded('daily_double'))) return null;
    const r = this.daily.claim();
    if (!r) return null;
    const granted = double ? scaleReward(r, 2) : r;
    this.economy.grant(granted, double ? 'daily_x2' : 'daily');
    return granted;
  }

  /** Buy a product and deliver it. */
  async buy(id: ProductId): Promise<PurchaseOutcome> {
    const p = productDef(id);
    if (!p) return { ok: false, gold: 0 };
    const res = await this.iap.purchase(id);
    if (!res.ok) return { ok: false, cancelled: res.cancelled, gold: 0 };
    return { ok: true, gold: this.economy.deliverProduct(p) };
  }

  /** Restore non-consumables. @returns restored product ids */
  async restore(): Promise<ProductId[]> {
    const ids = await this.iap.restore().catch(() => [] as ProductId[]);
    for (const id of ids) {
      const p = productDef(id);
      if (p) this.economy.deliverProduct(p);
    }
    return ids;
  }
}
