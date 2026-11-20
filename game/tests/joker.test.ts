import { describe, expect, it } from 'vitest';
import { Rng } from '../src/core/rng';
import { ClearResult, findClears } from '../src/engine/clear';
import { JOKER, SandGrid } from '../src/engine/grid';
import { blockColor, PieceBag, stamp, type Piece } from '../src/engine/pieces';
import { GoalTracker } from '../src/game/goals';
import { Session } from '../src/game/session';
import { validateLevel } from '../src/levels/schema';
import { makeLevel } from './helpers';

function row(g: SandGrid, y: number, color: number, from = 0, to = g.w) {
  for (let x = from; x < to; x++) g.set(x, y, color);
}

describe('joker grains (Karışık Baharat, GDD §5.2)', () => {
  it('a joker block bridges a gap in a colour row', () => {
    const g = new SandGrid(8, 2);
    row(g, 1, 1);
    g.set(3, 1, JOKER);
    g.set(4, 1, JOKER);
    const res = ClearResult.for(g);
    expect(findClears(g, res)).toBe(1);
    expect(res.regionColor[0]).toBe(1);
    expect(res.cellCount).toBe(8);
    // Jokers do not count as colour grains.
    expect(res.colorCounts[1]).toBe(6);
    expect(res.colorCounts[JOKER]).toBe(2);
    expect(res.jokerPathGrains(g)).toBe(2);
  });

  it('without the joker the same row is no path', () => {
    const g = new SandGrid(8, 2);
    row(g, 1, 1);
    g.set(3, 1, 2);
    expect(findClears(g, ClearResult.for(g))).toBe(0);
  });

  it('a joker-only wall-to-wall region is a path of colour JOKER', () => {
    const g = new SandGrid(6, 2);
    row(g, 1, JOKER);
    const res = ClearResult.for(g);
    expect(findClears(g, res)).toBe(1);
    expect(res.regionColor[0]).toBe(JOKER);
    const t = new GoalTracker([
      { type: 'clear_paths', count: 1 },
      { type: 'clear_paths', count: 1, color: 1 },
    ]);
    t.onClear(res);
    expect(t.goals[0].current).toBe(1); // any colour
    expect(t.goals[1].current).toBe(0); // not a red path
  });

  it('colours are searched 1→N; jokers used by an earlier colour are consumed', () => {
    // Row 1: red left half + joker column + yellow right half; row 0: yellow left + joker + red right.
    // The joker column (x=3) can complete red (row1 red | joker | ... ) only if red continues;
    // build: red uses the joker, yellow would need the same joker.
    const g = new SandGrid(7, 2);
    // red: x0..2 row1, joker x3 both rows, red x4..6 row1
    row(g, 1, 1, 0, 3);
    row(g, 1, 1, 4, 7);
    g.set(3, 1, JOKER);
    g.set(3, 0, JOKER);
    // yellow: x0..2 row0 and x4..6 row0 -> needs the jokers at x3 too
    row(g, 0, 2, 0, 3);
    row(g, 0, 2, 4, 7);
    const res = ClearResult.for(g);
    expect(findClears(g, res)).toBe(1);
    expect(res.regionColor[0]).toBe(1);
    // Both jokers joined red (they are 4-connected to the red region).
    expect(res.colorCounts[JOKER]).toBe(2);
    expect(res.colorCounts[2]).toBe(0);
  });

  it('a joker-bridged path in a session scores and counts for colour paths', () => {
    const s = new Session(makeLevel({ colors: [1, 2], goals: [{ type: 'clear_paths', count: 1, color: 1 }] }), { gridW: 16, gridH: 24 });
    const g = s.grid;
    for (let x = 0; x < g.w; x++) g.set(x, g.h - 1, x === 8 ? JOKER : 1);
    s.runUntilSettled();
    expect(s.goals.goals[0].current).toBe(1);
    expect(s.score - s.endBonus).toBe(16 + 100);
  });

  it('a piece joker block stamps joker grains', () => {
    const g = new SandGrid(16, 16);
    const p: Piece = { kind: 'I', rot: 0, color: 2, special: null, specialCell: -1, jokerCell: 1 };
    expect(blockColor(p, 0)).toBe(2);
    expect(blockColor(p, 1)).toBe(JOKER);
    stamp(g, p, 0, 0, new Rng(1));
    expect(g.get(0, 0)).toBe(2);
    expect(g.get(4, 0)).toBe(JOKER);
    expect(g.countColor(JOKER)).toBe(16);
  });

  it('jokerChance deals one joker block per piece', () => {
    const bag = new PieceBag(new Rng(3), { colors: [1, 2], jokerChance: 1 });
    for (let i = 0; i < 10; i++) {
      const p = bag.next();
      expect(p.jokerCell).toBeGreaterThanOrEqual(0);
      expect(p.jokerCell).toBeLessThan(4);
    }
    const none = new PieceBag(new Rng(3), { colors: [1, 2] });
    expect(none.next().jokerCell ?? -1).toBe(-1);
  });

  it('pattern legend "joker" places joker grains; level colours must stay below JOKER', () => {
    const r = validateLevel({
      id: 1,
      name: 'j',
      colors: [1, 2],
      goals: [{ type: 'score', value: 1 }],
      stars: [1, 2, 3],
      prefill: { type: 'pattern', rows: ['J...........', '121212121212'], legend: { J: 'joker' } },
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const s = new Session(r.level);
    expect(s.grid.countColor(JOKER)).toBeGreaterThan(0);
    expect(validateLevel({ id: 1, name: 'x', colors: [JOKER], goals: [{ type: 'score', value: 1 }], stars: [1, 2, 3] }).ok).toBe(false);
  });
});
