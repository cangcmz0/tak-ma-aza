// Live "path progress" for the board hint overlay: per colour, how far the same-colour
// region touching the LEFT wall reaches to the right, and how far the one touching the
// RIGHT wall reaches to the left. Same connectivity as the clear rule (engine/clear.ts):
// 4-neighbourhood, jokers join every colour. Run it once when the sand settles, not per
// frame (one BFS per colour over the grid, preallocated buffers, no allocation per call
// except the small result array).
import { JOKER, type SandGrid } from '../engine/grid';

export interface PathProgress {
  color: number;
  /** Rightmost column reached by a region touching x = 0 (-1 = no such region). */
  leftReach: number;
  /** Row of that rightmost cell (lowest such row when several). */
  leftRow: number;
  /** Leftmost column reached by a region touching x = w-1 (w = no such region). */
  rightReach: number;
  rightRow: number;
  /** Columns covered from the walls: min(1, (leftReach + 1 + (w - rightReach)) / w). */
  frac: number;
}

export class PathProgressScanner {
  private seen: Uint8Array;
  private stack: Int32Array;

  constructor(size = 0) {
    this.seen = new Uint8Array(size);
    this.stack = new Int32Array(size);
  }

  private ensure(size: number): void {
    if (this.seen.length < size) {
      this.seen = new Uint8Array(size);
      this.stack = new Int32Array(size);
    }
  }

  /** Flood from one wall; returns [extreme column, its row]. */
  private flood(g: SandGrid, c: number, fromLeft: boolean): [number, number] {
    const { w, h, color } = g;
    const seen = this.seen;
    const stack = this.stack;
    seen.fill(0, 0, w * h);
    let sp = 0;
    const x0 = fromLeft ? 0 : w - 1;
    let hasColor = false;
    for (let y = 0; y < h; y++) {
      const i = y * w + x0;
      const v = color[i];
      if (v === c || v === JOKER) {
        seen[i] = 1;
        stack[sp++] = i;
      }
    }
    let best = fromLeft ? -1 : w;
    let bestRow = -1;
    // Two passes would be needed to ignore joker-only regions exactly; instead we track
    // whether the region contains the colour at all and fall back to "none" if not.
    while (sp > 0) {
      const i = stack[--sp];
      const x = i % w;
      const y = (i / w) | 0;
      if (color[i] === c) hasColor = true;
      if (fromLeft ? x > best || (x === best && y > bestRow) : x < best || (x === best && y > bestRow)) {
        best = x;
        bestRow = y;
      }
      if (x > 0) {
        const j = i - 1;
        if (!seen[j] && (color[j] === c || color[j] === JOKER)) {
          seen[j] = 1;
          stack[sp++] = j;
        }
      }
      if (x < w - 1) {
        const j = i + 1;
        if (!seen[j] && (color[j] === c || color[j] === JOKER)) {
          seen[j] = 1;
          stack[sp++] = j;
        }
      }
      if (y > 0) {
        const j = i - w;
        if (!seen[j] && (color[j] === c || color[j] === JOKER)) {
          seen[j] = 1;
          stack[sp++] = j;
        }
      }
      if (y < h - 1) {
        const j = i + w;
        if (!seen[j] && (color[j] === c || color[j] === JOKER)) {
          seen[j] = 1;
          stack[sp++] = j;
        }
      }
    }
    if (!hasColor) return [fromLeft ? -1 : w, -1];
    return [best, bestRow];
  }

  /** Progress for each colour in `colors` (order kept). */
  scan(g: SandGrid, colors: readonly number[]): PathProgress[] {
    this.ensure(g.w * g.h);
    const out: PathProgress[] = [];
    for (const c of colors) {
      if (c <= 0 || c >= JOKER) continue;
      const [lx, ly] = this.flood(g, c, true);
      const [rx, ry] = this.flood(g, c, false);
      const covered = lx + 1 + (g.w - rx);
      out.push({ color: c, leftReach: lx, leftRow: ly, rightReach: rx, rightRow: ry, frac: Math.min(1, covered / g.w) });
    }
    return out;
  }
}

/** One-shot helper (tests / tools). */
export function computePathProgress(g: SandGrid, colors: readonly number[]): PathProgress[] {
  return new PathProgressScanner(g.size).scan(g, colors);
}
