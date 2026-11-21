// Gold economy + boosters (GDD §9.3, §10). Pure logic over a plain save object so it is
// unit-testable headless; the SaveStore hands in its data and persists on commit().
//
// Rules:
// - One currency (gold). Balance is an integer, never negative, capped at GOLD_CAP.
// - Every change goes through earn()/spend()/addBooster()/consumeBooster(); invalid amounts
//   (NaN, negative, fractions, Infinity) are refused, a spend larger than the balance is refused
//   without changing anything.
import { Emitter } from '../core/events';

export type BoosterId = 'shuffle' | 'scoop' | 'sieve';
export const BOOSTER_IDS: readonly BoosterId[] = ['shuffle', 'scoop', 'sieve'];

export interface BoosterDef {
  id: BoosterId;
  /** Gold price of one booster (GDD §10.1). */
  price: number;
  /** Level from which the booster exists (hidden before) and where it is gifted. */
  unlockLevel: number;
  /** Free boosters granted when it unlocks. */
  gift: number;
  /** UI flow: instant, pick a column (+ confirm), pick a grain. */
  target: 'none' | 'column' | 'grain';
}

export const BOOSTERS: Record<BoosterId, BoosterDef> = {
  shuffle: { id: 'shuffle', price: 100, unlockLevel: 4, gift: 2, target: 'none' },
  scoop: { id: 'scoop', price: 150, unlockLevel: 7, gift: 2, target: 'column' },
  sieve: { id: 'sieve', price: 250, unlockLevel: 12, gift: 2, target: 'grain' },
};

/** Starting balance (GDD §10.2). */
export const START_GOLD = 200;
/** Hard cap so a corrupt save / bug can never overflow the UI. */
export const GOLD_CAP = 999_999_999;
/** Each booster at most this many times per level attempt (GDD §10.1). */
export const MAX_BOOSTER_USES_PER_LEVEL = 3;
/** Scoop strip width in grains (1 block, GDD §10.1). */
export const SCOOP_WIDTH = 4;

/** Gold for the first win by stars (index = stars, GDD §9.3). */
export const FIRST_WIN_GOLD = [0, 20, 30, 40] as const;
/** Winning an already won level without improving the stars. */
export const REPLAY_WIN_GOLD = 5;
/** Region chest on the first win of every REGION_SIZE-th level. */
export const REGION_SIZE = 10;
export const CHEST_GOLD = 150;
export const CHEST_BOOSTERS: Partial<Record<BoosterId, number>> = { scoop: 1, sieve: 1 };
/** Endless: floor(score / ENDLESS_GOLD_STEP) gold, at most ENDLESS_GOLD_MAX per run (GDD §6). */
export const ENDLESS_GOLD_STEP = 500;
export const ENDLESS_GOLD_MAX = 30;

/** Continue (+5 pieces) on the lose screen (GDD §10.1 / §11.1). */
export const CONTINUE_PIECES = 5;
/** Lost with "no space": the top 20 grain rows (5 blocks) are emptied too. */
export const CONTINUE_CLEAR_ROWS = 20;
/** Gold price of the 1st / 2nd continue in one attempt; no 3rd. */
export const CONTINUE_PRICES = [300, 600] as const;
/** Levels 1..FREE_CONTINUE_MAX_LEVEL: the first continue is free (no ad, no gold). */
export const FREE_CONTINUE_MAX_LEVEL = 5;

/** Rewarded "free gold" in the shop (GDD §11.1). */
export const FREE_GOLD_AD = 30;

/** Something given to the player (level reward, daily reward, chest…). */
export interface Reward {
  gold: number;
  boosters: Partial<Record<BoosterId, number>>;
}

export const emptyReward = (): Reward => ({ gold: 0, boosters: {} });

export interface EconomyData {
  gold: number;
  boosters: Record<BoosterId, number>;
  /** Boosters whose unlock gift was already granted. */
  gifts: BoosterId[];
  /** Region chests opened (level ids). */
  chests: number[];
  /** "Remove ads" owned (GDD §11.3). */
  noAds: boolean;
  /** Non-consumable product ids owned (restore purchases). */
  owned: string[];
  /** Lifetime gold earned / spent (stats, analytics later). */
  earned: number;
  spent: number;
}

export function defaultEconomy(): EconomyData {
  return { gold: START_GOLD, boosters: { shuffle: 0, scoop: 0, sieve: 0 }, gifts: [], chests: [], noAds: false, owned: [], earned: 0, spent: 0 };
}

const nonNegInt = (v: unknown, fallback = 0): number => {
  const n = Math.floor(Number(v));
  return Number.isFinite(n) && n >= 0 ? Math.min(n, GOLD_CAP) : fallback;
};

