// Falling-sand cellular automaton. Allocation-free; operates in place.
//
// Active-range optimisation: a grain in row y can only start moving when something changed in
// rows y..y+2 (below, diagonal below, and the repose check one row further). So each step
// records the rows where grains moved and the next step scans only [movedLo - 2, movedHi].
// Any outside mutation (detected via SandGrid.version) forces a full rescan.
import { SAND_REPOSE } from '../config';
import type { Rng } from '../core/rng';
import { EMPTY, FLAG_FALLING, FLAG_STATIC, type SandGrid } from './grid';

function move(g: SandGrid, a: number, b: number): void {
  g.color[b] = g.color[a];
  g.shade[b] = g.shade[a];
  g.flags[b] = g.flags[a];
  g.color[a] = EMPTY;
  g.shade[a] = 0;
  g.flags[a] = 0;
}

/** Locate the rows of FLAG_FALLING grains (full scan; after outside mutations). */
function findFalling(g: SandGrid): void {
  const { w, flags, size } = g;
  let lo = g.h;
  let hi = -1;
  for (let i = 0; i < size; i++) {
    if ((flags[i] & FLAG_FALLING) === 0) continue;
    const y = (i / w) | 0;
    if (y < lo) lo = y;
    hi = y;
  }
  g.fallLo = lo;
  g.fallHi = hi;
}

/**
 * One physics pass, bottom-up. A grain falls straight down if possible,
 * otherwise slides diagonally (random side when both are free).
 * Static cells (FLAG_STATIC) never move but support grains.
 * @returns number of grains that moved (0 => the board is settled).
 */
export function step(g: SandGrid, rng: Rng, repose: number = SAND_REPOSE): number {
  const { w, h, color, flags } = g;
  let lo: number;
  let hi: number;
  if (g.version !== g.simVersion) {
    findFalling(g);
    lo = 0;
    hi = h - 2;
  } else {
    lo = g.scanLo;
    hi = g.scanHi;
  }
  let mLo = h;
  let mHi = -1;
  let moved = 0;
  if (g.fallLo <= g.fallHi) {
    const a = g.fallLo;
    const b = g.fallHi;
    moved = stepFalling(g);
    // Rows the falling piece occupied (and moved into) may hold loose sand now.
    const bb = moved ? b + 1 : b;
    if (a - 2 < lo) lo = a - 2;
    if (bb > hi) hi = bb;
    if (moved) {
      mLo = a;
      mHi = bb;
    }
  }
  if (lo < 0) lo = 0;
  if (hi > h - 2) hi = h - 2;
  for (let y = hi; y >= lo; y--) {
    const ltr = rng.next() < 0.5;
    const row = y * w;
    let rowMoved = false;
    for (let k = 0; k < w; k++) {
      const x = ltr ? k : w - 1 - k;
      const i = row + x;
      if (color[i] === EMPTY || (flags[i] & (FLAG_STATIC | FLAG_FALLING)) !== 0) continue;
      const below = i + w;
      if (color[below] === EMPTY) {
        move(g, i, below);
        moved++;
        rowMoved = true;
        continue;
      }
      const deep = repose >= 2 && y + 2 < h;
      const dl = x > 0 && color[below - 1] === EMPTY && (repose < 2 || (deep && color[below - 1 + w] === EMPTY));
      const dr = x < w - 1 && color[below + 1] === EMPTY && (repose < 2 || (deep && color[below + 1 + w] === EMPTY));
      if (dl && dr) {
        move(g, i, rng.next() < 0.5 ? below - 1 : below + 1);
      } else if (dl) {
        move(g, i, below - 1);
      } else if (dr) {
        move(g, i, below + 1);
      } else continue;
      moved++;
      rowMoved = true;
    }
    if (rowMoved) {
      if (y < mLo) mLo = y;
      if (y + 1 > mHi) mHi = y + 1;
    }
  }
  if (mHi >= 0) {
    g.scanLo = mLo - 2 < 0 ? 0 : mLo - 2;
    g.scanHi = mHi > h - 2 ? h - 2 : mHi;
  } else {
    g.scanLo = 1;
    g.scanHi = 0;
  }
  if (moved) g.version++;
  g.simVersion = g.version;
  return moved;
}

/**
 * A just-dropped piece (FLAG_FALLING grains) moves down one row as a rigid block.
 * As soon as any of its grains is supported, the whole piece turns into loose sand.
 * Only the rows in [fallLo, fallHi] are touched.
 * @returns number of grains moved
 */
function stepFalling(g: SandGrid): number {
  const { w, h, color, flags } = g;
  const i0 = g.fallLo * w;
  const i1 = (g.fallHi + 1) * w;
  let canFall = true;
  for (let i = i0; i < i1; i++) {
    if ((flags[i] & FLAG_FALLING) === 0) continue;
    const below = i + w;
    if (i >= w * (h - 1) || (color[below] !== EMPTY && (flags[below] & FLAG_FALLING) === 0)) {
      canFall = false;
      break;
    }
  }
  if (!canFall) {
    for (let i = i0; i < i1; i++) flags[i] &= ~FLAG_FALLING;
    g.fallLo = 0;
    g.fallHi = -1;
    return 0;
  }
  let moved = 0;
  for (let i = i1 - 1; i >= i0; i--) {
    if ((flags[i] & FLAG_FALLING) === 0) continue;
    move(g, i, i + w);
    moved++;
  }
  if (moved === 0) {
    g.fallLo = 0;
    g.fallHi = -1;
  } else {
    g.fallLo++;
    g.fallHi++;
  }
  return moved;
}

/** Run steps until settled or maxSteps reached. Returns true if settled. */
export function settle(g: SandGrid, rng: Rng, maxSteps = 10000, repose: number = SAND_REPOSE): boolean {
  for (let n = 0; n < maxSteps; n++) if (step(g, rng, repose) === 0) return true;
  return false;
}
