import { describe, expect, it } from 'vitest';
import { SUB as S } from '../src/config';
import { Rng } from '../src/core/rng';
import { FLAG_FALLING, SandGrid } from '../src/engine/grid';
import { dropHeight, pieceShape, stamp, type Piece } from '../src/engine/pieces';
import { settle, step } from '../src/engine/sim';

const O: Piece = { kind: 'O', rot: 0, color: 1, special: null, specialCell: -1 };

describe('rigid falling piece', () => {
  it('keeps its block shape while falling through empty space', () => {
    const g = new SandGrid(16 * S, 40 * S);
    expect(stamp(g, O, 4 * S, 0, new Rng(1), FLAG_FALLING)).toBe(true);
    for (let n = 0; n < 10 * S; n++) step(g, new Rng(n));
    // O piece = 8×8 design grains, now 10 grains lower and still a solid square.
    for (let y = 10 * S; y < 18 * S; y++) for (let x = 4 * S; x < 12 * S; x++) expect(g.get(x, y)).toBe(1);
    expect(g.get(4 * S, 10 * S - 1)).toBe(0);
  });

  it('turns into loose sand once it lands', () => {
    const g = new SandGrid(16 * S, 20 * S);
    stamp(g, O, 4 * S, 0, new Rng(1), FLAG_FALLING);
    settle(g, new Rng(2));
    let flagged = 0;
    for (let i = 0; i < g.size; i++) if (g.flags[i] & FLAG_FALLING) flagged++;
    expect(flagged).toBe(0);
    expect(g.countColor(1)).toBe(64 * S * S);
    // Landed on the floor and crumbled: the bottom row is wider than the piece.
    let bottom = 0;
    for (let x = 0; x < 16 * S; x++) if (g.get(x, 20 * S - 1) === 1) bottom++;
    expect(bottom).toBeGreaterThan(8 * S);
  });
});

describe('dropHeight', () => {
  it('returns the aimed row when the column below the top is clear', () => {
    const g = new SandGrid(16 * S, 40 * S);
    expect(dropHeight(g, pieceShape(O), 0, 12 * S)).toBe(12 * S);
  });

  it('stops above sand in the way', () => {
    const g = new SandGrid(16 * S, 40 * S);
    for (let x = 0; x < 16 * S; x++) g.set(x, 20 * S, 2);
    // 8-grain-tall piece must end at row 12 at the latest (rows 12..19).
    expect(dropHeight(g, pieceShape(O), 0, 30 * S)).toBe(12 * S);
  });

  it('cannot tuck a piece under an overhang', () => {
    const g = new SandGrid(16 * S, 40 * S);
    for (let x = 0; x < 8 * S; x++) g.set(x, 15 * S, 2); // a ledge, empty space below it
    // Aiming below the ledge still stops on top of it (rows 7..14), never under it.
    expect(dropHeight(g, pieceShape(O), 0, 30 * S)).toBe(7 * S);
  });

  it('is -1 when the piece does not fit at the top', () => {
    const g = new SandGrid(16 * S, 40 * S);
    g.set(1, 0, 2);
    expect(dropHeight(g, pieceShape(O), 0, 10)).toBe(-1);
  });
});