export function sanitizeEconomy(raw: unknown): EconomyData {
  const d = defaultEconomy();
  if (!raw || typeof raw !== 'object') return d;
  const r = raw as Partial<EconomyData>;
  if (r.gold !== undefined) d.gold = nonNegInt(r.gold, START_GOLD);
  if (r.boosters && typeof r.boosters === 'object') for (const id of BOOSTER_IDS) d.boosters[id] = nonNegInt(r.boosters[id]);
  if (Array.isArray(r.gifts)) d.gifts = r.gifts.filter((g): g is BoosterId => BOOSTER_IDS.includes(g as BoosterId));
  if (Array.isArray(r.chests)) d.chests = r.chests.map(Number).filter((n) => Number.isInteger(n) && n > 0);
  d.noAds = r.noAds === true;
  if (Array.isArray(r.owned)) d.owned = r.owned.filter((x): x is string => typeof x === 'string');
  d.earned = nonNegInt(r.earned);
  d.spent = nonNegInt(r.spent);
  return d;
}

// --- pure reward rules -------------------------------------------------------

export function isRegionEnd(levelId: number): boolean {
  return levelId > 0 && levelId % REGION_SIZE === 0;
}

function starGold(stars: number): number {
  return FIRST_WIN_GOLD[Math.max(0, Math.min(3, Math.floor(stars)))];
}

export interface PrevProgress {
  completed: boolean;
  stars: number;
}

export interface LevelReward extends Reward {
  /** Gold from the level itself (doubled by the "2×" rewarded ad); excludes the chest. */
  levelGold: number;
  firstWin: boolean;
  /** Region chest opened by this win. */
  chest: boolean;
}

/**
 * Gold for a won level (GDD §9.3): first win 20/30/40 by stars; a replay that improves the
 * stars pays the difference; any other replay win pays 5. Region end levels (10, 20, 30…)
 * add a chest on the first win (150 gold + 1 Kepçe + 1 Elek) unless it was already opened.
 */
export function levelWinReward(levelId: number, stars: number, prev: PrevProgress | undefined, chestOpened = false): LevelReward {
  const firstWin = !prev?.completed;
  let levelGold: number;
  if (firstWin) levelGold = starGold(stars);
  else if (stars > prev.stars) levelGold = starGold(stars) - starGold(prev.stars);
  else levelGold = REPLAY_WIN_GOLD;
  const chest = firstWin && isRegionEnd(levelId) && !chestOpened;
  return {
    levelGold,
    gold: levelGold + (chest ? CHEST_GOLD : 0),
    boosters: chest ? { ...CHEST_BOOSTERS } : {},
    firstWin,
    chest,
  };
}

/** Endless run reward: floor(score / 500), at most 30. */
export function endlessGold(score: number): number {
  if (!Number.isFinite(score) || score <= 0) return 0;
  return Math.min(ENDLESS_GOLD_MAX, Math.floor(score / ENDLESS_GOLD_STEP));
}

export interface ContinueOffer {
  /** Index of this continue in the attempt (0 = first). */
  index: number;
  /** Free continue (first one in levels 1..5). */
  free: boolean;
  /** A rewarded ad may pay for it (first continue only, ad caps permitting). */
  ad: boolean;
  /** Gold price (0 when free). */
  price: number;
}

/** What the lose screen may offer after `used` continues this attempt; null = no more. */
export function continueOffer(used: number, levelId: number): ContinueOffer | null {
  if (used >= CONTINUE_PRICES.length) return null;
  if (used === 0 && levelId <= FREE_CONTINUE_MAX_LEVEL) return { index: 0, free: true, ad: false, price: 0 };
  return { index: used, free: false, ad: used === 0, price: CONTINUE_PRICES[used] };
}

/**
 * Whether a booster exists at this point: in level N when N ≥ its unlock level, and anywhere
 * (endless) once the player's progress (current level) reached it.
 */
export function boosterUnlocked(id: BoosterId, levelOrProgress: number): boolean {
  return levelOrProgress >= BOOSTERS[id].unlockLevel;
}

// --- stateful wallet ----------------------------------------------------------

export type EconomyEvent =
  | { type: 'gold'; delta: number; balance: number; reason: string }
  | { type: 'booster'; id: BoosterId; delta: number; count: number; reason: string }
  | { type: 'noAds' };

export class Economy {
  readonly events = new Emitter<EconomyEvent>();

  /**
   * @param data   returns the live save object (looked up on every call so a save reset is safe)
   * @param commit persists after a change
   */
  constructor(
    private readonly data: () => EconomyData,
    private readonly commit: () => void = () => {},
  ) {}

