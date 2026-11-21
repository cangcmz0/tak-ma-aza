// Persistent save data. Backend is pluggable (KeyValueBackend): localStorage on the web,
// Capacitor Preferences on native (platform/preferencesBackend.ts, chosen in main.ts).
// Pattern: load once at boot, keep a synchronous in-memory view, write in the background
// (coalesced: many changes in one tick = one write; flush() on app pause).
import { defaultDaily, sanitizeDaily, type DailyData } from '../game/daily';
import { defaultEconomy, sanitizeEconomy, type EconomyData } from '../game/economy';
import { defaultAds, sanitizeAds, type AdData } from './ads';

export interface KeyValueBackend {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
  remove(key: string): Promise<void>;
}

export class LocalStorageBackend implements KeyValueBackend {
  async get(key: string): Promise<string | null> {
    try {
      return globalThis.localStorage?.getItem(key) ?? null;
    } catch {
      return null;
    }
  }
  async set(key: string, value: string): Promise<void> {
    try {
      globalThis.localStorage?.setItem(key, value);
    } catch {
      /* storage full / blocked: ignore */
    }
  }
  async remove(key: string): Promise<void> {
    try {
      globalThis.localStorage?.removeItem(key);
    } catch {
      /* ignore */
    }
  }
}

/** In-memory backend (tests, private mode fallback). */
export class MemoryBackend implements KeyValueBackend {
  private m = new Map<string, string>();
  async get(key: string) {
    return this.m.get(key) ?? null;
  }
  async set(key: string, value: string) {
    this.m.set(key, value);
  }
  async remove(key: string) {
    this.m.delete(key);
  }
}

export interface LevelProgress {
  stars: number;
  best: number;
  completed: boolean;
  /** Finished attempts (used as the attempt seed index). */
  attempts: number;
  /** Consecutive losses (for the GDD "help rule"). */
  lossStreak: number;
}

export interface Settings {
  sound: boolean;
  haptics: boolean;
  /** Master sound volume 0..1 (sound effects). */
  volume: number;
}

export interface SaveData {
  version: 1;
  levels: Record<string, LevelProgress>;
  settings: Settings;
  /** Endless mode high score and finished runs. */
  endlessBest: number;
  endlessGames: number;
  /** Mechanic intro cards already shown (GDD §13: shown once). */
  seenIntros: string[];
  /** Tutorials completed (t1..t3). */
  tutorialsDone: string[];
  /** Gold, boosters, chests, purchases (game/economy.ts). */
  economy: EconomyData;
  /** Daily reward / streak (game/daily.ts). */
  daily: DailyData;
  /** Ad frequency counters (platform/ads.ts). */
  ads: AdData;
}

const KEY = 'kumakisi.save.v1';

function defaults(): SaveData {
  return {
    version: 1,
    levels: {},
    settings: { sound: true, haptics: true, volume: 1 },
    endlessBest: 0,
    endlessGames: 0,
    seenIntros: [],
    tutorialsDone: [],
    economy: defaultEconomy(),
    daily: defaultDaily(),
    ads: defaultAds(),
  };
}

const strList = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []);

function sanitize(raw: unknown): SaveData {
  const d = defaults();
  if (!raw || typeof raw !== 'object') return d;
  const r = raw as Partial<SaveData>;
  if (r.levels && typeof r.levels === 'object') {
    for (const [id, p] of Object.entries(r.levels)) {
      if (p && typeof p === 'object')
        d.levels[id] = {
          stars: Number(p.stars) || 0,
          best: Number(p.best) || 0,
          completed: !!p.completed,
          attempts: Number(p.attempts) || 0,
          lossStreak: Number(p.lossStreak) || 0,
        };
    }
  }
  if (r.settings && typeof r.settings === 'object') {
    d.settings.sound = r.settings.sound !== false;
    d.settings.haptics = r.settings.haptics !== false;
    const vol = Number(r.settings.volume);
    if (r.settings.volume !== undefined && Number.isFinite(vol)) d.settings.volume = Math.max(0, Math.min(1, vol));
  }
  d.endlessBest = Math.max(0, Number(r.endlessBest) || 0);
  d.endlessGames = Math.max(0, Number(r.endlessGames) || 0);
  d.seenIntros = strList(r.seenIntros);
  d.tutorialsDone = strList(r.tutorialsDone);
  d.economy = sanitizeEconomy(r.economy);
  d.daily = sanitizeDaily(r.daily);
  d.ads = sanitizeAds(r.ads);
  return d;
}

