// Falling-sand cellular automaton. Allocation-free; operates in place.
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

/**
 * One physics pass, bottom-up. A grain falls straight down if possible,
 * otherwise slides diagonally (random side when both are free).
 * Static cells (FLAG_STATIC) never move but support grains.
 * @returns number of grains that moved (0 => the board is settled).
 */
export function step(g: SandGrid, rng: Rng, repose: number = SAND_REPOSE): number {
  const { w, h, color, flags } = g;
  let moved = stepFalling(g);
  for (let y = h - 2; y >= 0; y--) {
    const ltr = rng.next() < 0.5;
    const row = y * w;
    for (let k = 0; k < w; k++) {
      const x = ltr ? k : w - 1 - k;
      const i = row + x;
      if (color[i] === EMPTY || (flags[i] & (FLAG_STATIC | FLAG_FALLING)) !== 0) continue;
      const below = i + w;
      if (color[below] === EMPTY) {
        move(g, i, below);
        moved++;
        continue;
      }
      const deep = repose >= 2 && y + 2 < h;
      const dl = x > 0 && color[below - 1] === EMPTY && (repose < 2 || (deep && color[below - 1 + w] === EMPTY));
      const dr = x < w - 1 && color[below + 1] === EMPTY && (repose < 2 || (deep && color[below + 1 + w] === EMPTY));
      if (dl && dr) {
        move(g, i, rng.next() < 0.5 ? below - 1 : below + 1);
        moved++;
      } else if (dl) {
        move(g, i, below - 1);
        moved++;
      } else if (dr) {
        move(g, i, below + 1);
        moved++;
      }
    }
  }
  if (moved) g.version++;
  return moved;
}

/**
 * A just-dropped piece (FLAG_FALLING grains) moves down one row as a rigid block.
 * As soon as any of its grains is supported, the whole piece turns into loose sand.
 * @returns number of grains moved
 */
function stepFalling(g: SandGrid): number {
  const { w, h, color, flags } = g;
  let any = false;
  let canFall = true;
  for (let i = 0; i < g.size; i++) {
    if ((flags[i] & FLAG_FALLING) === 0) continue;
    any = true;
    const below = i + w;
    if (i >= w * (h - 1) || (color[below] !== EMPTY && (flags[below] & FLAG_FALLING) === 0)) {
      canFall = false;
      break;
    }
  }
  if (!any) return 0;
  if (!canFall) {
    for (let i = 0; i < g.size; i++) flags[i] &= ~FLAG_FALLING;
    return 0;
  }
  let moved = 0;
  for (let i = w * (h - 1) - 1; i >= 0; i--) {
    if ((flags[i] & FLAG_FALLING) === 0) continue;
    move(g, i, i + w);
    moved++;
  }
  return moved;
}

/** Run steps until settled or maxSteps reached. Returns true if settled. */
export function settle(g: SandGrid, rng: Rng, maxSteps = 10000, repose: number = SAND_REPOSE): boolean {
  for (let n = 0; n < maxSteps; n++) if (step(g, rng, repose) === 0) return true;
  return false;
}
