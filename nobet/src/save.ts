// Yerel kayıt. Erişilemezse oyun kayıtsız devam eder.
export interface SaveData {
  stars: Record<string, number>;
  best: Record<string, number>;
  sound: boolean;
}

const KEY = 'nobet.v1';
const fresh = (): SaveData => ({ stars: {}, best: {}, sound: true });

export function loadSave(): SaveData {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return { ...fresh(), ...JSON.parse(raw) };
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
