import { describe, expect, it } from 'vitest';
import { Rng } from '../src/core/rng';
import { FLAG_FALLING, SandGrid } from '../src/engine/grid';
import { dropHeight, pieceShape, stamp, type Piece } from '../src/engine/pieces';
import { settle, step } from '../src/engine/sim';

const O: Piece = { kind: 'O', rot: 0, color: 1, special: null, specialCell: -1 };

describe('rigid falling piece', () => {
  it('keeps its block shape while falling through empty space', () => {
    const g = new SandGrid(16, 40);
    expect(stamp(g, O, 4, 0, new Rng(1), FLAG_FALLING)).toBe(true);
    for (let n = 0; n < 10; n++) step(g, new Rng(n));
    // O piece = 8×8 grains, now 10 rows lower and still a solid square.
    for (let y = 10; y < 18; y++) for (let x = 4; x < 12; x++) expect(g.get(x, y)).toBe(1);
    expect(g.get(4, 9)).toBe(0);
  });

  it('turns into loose sand once it lands', () => {
    const g = new SandGrid(16, 20);
    stamp(g, O, 4, 0, new Rng(1), FLAG_FALLING);
    settle(g, new Rng(2));
    let flagged = 0;
    for (let i = 0; i < g.size; i++) if (g.flags[i] & FLAG_FALLING) flagged++;
    expect(flagged).toBe(0);
    expect(g.countColor(1)).toBe(64);
    // Landed on the floor and crumbled: the bottom row is wider than the piece.
    let bottom = 0;
    for (let x = 0; x < 16; x++) if (g.get(x, 19) === 1) bottom++;
    expect(bottom).toBeGreaterThan(8);
  });
});

describe('dropHeight', () => {
  it('returns the aimed row when the column below the top is clear', () => {
    const g = new SandGrid(16, 40);
    expect(dropHeight(g, pieceShape(O), 0, 12)).toBe(12);
  });

  it('stops above sand in the way', () => {
    const g = new SandGrid(16, 40);
    for (let x = 0; x < 16; x++) g.set(x, 20, 2);
    // 8-grain-tall piece must end at row 12 at the latest (rows 12..19).
    expect(dropHeight(g, pieceShape(O), 0, 30)).toBe(12);
  });

  it('cannot tuck a piece under an overhang', () => {
    const g = new SandGrid(16, 40);
    for (let x = 0; x < 8; x++) g.set(x, 15, 2); // a ledge, empty space below it
    // Aiming below the ledge still stops on top of it (rows 7..14), never under it.
    expect(dropHeight(g, pieceShape(O), 0, 30)).toBe(7);
  });

  it('is -1 when the piece does not fit at the top', () => {
    const g = new SandGrid(16, 40);
    g.set(1, 0, 2);
    expect(dropHeight(g, pieceShape(O), 0, 10)).toBe(-1);
  });
});
