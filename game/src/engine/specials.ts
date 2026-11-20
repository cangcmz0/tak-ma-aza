// Special grain registry. A special is a flag bit on grains that reacts when
// one of its grains is part of a clear (e.g. bomb blasts nearby grains).
import { BOMB_RADIUS } from '../config';
import { FLAG_BOMB, EMPTY, MAX_SAND_COLOR, type SandGrid } from './grid';

export type SpecialId = 'bomb';

export interface SpecialDef {
  id: SpecialId;
  /** Flag bit stored in SandGrid.flags. */
  flag: number;
  /**
   * Called for every marked grain carrying this flag. Mark extra sand cells with mark(j);
   * report obstacle cells (e.g. sacks) reached by the effect with hit(j).
   * Must not allocate (runs on clears).
   */
  onClear(g: SandGrid, i: number, mark: (j: number) => void, hit: (j: number) => void): void;
}

const bomb: SpecialDef = {
  id: 'bomb',
  flag: FLAG_BOMB,
  onClear(g, i, mark, hit) {
    const cx = i % g.w;
    const cy = (i - cx) / g.w;
    const r = BOMB_RADIUS;
    const r2 = r * r;
    for (let dy = -r; dy <= r; dy++) {
      const y = cy + dy;
      if (y < 0 || y >= g.h) continue;
      for (let dx = -r; dx <= r; dx++) {
        const x = cx + dx;
        if (x < 0 || x >= g.w || dx * dx + dy * dy > r2) continue;
        const j = y * g.w + x;
        const c = g.color[j];
        if (c === EMPTY) continue;
        // Blasts remove every sand/joker grain; obstacles (shelf, sack) are only "hit".
        if (c <= MAX_SAND_COLOR) mark(j);
        else hit(j);
      }
    }
  },
};

/** All registered specials. Add new entries here (and a FLAG_* bit in grid.ts). */
export const SPECIALS: readonly SpecialDef[] = [bomb];

export function specialById(id: SpecialId): SpecialDef {
  const s = SPECIALS.find((d) => d.id === id);
  if (!s) throw new Error(`Unknown special: ${id}`);
  return s;
}

/** Mask of all special flag bits. */
export const SPECIAL_MASK = SPECIALS.reduce((m, s) => m | s.flag, 0);
