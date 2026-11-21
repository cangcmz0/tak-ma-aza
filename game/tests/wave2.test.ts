import { describe, expect, it } from 'vitest';
import { CHAIN_RESET_ON_DROP, DANGER_ROWS, HELP_LOSS_STREAK } from '../src/config';
import type { SessionEvent } from '../src/core/events';
import { Rng } from '../src/core/rng';
import { ClearResult, findClears } from '../src/engine/clear';
import { FLAG_BOMB, JOKER, SandGrid } from '../src/engine/grid';
import { blockColor, colorCopies, PieceBag, rotatePiece, stamp, type Piece } from '../src/engine/pieces';
import { endlessParams, makeEndlessLevel, ENDLESS_PREFILL_PIECES } from '../src/game/endless';
import { findHintMove } from '../src/game/hintMove';
import { goalColors, scriptedToPiece, Session, shouldHelp } from '../src/game/session';
import { validateLevel } from '../src/levels/schema';
import { makeLevel } from './helpers';

const small = { gridW: 16, gridH: 24 };

function collect(s: Session): SessionEvent[] {
  const ev: SessionEvent[] = [];
  s.events.on((e) => ev.push(e));
  return ev;
}

describe('two-colour pieces (İkili Kese, GDD §5.5)', () => {
  it('splits cells 0-1 / 2-3 and keeps the split when rotating', () => {
    const p: Piece = { kind: 'I', rot: 0, color: 1, color2: 2, special: null, specialCell: -1 };
    expect([0, 1, 2, 3].map((c) => blockColor(p, c))).toEqual([1, 1, 2, 2]);
    const g = new SandGrid(16, 16);
    stamp(g, p, 0, 0, new Rng(1));
    expect(g.get(0, 0)).toBe(1); // I: left two blocks colour A
    expect(g.get(15, 0)).toBe(2); // right two colour B
    rotatePiece(p);
    const g2 = new SandGrid(16, 16);
    stamp(g2, p, 0, 0, new Rng(1));
    expect(g2.get(0, 0)).toBe(1); // vertical I: top two A (cells keep their order)
    expect(g2.get(0, 15)).toBe(2);
    expect(g2.countColor(1)).toBe(32);
    const o: Piece = { kind: 'O', rot: 0, color: 3, color2: 4, special: null, specialCell: -1 };
    const g3 = new SandGrid(8, 8);
    stamp(g3, o, 0, 0, new Rng(1));
    expect(g3.get(0, 0)).toBe(3); // O: top A
    expect(g3.get(0, 7)).toBe(4); // bottom B
  });

  it('twoColorChance deals pieces with a second, different colour', () => {
    const bag = new PieceBag(new Rng(11), { colors: [1, 2, 3], twoColorChance: 1 });
    for (let i = 0; i < 12; i++) {
      const p = bag.next();
      expect(p.color2).toBeTruthy();
      expect(p.color2).not.toBe(p.color);
    }
    const mono = new PieceBag(new Rng(11), { colors: [1], twoColorChance: 1 });
    expect(mono.next().color2 ?? null).toBeNull();
  });

  it('existing levels deal exactly as before when the new chances are 0', () => {
    const a = new PieceBag(new Rng(5), { colors: [1, 2, 3], bombChance: 0.3 });
    const b = new PieceBag(new Rng(5), { colors: [1, 2, 3], bombChance: 0.3, jokerChance: 0, twoColorChance: 0 });
    for (let i = 0; i < 20; i++) expect(a.next()).toEqual(b.next());
  });
});

