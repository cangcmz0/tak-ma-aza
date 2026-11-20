import { describe, expect, it } from 'vitest';
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
    expect(s.score).toBe(4 * 16); // 4 blocks × 16 grains
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

  it('chain multiplies points and resets on drop', () => {
    const s = new Session(makeLevel({ colors: [1], pieces: ['I'], pieceLimit: 5, goals: [{ type: 'clear_paths', count: 5 }] }), small);
    s.tray[0]!.rot = 0;
    s.drop(0, 0);
    s.runUntilSettled();
    expect(s.chain).toBe(1);
    expect(s.score).toBe(64);
    const slot = s.tray.findIndex((t) => t);
    s.tray[slot]!.rot = 0;
    s.drop(slot, 0);
    expect(s.chain).toBe(0);
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
    expect(s.score).toBe(17 * 1 + 16 * 2);
    expect(s.bestChain).toBe(2);
    expect(s.goals.goals[0].current).toBe(2);
  });

  it('pieces left counts down', () => {
    const s = new Session(makeLevel({ pieceLimit: 4, pieces: ['O'] }), { gridW: 32, gridH: 32 });
    expect(s.piecesLeft).toBe(4);
    s.drop(0, 0);
    expect(s.piecesLeft).toBe(3);
  });
});
