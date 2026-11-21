// Greedy auto-player for level QA / balancing (not part of the shipped UI).
// For every candidate drop it simulates the landing on a scratch grid and scores
// the result by how wide same-colour regions get (wall-to-wall = path).
import { Rng } from '../core/rng';
import { EMPTY, MAX_SAND_COLOR, SandGrid } from '../engine/grid';
import { canStamp, maxX, ROTATIONS, stamp, type Piece } from '../engine/pieces';
import { settle } from '../engine/sim';
import { Session } from '../game/session';
import type { LevelDef } from '../levels/schema';

export interface BotMove {
  slot: number;
  rot: number;
  x: number;
}

class Evaluator {
  readonly scratch: SandGrid;
  private readonly seen: Uint8Array;
  private readonly stack: Int32Array;
  private readonly rng = new Rng(1);

  constructor(w: number, h: number) {
    this.scratch = new SandGrid(w, h);
    this.seen = new Uint8Array(w * h);
    this.stack = new Int32Array(w * h);
  }

  /** Higher is better. */
  score(g: SandGrid): number {
    const { w, h, color } = g;
    const seen = this.seen;
    seen.fill(0);
    let total = 0;
    let top = h;
    for (let i = 0; i < g.size; i++) {
      const c = color[i];
      if (c === EMPTY) continue;
      if (i < top * w) top = Math.floor(i / w);
      if (c > MAX_SAND_COLOR || seen[i]) continue;
      let sp = 0;
      let minX = w;
      let maxXv = -1;
      this.stack[sp++] = i;
      seen[i] = 1;
      while (sp) {
        const j = this.stack[--sp];
        const x = j % w;
        if (x < minX) minX = x;
        if (x > maxXv) maxXv = x;
        if (x > 0 && !seen[j - 1] && color[j - 1] === c) (seen[j - 1] = 1), (this.stack[sp++] = j - 1);
        if (x < w - 1 && !seen[j + 1] && color[j + 1] === c) (seen[j + 1] = 1), (this.stack[sp++] = j + 1);
        if (j >= w && !seen[j - w] && color[j - w] === c) (seen[j - w] = 1), (this.stack[sp++] = j - w);
        if (j + w < g.size && !seen[j + w] && color[j + w] === c) (seen[j + w] = 1), (this.stack[sp++] = j + w);
      }
      const span = (maxXv - minX + 1) / w;
      total += span === 1 ? 50 : span * span * span * 10;
    }
    const fill = (h - top) / h;
    return total - fill * fill * 20;
  }

  tryMove(g: SandGrid, p: Piece, rot: number, x: number): number {
    const s = this.scratch;
    s.copyFrom(g);
    const r0 = p.rot;
    p.rot = rot;
    // Shortcut: drop the piece rigidly to where it would first touch, then let it spread.
    const shape = ROTATIONS[p.kind][rot];
    let y = 0;
    while (canStamp(s, shape, x, y + 1)) y++;
    stamp(s, p, x, y, this.rng);
    p.rot = r0;
    settle(s, this.rng, 200);
    return this.score(s);
  }
}

const evaluators = new Map<string, Evaluator>();

/** Choose a move for the current session state (null if nothing fits). */
export function chooseMove(s: Session, xStep = 4): BotMove | null {
  const g = s.grid;
  const key = `${g.w}x${g.h}`;
  let ev = evaluators.get(key);
  if (!ev) evaluators.set(key, (ev = new Evaluator(g.w, g.h)));
  let best: BotMove | null = null;
  let bestScore = -Infinity;
  for (let slot = 0; slot < s.tray.length; slot++) {
    const p = s.tray[slot];
    if (!p) continue;
    const rots = p.kind === 'O' ? 1 : 4;
    for (let rot = 0; rot < rots; rot++) {
      const shape = ROTATIONS[p.kind][rot];
      const mx = maxX(g, shape);
      for (let x = 0; x <= mx; x += x + xStep > mx && x < mx ? mx - x : xStep) {
        if (!canStamp(g, shape, x, 0)) continue;
        const sc = ev.tryMove(g, p, rot, x);
        if (sc > bestScore) {
          bestScore = sc;
          best = { slot, rot, x };
        }
      }
    }
  }
  return best;
}

export interface BotResult {
  state: Session['state'];
  score: number;
  placed: number;
  stars: number;
  ticks: number;
}

/** Play a level to the end (waits for the sand to settle between moves). */
export function autoplay(level: LevelDef, seed?: number, maxMoves = 500): BotResult {
  const s = new Session(level, seed === undefined ? {} : { seed });
  s.runUntilSettled();
  for (let n = 0; n < maxMoves && s.isPlaying; n++) {
    const m = chooseMove(s);
    if (!m) break;
    const p = s.tray[m.slot];
    if (p) p.rot = m.rot;
    s.drop(m.slot, m.x);
    s.runUntilSettled();
  }
  return { state: s.state, score: s.score, placed: s.placed, stars: s.stars, ticks: s.ticks };
}
