// Falling-sand cellular automaton. Allocation-free; operates in place.
import type { Rng } from '../core/rng';
import { EMPTY, FLAG_STATIC, type SandGrid } from './grid';

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
export function step(g: SandGrid, rng: Rng): number {
  const { w, h, color, flags } = g;
  let moved = 0;
  for (let y = h - 2; y >= 0; y--) {
    const ltr = rng.next() < 0.5;
    const row = y * w;
    for (let k = 0; k < w; k++) {
      const x = ltr ? k : w - 1 - k;
      const i = row + x;
      if (color[i] === EMPTY || (flags[i] & FLAG_STATIC) !== 0) continue;
      const below = i + w;
      if (color[below] === EMPTY) {
        move(g, i, below);
        moved++;
        continue;
      }
      const dl = x > 0 && color[below - 1] === EMPTY;
      const dr = x < w - 1 && color[below + 1] === EMPTY;
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

/** Run steps until settled or maxSteps reached. Returns true if settled. */
export function settle(g: SandGrid, rng: Rng, maxSteps = 10000): boolean {
  for (let n = 0; n < maxSteps; n++) if (step(g, rng) === 0) return true;
  return false;
}