/** Synchronous in-memory view of the save, persisted asynchronously. */
export class SaveStore {
  private data: SaveData;
  private dirty = false;
  private writing: Promise<void> | null = null;

  private constructor(
    private readonly backend: KeyValueBackend,
    data: SaveData,
  ) {
    this.data = data;
  }

  static async load(backend: KeyValueBackend = new LocalStorageBackend()): Promise<SaveStore> {
    let data = defaults();
    try {
      const s = await backend.get(KEY);
      if (s) data = sanitize(JSON.parse(s));
    } catch {
      data = defaults();
    }
    return new SaveStore(backend, data);
  }

  get settings(): Readonly<Settings> {
    return this.data.settings;
  }

  setSetting<K extends keyof Settings>(k: K, v: Settings[K]): void {
    this.data.settings[k] = v;
    this.persist();
  }

  level(id: number): LevelProgress | undefined {
    return this.data.levels[String(id)];
  }

  /** Record a finished attempt; keeps the best stars / score. */
  recordResult(id: number, won: boolean, score: number, stars: number): void {
    const prev = this.data.levels[String(id)] ?? { stars: 0, best: 0, completed: false, attempts: 0, lossStreak: 0 };
    this.data.levels[String(id)] = {
      stars: Math.max(prev.stars, stars),
      best: Math.max(prev.best, score),
      completed: prev.completed || won,
      attempts: prev.attempts + 1,
      lossStreak: won ? 0 : prev.lossStreak + 1,
    };
    this.persist();
  }

  /**
   * The last recorded loss of a level was resumed ("Devam et", economy): take the attempt
   * back so the continued run is still the same attempt for seeds / help rule / ads.
   */
  undoLastLoss(id: number): void {
    const p = this.data.levels[String(id)];
    if (!p || p.lossStreak <= 0) return;
    p.lossStreak--;
    p.attempts = Math.max(0, p.attempts - 1);
    this.persist();
  }

  /** A level is unlocked if it is the first one or the previous one is completed. */
  isUnlocked(id: number, orderedIds: readonly number[]): boolean {
    const i = orderedIds.indexOf(id);
    if (i <= 0) return i === 0;
    return !!this.level(orderedIds[i - 1])?.completed;
  }

  /** First unlocked-but-not-completed level (or the last level). */
  currentLevel(orderedIds: readonly number[]): number | undefined {
    for (const id of orderedIds) if (!this.level(id)?.completed) return id;
    return orderedIds[orderedIds.length - 1];
  }

  get endlessBest(): number {
    return this.data.endlessBest;
  }

  /** Record a finished endless run. @returns true if it is a new high score. */
  recordEndless(score: number): boolean {
    const best = score > this.data.endlessBest;
    if (best) this.data.endlessBest = score;
    this.data.endlessGames++;
    this.persist();
    return best;
  }

  hasSeenIntro(id: string): boolean {
    return this.data.seenIntros.includes(id);
  }

  markIntroSeen(id: string): void {
    if (this.hasSeenIntro(id)) return;
    this.data.seenIntros.push(id);
    this.persist();
  }

  isTutorialDone(id: string): boolean {
    return this.data.tutorialsDone.includes(id);
  }

  markTutorialDone(id: string): void {
    if (this.isTutorialDone(id)) return;
    this.data.tutorialsDone.push(id);
    this.persist();
  }

  /**
   * Live economy / daily / ad objects. Their modules mutate them and call commit().
   * Look them up on every use (reset() replaces them).
   */
  get economy(): EconomyData {
    return this.data.economy;
  }

  get daily(): DailyData {
    return this.data.daily;
  }

  get ads(): AdData {
    return this.data.ads;
  }

  /** Persist after an outside module changed one of the live objects above. */
  commit(): void {
    this.persist();
  }

  reset(): void {
    this.data = defaults();
    this.persist();
  }

  /** Schedule a background write (coalesced; writes never overlap and keep their order). */
  private persist(): void {
    this.dirty = true;
    if (!this.writing) this.writing = Promise.resolve().then(() => this.drain());
  }

  private async drain(): Promise<void> {
    try {
      while (this.dirty) {
        this.dirty = false;
        try {
          await this.backend.set(KEY, JSON.stringify(this.data));
        } catch {
          /* backend failure: keep playing from memory */
        }
      }
    } finally {
      this.writing = null;
    }
  }

  /** Wait until pending changes are written (call when the app goes to background). */
  async flush(): Promise<void> {
    if (this.dirty && !this.writing) this.persist();
    while (this.writing) await this.writing;
  }
}
