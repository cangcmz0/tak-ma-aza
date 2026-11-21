// Finds a good move for tutorial hand hints: simulates candidate drops on a scratch grid
// and prefers moves that complete a path, then moves that widen the piece's colour regions.
import { BLOCK } from '../config';
import { Rng } from '../core/rng';
import { ClearResult, findClears } from '../engine/clear';
import { EMPTY, SandGrid } from '../engine/grid';
import { blockColor, canStamp, maxX, ROTATIONS, stamp, type Piece } from '../engine/pieces';
import { settle } from '../engine/sim';
import type { Session } from './session';

export interface HintMove {
  slot: number;
  rot: number;
  /** Grain column of the piece's left edge. */
  x: number;
  /** True if the move completes at least one path. */
  clears: boolean;
}

class Scratch {
  readonly g: SandGrid;
  readonly res: ClearResult;
  readonly seen: Uint8Array;
  readonly stack: Int32Array;
  readonly rng = new Rng(7);
  constructor(w: number, h: number) {
    this.g = new SandGrid(w, h);
    this.res = ClearResult.for(this.g);
    this.seen = new Uint8Array(w * h);
    this.stack = new Int32Array(w * h);
  }

  /** Widest horizontal span (0..1) of a region of colour c. */
  span(c: number): number {
    const { g, seen, stack } = this;
    const { w, color } = g;
    seen.fill(0);
    let best = 0;
    for (let i = 0; i < g.size; i++) {
      if (color[i] !== c || seen[i]) continue;
      let sp = 0;
      let lo = w;
      let hi = -1;
      stack[sp++] = i;
      seen[i] = 1;
      while (sp) {
        const j = stack[--sp];
        const x = j % w;
        if (x < lo) lo = x;
        if (x > hi) hi = x;
        if (x > 0 && !seen[j - 1] && color[j - 1] === c) (seen[j - 1] = 1), (stack[sp++] = j - 1);
        if (x < w - 1 && !seen[j + 1] && color[j + 1] === c) (seen[j + 1] = 1), (stack[sp++] = j + 1);
        if (j >= w && !seen[j - w] && color[j - w] === c) (seen[j - w] = 1), (stack[sp++] = j - w);
        if (j + w < g.size && !seen[j + w] && color[j + w] === c) (seen[j + w] = 1), (stack[sp++] = j + w);
      }
      best = Math.max(best, (hi - lo + 1) / w);
    }
    return best;
  }
}

const scratches = new Map<string, Scratch>();

/**
 * Best move among `slots` (default: all filled tray slots). Rotations other than the
 * current one are only chosen when they are clearly better. Null if nothing fits.
 */
export function findHintMove(s: Session, slots?: readonly number[]): HintMove | null {
  const g = s.grid;
  const key = `${g.w}x${g.h}`;
  let sc = scratches.get(key);
  if (!sc) scratches.set(key, (sc = new Scratch(g.w, g.h)));
  const candidates = slots ?? s.tray.map((_, i) => i);
  let best: HintMove | null = null;
  let bestScore = -Infinity;
  for (const slot of candidates) {
    const p = s.tray[slot];
    if (!p) continue;
    const rots = p.kind === 'O' ? [p.rot] : [p.rot, (p.rot + 1) & 3, (p.rot + 2) & 3, (p.rot + 3) & 3];
    for (const rot of rots) {
      const shape = ROTATIONS[p.kind][rot];
      const mx = maxX(g, shape);
      for (let x = 0; x <= mx; x += x + BLOCK > mx && x < mx ? mx - x : BLOCK) {
        if (!canStamp(g, shape, x, 0)) continue;
        const score = evaluate(sc, g, p, rot, x) - (rot === p.rot ? 0 : 5);
        if (score > bestScore) {
          bestScore = score;
          best = { slot, rot, x, clears: score >= 1e6 - 10 };
        }
      }
    }
  }
  return best;
}

function evaluate(sc: Scratch, g: SandGrid, p: Piece, rot: number, x: number): number {
  const t = sc.g;
  t.copyFrom(g);
  const r0 = p.rot;
  p.rot = rot;
  // Rigid fall to the first contact, then let it spread (much cheaper than falling 80 rows).
  const shape = ROTATIONS[p.kind][rot];
  let y = 0;
  while (canStamp(t, shape, x, y + 1)) y++;
  stamp(t, p, x, y, sc.rng);
  p.rot = r0;
  settle(t, sc.rng, 400);
  const paths = findClears(t, sc.res);
  if (paths > 0) return 1e6 + sc.res.cellCount;
  let span = 0;
  for (let c = 0; c < 4; c++) span = Math.max(span, sc.span(blockColor(p, c)));
  // Mild preference for keeping the stack low.
  let top = t.h;
  for (let i = 0; i < t.size; i++)
    if (t.color[i] !== EMPTY) {
      top = (i / t.w) | 0;
      break;
    }
  return span * 1000 - (t.h - top);
}
