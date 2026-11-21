// Daily reward + streak (GDD §12.1). 7-day cycle, claimed once per local calendar day.
//
// - Day boundary: device local time, 00:00. Days are counted as "local day numbers"
//   (days since 1970-01-01 in local time), so DST changes and time zones are handled by the
//   injected clock's UTC offset (testable without touching the process time zone).
// - Claimed yesterday → next box (day 7 wraps to day 1) and the streak grows.
// - Missed a day (or first ever) → back to day 1, streak = 1.
// - Clock set back (last claim in the "future"): treated like a new day 1; the GDD accepts
//   clock cheating in the MVP, this only prevents a stuck state.
import { localDay, systemClock, type Clock } from '../core/clock';
import type { Reward } from './economy';

export const DAILY_CYCLE = 7;

/** Rewards by cycle day (GDD §12.1). */
export const DAILY_REWARDS: readonly Reward[] = [
  { gold: 25, boosters: {} },
  { gold: 50, boosters: {} },
  { gold: 0, boosters: { shuffle: 1 } },
  { gold: 75, boosters: {} },
  { gold: 0, boosters: { scoop: 1 } },
  { gold: 100, boosters: {} },
  { gold: 150, boosters: { sieve: 1 } },
];

export interface DailyData {
  /** Local day number of the last claim (null = never). */
  lastDay: number | null;
  /** Cycle index (0..6) of the last claimed box. */
  index: number;
  /** Consecutive days claimed (shown with the brazier icon). */
  streak: number;
  /** Best streak ever. */
  best: number;
}

export function defaultDaily(): DailyData {
  return { lastDay: null, index: 0, streak: 0, best: 0 };
}

export function sanitizeDaily(raw: unknown): DailyData {
  const d = defaultDaily();
  if (!raw || typeof raw !== 'object') return d;
  const r = raw as Partial<DailyData>;
  if (typeof r.lastDay === 'number' && Number.isInteger(r.lastDay)) d.lastDay = r.lastDay;
  const idx = Number(r.index);
  if (Number.isInteger(idx) && idx >= 0 && idx < DAILY_CYCLE) d.index = idx;
  d.streak = Math.max(0, Math.floor(Number(r.streak) || 0));
  d.best = Math.max(d.streak, Math.floor(Number(r.best) || 0));
  return d;
}

export interface DailyStatus {
  /** Today's box can be claimed. */
  available: boolean;
  /** Cycle index of today's box (claimable or already claimed). */
  index: number;
  /** Streak after claiming today (or the current streak if already claimed). */
  streak: number;
  reward: Reward;
  /** The previous streak was broken (missed a day). */
  reset: boolean;
}

export class DailyRewards {
  constructor(
    private readonly data: () => DailyData,
    private readonly commit: () => void = () => {},
    private readonly clock: Clock = systemClock,
  ) {}

  today(): number {
    return localDay(this.clock.now(), this.clock);
  }

  status(): DailyStatus {
    const d = this.data();
    const today = this.today();
    if (d.lastDay === today) return { available: false, index: d.index, streak: d.streak, reward: DAILY_REWARDS[d.index], reset: false };
    const consecutive = d.lastDay !== null && today - d.lastDay === 1;
    const index = consecutive ? (d.index + 1) % DAILY_CYCLE : 0;
    const streak = consecutive ? d.streak + 1 : 1;
    return { available: true, index, streak, reward: DAILY_REWARDS[index], reset: d.lastDay !== null && !consecutive };
  }

  /**
   * Mark today's box as claimed. The caller grants the reward (×2 after a rewarded ad).
   * @returns the reward, or null if today was already claimed
   */
  claim(): Reward | null {
    const st = this.status();
    if (!st.available) return null;
    const d = this.data();
    d.lastDay = this.today();
    d.index = st.index;
    d.streak = st.streak;
    d.best = Math.max(d.best, d.streak);
    this.commit();
    return st.reward;
  }
}

/** Reward × k (daily "2 katı"). */
export function scaleReward(r: Reward, k: number): Reward {
  const boosters: Reward['boosters'] = {};
  for (const [id, n] of Object.entries(r.boosters)) if (n) boosters[id as keyof Reward['boosters']] = n * k;
  return { gold: r.gold * k, boosters };
}
