// Persistent save data. Backend is pluggable: localStorage now, Capacitor
// Preferences later (implement KeyValueBackend and pass it to SaveStore.load).

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
}

const KEY = 'kumakisi.save.v1';

function defaults(): SaveData {
  return { version: 1, levels: {}, settings: { sound: true, haptics: true, volume: 1 } };
}

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
  return d;
}

/** Synchronous in-memory view of the save, persisted asynchronously. */
export class SaveStore {
  private data: SaveData;

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

  reset(): void {
    this.data = defaults();
    this.persist();
  }

  private persist(): void {
    void this.backend.set(KEY, JSON.stringify(this.data));
  }
}
