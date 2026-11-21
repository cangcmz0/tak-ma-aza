import { describe, expect, it } from 'vitest';
import { Rng } from '../src/core/rng';
import { PieceBag } from '../src/engine/pieces';
import { Session, type SessionEvent } from '../src/game/session';
import { makeLevel } from './helpers';

const small = { gridW: 16, gridH: 24 };

function collect(s: Session): SessionEvent[] {
  const ev: SessionEvent[] = [];
  s.events.on((e) => ev.push(e));
  return ev;
}

describe('Session', () => {
  it('deals the same tray for the same seed', () => {
    const a = new Session(makeLevel(), small);
    const b = new Session(makeLevel(), small);
    expect(a.tray).toEqual(b.tray);
    const c = new Session(makeLevel({ seed: 43 }), small);
    expect(c.tray).not.toEqual(a.tray);
  });

  it('identical inputs give identical boards (deterministic replay)', () => {
    const run = () => {
      const s = new Session(makeLevel({ pieceLimit: 30 }), { gridW: 32, gridH: 48 });
      for (let k = 0; k < 4; k++) {
        const slot = s.tray.findIndex((t) => t);
        s.drop(slot, k * 4);
        for (let t = 0; t < 10; t++) s.tick();
      }
      s.runUntilSettled();
      return { grid: Array.from(s.grid.color), score: s.score };
    };
    expect(run()).toEqual(run());
  });

  it('a colliding drop while sand is flowing is refused, not a loss', () => {
    const s = new Session(makeLevel({ pieces: ['O'] }), small);
    const ev = collect(s);
    expect(s.drop(0, 0)).toBe(true);
    // Same spot immediately: the first piece is still at the top.
    expect(s.drop(1, 0)).toBe(false);
    expect(s.state).toBe('playing');
    expect(ev.some((e) => e.type === 'blocked')).toBe(true);
    expect(s.tray[1]).not.toBeNull();
    s.tick();
    s.tick();
    s.tick();
    // After the sand moved away the drop is accepted.
    for (let i = 0; i < 20 && !s.canDrop(1, 0); i++) s.tick();
    expect(s.drop(1, 0)).toBe(true);
  });

  it('wins when the goals are reached after the sand settles', () => {
    const s = new Session(makeLevel({ colors: [1], pieces: ['I'], pieceLimit: 5 }), small);
    const ev = collect(s);
    const p = s.tray[0];
    expect(p).not.toBeNull();
    p!.rot = 0; // horizontal I = full board width
    expect(s.drop(0, 0)).toBe(true);
    s.runUntilSettled();
    expect(s.state).toBe('won');
    expect(s.goals.allDone()).toBe(true);
    // (4 blocks × 16 grains + path bonus) × chain 1, plus 4 unused pieces × end bonus.
    expect(s.score).toBe(64 + 100 + 4 * 100);
    expect(s.endBonus).toBe(400);
    expect(s.stars).toBeGreaterThanOrEqual(1);
    const types = ev.map((e) => e.type);
    expect(types.indexOf('clearStart')).toBeLessThan(types.indexOf('cleared'));
    expect(types.indexOf('cleared')).toBeLessThan(types.indexOf('won'));
  });

  it('loses when the piece limit is used up without reaching goals', () => {
    const s = new Session(makeLevel({ pieceLimit: 1, pieces: ['O'] }), { gridW: 24, gridH: 24 });
    expect(s.tray.filter((t) => t).length).toBe(1);
    s.drop(0, 0);
    s.runUntilSettled();
    expect(s.state).toBe('lost');
    expect(s.loseReason).toBe('out_of_pieces');
  });

  it('loses when no tray piece fits anywhere (sand settled)', () => {
    const obstacles = [0, 3, 6, 9, 12, 15].map((x) => ({ x, y: 0, unit: 'grain' as const }));
    const s = new Session(makeLevel({ obstacles }), small);
    s.runUntilSettled();
    expect(s.state).toBe('lost');
    expect(s.loseReason).toBe('no_space');
  });

  it('chain resets once the board settles without a path', () => {
    const s = new Session(makeLevel({ colors: [1], pieces: ['I'], pieceLimit: 5, goals: [{ type: 'clear_paths', count: 5 }] }), small);
    s.tray[0]!.rot = 0;
    s.drop(0, 0);
    s.runUntilSettled();
    expect(s.bestChain).toBe(1);
    expect(s.chain).toBe(0);
    expect(s.score).toBe(64 + 100);
  });

  it('several paths in one check are separate chain steps, largest first', () => {
    const s = new Session(makeLevel({ colors: [1, 2], goals: [{ type: 'clear_paths', count: 5 }] }), small);
    const g = s.grid;
    for (let x = 0; x < g.w; x++) g.set(x, g.h - 1, 1);
    for (let x = 0; x < g.w; x++) g.set(x, g.h - 2, 2);
    g.set(0, g.h - 3, 2); // makes the colour-2 path bigger (17 grains)
    const ev = collect(s);
    s.runUntilSettled();
    const c = ev.find((e) => e.type === 'cleared');
    expect(c && c.type === 'cleared' && c.paths).toBe(2);
    expect(s.score).toBe((17 + 100) * 1 + (16 + 100) * 2);
  });

  it('chain multiplier is capped', () => {
    const s = new Session(makeLevel({ colors: [1, 2, 3], goals: [{ type: 'clear_paths', count: 9 }] }), small);
    const g = s.grid;
    for (let y = 0; y < 7; y++) for (let x = 0; x < g.w; x++) g.set(x, g.h - 1 - y * 2, 1 + (y % 3));
    s.runUntilSettled();
    // 7 equal paths: multipliers 1,2,3,4,5,5,5
    expect(s.score).toBe((16 + 100) * (1 + 2 + 3 + 4 + 5 + 5 + 5));
  });

  it('a cascade of clears raises the chain multiplier', () => {
    const s = new Session(makeLevel({ colors: [1, 2], goals: [{ type: 'clear_paths', count: 5 }] }), small);
    const g = s.grid;
    const H = g.h;
    for (let x = 1; x < g.w; x++) g.set(x, H - 1, 2);
    g.set(0, H - 1, 1);
    for (let x = 0; x < g.w; x++) g.set(x, H - 2, 1);
    g.set(0, H - 3, 2); // falls into the gap after the first clear
    const ev = collect(s);
    s.runUntilSettled();
    const cleared = ev.filter((e) => e.type === 'cleared');
    expect(cleared.map((e) => (e.type === 'cleared' ? e.chain : 0))).toEqual([1, 2]);
    expect(s.score).toBe((17 + 100) * 1 + (16 + 100) * 2);
    expect(s.bestChain).toBe(2);
    expect(s.goals.goals[0].current).toBe(2);
  });

  it('deals shapes from a fair bag and colours twice each', () => {
    const bag = new PieceBag(new Rng(5), { colors: [1, 2, 3] });
    for (let round = 0; round < 3; round++) {
      const kinds = new Set<string>();
      for (let i = 0; i < 7; i++) kinds.add(bag.next().kind);
      expect(kinds.size).toBe(7);
    }
    const cbag = new PieceBag(new Rng(9), { colors: [1, 2, 3], kinds: ['O'] });
    const colors = Array.from({ length: 6 }, () => cbag.next().color).sort();
    expect(colors).toEqual([1, 1, 2, 2, 3, 3]);
  });

  it('retries keep the board but change the deal', () => {
    const lvl = makeLevel({ prefill: { type: 'random', rows: 8 }, colors: [1, 2, 3] });
    const a = new Session(lvl, { attempt: 0 });
    const b = new Session(lvl, { attempt: 1 });
    expect(Array.from(a.grid.color)).toEqual(Array.from(b.grid.color));
    expect(a.tray).not.toEqual(b.tray);
  });

  it('pieces left counts down', () => {
    const s = new Session(makeLevel({ pieceLimit: 4, pieces: ['O'] }), { gridW: 32, gridH: 32 });
    expect(s.piecesLeft).toBe(4);
    s.drop(0, 0);
    expect(s.piecesLeft).toBe(3);
  });
});