describe('scriptedPieces', () => {
  it('deals the scripted pieces first, then continues from the bag', () => {
    const lvl = makeLevel({
      colors: [1, 2, 3],
      pieceLimit: 10,
      scriptedPieces: [
        { shape: 'O', color: 2 },
        { shape: 'I', color: 1, rot: 1, bomb: 3 },
        { shape: 'T', color: 3, joker: 0 },
        { shape: 'L', color: 1, colors: [1, 3] },
      ],
    });
    for (const attempt of [0, 1]) {
      const s = new Session(lvl, { ...small, attempt });
      expect(s.tray.map((p) => p && p.kind)).toEqual(['O', 'I', 'T']);
      expect(s.tray[0]).toMatchObject({ color: 2, rot: 0, special: null });
      expect(s.tray[1]).toMatchObject({ color: 1, rot: 1, special: 'bomb', specialCell: 3 });
      expect(s.tray[2]).toMatchObject({ jokerCell: 0 });
    }
    const s = new Session(lvl, { gridW: 32, gridH: 48 });
    s.drop(0, 0);
    s.drop(1, 12);
    s.drop(2, 20);
    expect(s.tray[0]).toMatchObject({ kind: 'L', color: 1, color2: 3 });
    expect(s.tray[1]).not.toBeNull();
  });

  it('converts and validates scripted entries', () => {
    expect(scriptedToPiece({ shape: 'S', color: 4, rot: 6 })).toMatchObject({ kind: 'S', rot: 2, color: 4, specialCell: -1, jokerCell: -1 });
    const base = { id: 1, name: 's', colors: [1, 2], goals: [{ type: 'score', value: 1 }], stars: [1, 2, 3], pieceLimit: 2 };
    expect(validateLevel({ ...base, scriptedPieces: [{ shape: 'O', color: 1 }] }).ok).toBe(true);
    expect(validateLevel({ ...base, scriptedPieces: [{ shape: 'O', colors: [1, 2] }] }).ok).toBe(true);
    const bad = validateLevel({
      ...base,
      scriptedPieces: [{ shape: 'Q', color: 1 }, { shape: 'O', color: 9, bomb: 4 }, { shape: 'O', color: 1 }],
    });
    expect(bad.ok).toBe(false);
    if (!bad.ok) expect(bad.errors.length).toBeGreaterThanOrEqual(4); // shape, colour, bomb, > pieceLimit
  });
});

describe('help rule (GDD §4.2)', () => {
  it('is active on every 3rd consecutive loss, for one attempt', () => {
    expect(HELP_LOSS_STREAK).toBe(3);
    expect([0, 1, 2, 3, 4, 5, 6].map(shouldHelp)).toEqual([false, false, false, true, false, false, true]);
  });

  it('gives goal colours weight ×1.5 (3 copies instead of 2 per colour bag)', () => {
    expect(colorCopies(1)).toBe(2);
    expect(colorCopies(1.5)).toBe(3);
    const bag = new PieceBag(new Rng(4), { colors: [1, 2, 3], kinds: ['O'], colorWeights: { 2: 1.5 } });
    const colors = Array.from({ length: 7 }, () => bag.next().color).sort();
    expect(colors).toEqual([1, 1, 2, 2, 2, 3, 3]);
  });

  it('sessions only help when the level has goal colours', () => {
    const colored = makeLevel({ colors: [1, 2, 3], goals: [{ type: 'clear_color_grains', color: 3, count: 10 }] });
    expect(goalColors(colored)).toEqual([3]);
    expect(new Session(colored, { ...small, help: true }).helped).toBe(true);
    expect(new Session(colored, small).helped).toBe(false);
    expect(new Session(makeLevel(), { ...small, help: true }).helped).toBe(false);
  });
});

