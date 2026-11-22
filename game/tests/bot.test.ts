import { describe, expect, it } from 'vitest';
import { Rng } from '../src/core/rng';
import { autoplay } from '../src/dev/bot';
import { canStamp, maxX, ROTATIONS } from '../src/engine/pieces';
import { Session } from '../src/game/session';
import { LEVELS } from '../src/levels/levels';

// Level sanity, kept fast: every level is played to the end by a cheap random-but-legal
// player (pure simulation, no move evaluation). The (slow) greedy bot only checks the
// tutorial levels here; full balance numbers come from scripts/calibrate-levels.mjs.

/** Random legal moves until the session ends; returns the final state. */
function randomPlay(levelIndex: number, attempt = 0, maxMoves = 200): Session {
  const s = new Session(LEVELS[levelIndex], { attempt });
  const rng = new Rng(1234 + attempt);
  s.runUntilSettled();
  for (let n = 0; n < maxMoves && s.isPlaying; n++) {
    const moves: [number, number, number][] = [];
    // Block-aligned columns first; fall back to every grain column (steep piles can leave
    // only off-grid gaps, which the session still counts as "fits somewhere").
    for (const stepX of [4, 1]) {
      s.tray.forEach((p, slot) => {
        if (!p) return;
        for (let rot = 0; rot < 4; rot++) {
          const shape = ROTATIONS[p.kind][rot];
          for (let x = 0; x <= maxX(s.grid, shape); x += stepX) if (canStamp(s.grid, shape, x, 0)) moves.push([slot, rot, x]);
        }
      });
      if (moves.length) break;
    }
    if (!moves.length) break;
    const [slot, rot, x] = rng.pick(moves);
    const p = s.tray[slot];
    if (p) p.rot = rot;
    s.drop(slot, x);
    s.runUntilSettled();
  }
  return s;
}

describe('level sanity (random legal player)', () => {
  it.each(LEVELS.map((l, i) => [l.id, i] as const))('level %i runs to a win or a loss', (_id, i) => {
    const s = randomPlay(i);
    expect(s.state).not.toBe('playing');
    expect(s.placed).toBeLessThanOrEqual(s.pieceBudget);
  });
});

describe('greedy bot (tutorial levels)', () => {
  it('levels 1–3 are won by the greedy bot', { timeout: 30000 }, () => {
    for (const l of LEVELS.slice(0, 3)) {
      const r = autoplay(l);
      expect(r.state, `level ${l.id}`).toBe('won');
    }
  });
});
