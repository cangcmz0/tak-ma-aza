import { describe, expect, it } from 'vitest';
import { BLOCK } from '../src/config';
import { Rng } from '../src/core/rng';
import { SandGrid } from '../src/engine/grid';
import {
  canStamp,
  fitsAnywhere,
  normalize,
  PIECE_KINDS,
  pieceShape,
  ROTATIONS,
  rotatePiece,
  rotateShape,
  stamp,
  type Piece,
} from '../src/engine/pieces';

const piece = (over: Partial<Piece> = {}): Piece => ({ kind: 'T', rot: 0, color: 1, special: null, specialCell: -1, ...over });

describe('pieces', () => {
  it('rotating 4 times returns the original shape', () => {
    for (const k of PIECE_KINDS) {
      const s0 = ROTATIONS[k][0];
      let s = s0;
      for (let i = 0; i < 4; i++) s = rotateShape(s);
      expect(s).toEqual(s0);
    }
  });

  it('rotatePiece cycles rot 0..3', () => {
    const p = piece();
    for (let i = 0; i < 4; i++) rotatePiece(p);
    expect(p.rot).toBe(0);
    expect(pieceShape(p)).toEqual(ROTATIONS.T[0]);
  });

  it('rotation swaps width and height', () => {
    const i0 = ROTATIONS.I[0];
    const i1 = ROTATIONS.I[1];
    expect([i0.w, i0.h]).toEqual([4, 1]);
    expect([i1.w, i1.h]).toEqual([1, 4]);
  });

  it('normalize shifts to origin', () => {
    const s = normalize([[2, 3], [3, 3]]);
    expect(s.cells).toEqual([[0, 0], [1, 0]]);
    expect([s.w, s.h]).toEqual([2, 1]);
  });

  it('every tetromino has 4 blocks', () => {
    for (const k of PIECE_KINDS) for (const s of ROTATIONS[k]) expect(s.cells.length).toBe(4);
  });

  it('stamp writes BLOCK×BLOCK grains per cell', () => {
    const g = new SandGrid(24, 24);
    expect(stamp(g, piece({ kind: 'O', color: 2 }), 0, 0, new Rng(1))).toBe(true);
    expect(g.countColor(2)).toBe(4 * BLOCK * BLOCK);
  });

  it('stamp refuses overlap and writes nothing', () => {
    const g = new SandGrid(24, 24);
    g.set(1, 1, 3);
    const before = Array.from(g.color);
    expect(stamp(g, piece({ kind: 'O' }), 0, 0, new Rng(1))).toBe(false);
    expect(Array.from(g.color)).toEqual(before);
  });

  it('canStamp rejects out of bounds', () => {
    const g = new SandGrid(16, 16);
    const s = ROTATIONS.I[0]; // 16 grains wide
    expect(canStamp(g, s, 0, 0)).toBe(true);
    expect(canStamp(g, s, 1, 0)).toBe(false);
    expect(canStamp(g, s, -1, 0)).toBe(false);
  });

  it('fitsAnywhere is false when the top rows are blocked', () => {
    const g = new SandGrid(16, 16);
    expect(fitsAnywhere(g, piece())).toBe(true);
    for (let x = 0; x < 16; x += 3) g.set(x, 0, 1);
    expect(fitsAnywhere(g, piece())).toBe(false);
  });

  it('bomb special flags exactly one block', () => {
    const g = new SandGrid(24, 24);
    stamp(g, piece({ kind: 'I', special: 'bomb', specialCell: 2 }), 0, 0, new Rng(1));
    let flagged = 0;
    for (let i = 0; i < g.size; i++) if (g.flags[i]) flagged++;
    expect(flagged).toBe(BLOCK * BLOCK);
  });
});
