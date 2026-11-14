// Yerel kayıt. Erişilemezse oyun kayıtsız devam eder.
import { prevDayKey } from './daily';

export interface DailyRecord {
  score: number;
  stars: number;
  accuracy: number;
  grid: string;
  fired: boolean;
}

export interface SaveData {
  stars: Record<string, number>;
  best: Record<string, number>;
  sound: boolean;
  /** Günün Nöbeti: her günün ilk denemesi kayda geçer. */
  daily: Record<string, DailyRecord>;
  streak: { last: string; count: number; best: number };
}

const KEY = 'nobet.v1';
const fresh = (): SaveData => ({ stars: {}, best: {}, sound: true, daily: {}, streak: { last: '', count: 0, best: 0 } });

export function loadSave(): SaveData {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const d = { ...fresh(), ...JSON.parse(raw) } as SaveData;
      d.streak = { ...fresh().streak, ...d.streak };
      return d;
    }
  } catch {
    /* depolama kapalı */
  }
  return fresh();
}

export function writeSave(d: SaveData) {
  try {
    localStorage.setItem(KEY, JSON.stringify(d));
  } catch {
    /* depolama kapalı */
  }
}

/** Oynanabilir en yüksek gece: bir önceki en az 1 yıldızla bitmişse açılır. */
export function unlockedUpTo(d: SaveData): number {
  let n = 1;
  while ((d.stars[n] ?? 0) > 0) n++;
  return n;
}

export function totalStars(d: SaveData): number {
  return Object.values(d.stars).reduce((a, b) => a + b, 0);
}

export const RANKS: { min: number; title: string }[] = [
  { min: 0, title: 'Stajyer' },
  { min: 3, title: 'Asistan' },
  { min: 7, title: 'Uzman' },
  { min: 12, title: 'Doçent' },
  { min: 16, title: 'Profesör' },
];

export function rankOf(stars: number): { title: string; next: { min: number; title: string } | null } {
  let i = 0;
  while (i + 1 < RANKS.length && stars >= RANKS[i + 1].min) i++;
  return { title: RANKS[i].title, next: RANKS[i + 1] ?? null };
}

/** Günün ilk sonucunu kaydeder ve günlük seriyi ilerletir. İlk deneme değilse false döner. */
export function recordDaily(d: SaveData, key: string, rec: DailyRecord): boolean {
  if (d.daily[key]) return false;
  d.daily[key] = rec;
  if (d.streak.last !== key) {
    d.streak.count = d.streak.last === prevDayKey(key) ? d.streak.count + 1 : 1;
    d.streak.last = key;
    d.streak.best = Math.max(d.streak.best, d.streak.count);
  }
  return true;
}

/** Bugün oynanmadıysa ve dün de oynanmadıysa seri bozulmuştur. */
export function liveStreak(d: SaveData, today: string): number {
  return d.streak.last === today || d.streak.last === prevDayKey(today) ? d.streak.count : 0;
}