describe('chain and juice events', () => {
  it('chain no longer resets on drop (GDD §4.7)', () => {
    expect(CHAIN_RESET_ON_DROP).toBe(false);
    const s = new Session(makeLevel({ colors: [1, 2], pieces: ['O'], goals: [{ type: 'clear_paths', count: 9 }] }), { gridW: 32, gridH: 48 });
    s.chain = 2; // mid-cascade
    s.drop(0, 0);
    expect(s.chain).toBe(2);
  });

  it('emits double, chainWord, cleared details and grainsToGoal', () => {
    const s = new Session(
      makeLevel({ colors: [1, 2], goals: [{ type: 'clear_color_grains', color: 2, count: 999 }, { type: 'clear_paths', count: 9 }] }),
      small,
    );
    const g = s.grid;
    for (let x = 0; x < g.w; x++) g.set(x, g.h - 1, 1);
    for (let x = 0; x < g.w; x++) g.set(x, g.h - 2, 2);
    const ev = collect(s);
    s.runUntilSettled();
    const types = ev.map((e) => e.type);
    expect(types).toContain('double');
    expect(types).toContain('chainWord');
    const fly = ev.find((e) => e.type === 'grainsToGoal');
    expect(fly && fly.type === 'grainsToGoal' && fly.goal).toBe(0);
    if (fly && fly.type === 'grainsToGoal') {
      expect(fly.total).toBe(16);
      expect(fly.cells.length).toBeGreaterThan(0);
      expect(fly.cells.length).toBeLessThanOrEqual(24);
      for (const i of fly.cells) expect(Math.floor(i / g.w)).toBe(g.h - 2);
    }
    const c = ev.find((e) => e.type === 'cleared');
    expect(c && c.type === 'cleared' && [...(c.colors ?? [])].sort()).toEqual([1, 2]);
    expect(c && c.type === 'cleared' && c.cy).toBeCloseTo(g.h - 1.5);
    expect(types.indexOf('grainsToGoal')).toBeLessThan(types.indexOf('cleared'));
    const word = ev.find((e) => e.type === 'chainWord');
    expect(word && word.type === 'chainWord' && word.chain).toBe(2);
  });

  it('emits bomb and joker events', () => {
    const s = new Session(makeLevel({ colors: [1, 2], goals: [{ type: 'clear_paths', count: 9 }] }), small);
    const g = s.grid;
    for (let x = 0; x < g.w; x++) g.set(x, g.h - 1, x === 3 ? JOKER : 1);
    g.flags[(g.h - 1) * g.w + 8] = FLAG_BOMB;
    g.set(8, g.h - 6, 2); // inside the blast radius
    const ev = collect(s);
    s.runUntilSettled();
    expect(ev.find((e) => e.type === 'joker')).toMatchObject({ grains: 1 });
    const b = ev.find((e) => e.type === 'bomb');
    expect(b).toMatchObject({ x: 8, y: g.h - 1 });
    expect(b && b.type === 'bomb' && b.grains).toBeGreaterThanOrEqual(1);
  });

  it('warns once when settled sand reaches the danger rows', () => {
    const s = new Session(makeLevel({ colors: [1, 2], pieceLimit: 30, goals: [{ type: 'clear_paths', count: 9 }] }), small);
    const g = s.grid;
    const ev = collect(s);
    // Checkerboard (never a path) filling the board up to DANGER_ROWS - 2 from the top.
    for (let y = DANGER_ROWS - 2; y < g.h; y++) for (let x = 0; x < g.w; x++) g.set(x, y, 1 + ((x + y) % 2));
    s.wake();
    s.runUntilSettled();
    const d = ev.filter((e) => e.type === 'danger');
    expect(d[0]).toEqual({ type: 'danger', on: true, first: true });
    expect(s.danger).toBe(true);
  });
});