  get gold(): number {
    return this.data().gold;
  }

  get noAds(): boolean {
    return this.data().noAds;
  }

  count(id: BoosterId): number {
    return this.data().boosters[id] ?? 0;
  }

  canAfford(amount: number): boolean {
    return Number.isFinite(amount) && amount >= 0 && this.gold >= amount;
  }

  /** Add gold. Refuses non-positive / non-integer / non-finite amounts. @returns gold added */
  earn(amount: number, reason: string): number {
    if (!Number.isInteger(amount) || amount <= 0) return 0;
    const d = this.data();
    const add = Math.min(amount, GOLD_CAP - d.gold);
    if (add <= 0) return 0;
    d.gold += add;
    d.earned = Math.min(GOLD_CAP, d.earned + add);
    this.commit();
    this.events.emit({ type: 'gold', delta: add, balance: d.gold, reason });
    return add;
  }

  /** Take gold. All or nothing: refused (false, balance unchanged) if it would go negative. */
  spend(amount: number, reason: string): boolean {
    if (!Number.isInteger(amount) || amount <= 0) return false;
    const d = this.data();
    if (d.gold < amount) return false;
    d.gold -= amount;
    d.spent = Math.min(GOLD_CAP, d.spent + amount);
    this.commit();
    this.events.emit({ type: 'gold', delta: -amount, balance: d.gold, reason });
    return true;
  }

  addBooster(id: BoosterId, n: number, reason: string): number {
    if (!Number.isInteger(n) || n <= 0 || !BOOSTERS[id]) return 0;
    const d = this.data();
    d.boosters[id] = Math.min(GOLD_CAP, (d.boosters[id] ?? 0) + n);
    this.commit();
    this.events.emit({ type: 'booster', id, delta: n, count: d.boosters[id], reason });
    return n;
  }

  /** Use one booster from the inventory. @returns false when there is none. */
  consumeBooster(id: BoosterId, reason = 'use'): boolean {
    const d = this.data();
    if ((d.boosters[id] ?? 0) <= 0) return false;
    d.boosters[id]--;
    this.commit();
    this.events.emit({ type: 'booster', id, delta: -1, count: d.boosters[id], reason });
    return true;
  }

  /** Buy one booster for gold (atomic: no gold taken if unaffordable). */
  buyBooster(id: BoosterId): boolean {
    if (!this.spend(BOOSTERS[id].price, `buy_${id}`)) return false;
    this.addBooster(id, 1, 'buy');
    return true;
  }

  grant(r: Reward, reason: string): void {
    if (r.gold > 0) this.earn(r.gold, reason);
    for (const id of BOOSTER_IDS) {
      const n = r.boosters[id];
      if (n) this.addBooster(id, n, reason);
    }
  }

  /** Apply a won level's reward; marks the region chest as opened. */
  grantLevelWin(levelId: number, stars: number, prev: PrevProgress | undefined): LevelReward {
    const d = this.data();
    const r = levelWinReward(levelId, stars, prev, d.chests.includes(levelId));
    if (r.chest) d.chests.push(levelId);
    this.grant(r, r.chest ? 'level_chest' : 'level_win');
    return r;
  }

  /**
   * Gift boosters that unlocked at or before `progressLevel` and were never gifted
   * (GDD §10.2: 2 each in their unlock level). @returns gifted ids
   */
  grantUnlockGifts(progressLevel: number): BoosterId[] {
    const d = this.data();
    const out: BoosterId[] = [];
    for (const id of BOOSTER_IDS) {
      if (d.gifts.includes(id) || !boosterUnlocked(id, progressLevel)) continue;
      d.gifts.push(id);
      out.push(id);
      this.addBooster(id, BOOSTERS[id].gift, 'gift');
    }
    if (out.length === 0) return out;
    this.commit();
    return out;
  }

  owns(productId: string): boolean {
    return this.data().owned.includes(productId);
  }

  /**
   * Deliver a purchased product. Non-consumables are delivered once (a repeated delivery,
   * e.g. restore, only re-sets the entitlement). @returns gold granted
   */
  deliverProduct(p: { id: string; gold: number; noAds?: boolean; consumable: boolean }): number {
    const d = this.data();
    if (!p.consumable) {
      if (d.owned.includes(p.id)) {
        if (p.noAds && !d.noAds) this.setNoAds();
        return 0;
      }
      d.owned.push(p.id);
    }
    if (p.noAds) this.setNoAds();
    this.commit();
    return p.gold > 0 ? this.earn(p.gold, `iap_${p.id}`) : 0;
  }

  private setNoAds(): void {
    this.data().noAds = true;
    this.commit();
    this.events.emit({ type: 'noAds' });
  }
}