describe('endless mode (GDD §6)', () => {
  it('ramps colours and specials with the score', () => {
    expect(endlessParams(0)).toEqual({ colors: [1, 2, 3], bombChance: 0, jokerChance: 0 });
    expect(endlessParams(2000).bombChance).toBe(0.05);
    expect(endlessParams(3000).colors).toEqual([1, 2, 3, 4]);
    expect(endlessParams(5000).jokerChance).toBe(0.03);
    expect(endlessParams(8000).colors).toEqual([1, 2, 3, 4, 5]);
  });

  it('starts with 9 settled pieces and no ready path, unlimited pieces, never wins', () => {
    const s = new Session(makeEndlessLevel(1234), { endless: true });
    let sand = 0;
    for (let i = 0; i < s.grid.size; i++) if (s.grid.color[i]) sand++;
    expect(sand).toBeGreaterThan(0);
    expect(sand).toBeLessThanOrEqual(ENDLESS_PREFILL_PIECES * 64);
    expect(findClears(s.grid, ClearResult.for(s.grid))).toBe(0);
    expect(s.piecesLeft).toBe(Infinity);
    expect(s.goals.goals.length).toBe(0);
    s.runUntilSettled();
    expect(s.state).toBe('playing'); // empty goal list must not mean "won"
  });

  it('applies the difficulty after a clear raises the score', () => {
    const s = new Session(makeEndlessLevel(9), { endless: true, gridW: 16, gridH: 24 });
    s.grid.reset();
    s.score = 7999;
    for (let x = 0; x < s.grid.w; x++) s.grid.set(x, s.grid.h - 1, 1);
    s.wake();
    s.runUntilSettled();
    expect(s.dealOptions.colors).toEqual([1, 2, 3, 4, 5]);
    expect(s.dealOptions.bombChance).toBe(0.05);
    expect(s.dealOptions.jokerChance).toBe(0.03);
  });

  it('ends only when no piece fits', () => {
    const s = new Session(makeEndlessLevel(5), { endless: true, gridW: 16, gridH: 24 });
    for (let x = 0; x < s.grid.w; x += 3) s.grid.set(x, 0, 255, 0, 1);
    s.wake();
    s.runUntilSettled();
    expect(s.state).toBe('lost');
    expect(s.loseReason).toBe('no_space');
  });
});

describe('external session actions (economy wave)', () => {
  it('addPieces raises the budget and refills an empty tray', () => {
    const s = new Session(makeLevel({ pieceLimit: 1, pieces: ['O'], goals: [{ type: 'clear_paths', count: 9 }] }), { gridW: 32, gridH: 32 });
    s.drop(0, 0);
    expect(s.tray.every((t) => t === null)).toBe(true);
    s.addPieces(5);
    expect(s.piecesLeft).toBe(5);
    expect(s.tray.filter((t) => t).length).toBe(3);
  });

  it('rerollTray replaces tray pieces without using the limit', () => {
    const s = new Session(makeLevel({ colors: [1, 2, 3], pieceLimit: 9 }), small);
    const before = s.tray.map((p) => ({ ...p }));
    const ev = collect(s);
    expect(s.rerollTray()).toBe(true);
    expect(s.tray).not.toEqual(before);
    expect(s.piecesLeft).toBe(9);
    expect(ev.map((e) => e.type)).toContain('trayRerolled');
  });

  it('scoopColumns removes sand, scores 1/grain and feeds colour goals', () => {
    const s = new Session(makeLevel({ colors: [1, 2], goals: [{ type: 'clear_color_grains', color: 2, count: 8 }] }), small);
    const g = s.grid;
    for (let y = g.h - 4; y < g.h; y++) for (let x = 0; x < 8; x++) g.set(x, y, x < 4 ? 1 : 2);
    expect(s.scoopColumns(4, 4)).toBe(16);
    expect(s.score).toBe(16);
    expect(s.goals.goals[0].current).toBe(16);
    expect(g.countColor(2)).toBe(0);
  });
});

describe('tutorial hint move', () => {
  it('finds the drop that completes a path', () => {
    const s = new Session(makeLevel({ colors: [1, 2], pieces: ['O'], scriptedPieces: [{ shape: 'O', color: 1 }] }), small);
    const g = s.grid;
    // Left half: yellow block with a red floor row; right half empty. A red O (8 grains wide)
    // dropped at x = 8 completes the red floor row from wall to wall.
    for (let y = g.h - 8; y < g.h; y++) for (let x = 0; x < 8; x++) g.set(x, y, y === g.h - 1 ? 1 : 2);
    s.wake();
    const m = findHintMove(s, [0]);
    expect(m).not.toBeNull();
    expect(m!.x).toBe(8);
    expect(m!.clears).toBe(true);
  });
});
