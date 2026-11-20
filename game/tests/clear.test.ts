import { describe, expect, it } from 'vitest';
import { ClearResult, findClears, removeMarked } from '../src/engine/clear';
import { FLAG_BOMB, SandGrid } from '../src/engine/grid';

function row(g: SandGrid, y: number, color: number, from = 0, to = g.w) {
  for (let x = from; x < to; x++) g.set(x, y, color);
}

describe('findClears', () => {
  it('detects a left-to-right same-colour connection', () => {
    const g = new SandGrid(8, 4);
    row(g, 3, 1);
    const res = ClearResult.for(g);
    expect(findClears(g, res)).toBe(1);
    expect(res.regionColor[0]).toBe(1);
    expect(res.cellCount).toBe(8);
  });

  it('follows bends (4-neighbourhood)', () => {
    const g = new SandGrid(6, 4);
    row(g, 3, 2, 0, 3);
    g.set(2, 2, 2);
    row(g, 1, 2, 2, 6);
    const res = ClearResult.for(g);
    expect(findClears(g, res)).toBe(1);
    expect(res.cellCount).toBe(3 + 1 + 4);
  });

  it('does not clear a region that misses the right wall', () => {
    const g = new SandGrid(8, 4);
    row(g, 3, 1, 0, 7);
    const res = ClearResult.for(g);
    expect(findClears(g, res)).toBe(0);
    expect(res.cellCount).toBe(0);
  });

  it('does not connect through a different colour', () => {
    const g = new SandGrid(8, 4);
    row(g, 3, 1);
    g.set(4, 3, 2);
    expect(findClears(g, ClearResult.for(g))).toBe(0);
  });

  it('does not connect diagonally', () => {
    const g = new SandGrid(4, 4);
    row(g, 3, 1, 0, 2);
    row(g, 2, 1, 2, 4);
    expect(findClears(g, ClearResult.for(g))).toBe(0);
  });

  it('ignores stone', () => {
    const g = new SandGrid(4, 2);
    for (let x = 0; x < 4; x++) g.setStone(x, 1);
    expect(findClears(g, ClearResult.for(g))).toBe(0);
  });

  it('finds multiple paths and counts grains per colour', () => {
    const g = new SandGrid(5, 4);
    row(g, 3, 1);
    row(g, 1, 2);
    const res = ClearResult.for(g);
    expect(findClears(g, res)).toBe(2);
    expect(res.colorCounts[1]).toBe(5);
    expect(res.colorCounts[2]).toBe(5);
  });

  it('removeMarked empties exactly the path cells', () => {
    const g = new SandGrid(5, 3);
    row(g, 2, 1);
    g.set(0, 1, 2);
    const res = ClearResult.for(g);
    findClears(g, res);
    removeMarked(g, res);
    expect(g.countColor(1)).toBe(0);
    expect(g.get(0, 1)).toBe(2);
  });

  it('a bomb grain in a path also clears nearby grains', () => {
    const g = new SandGrid(20, 20);
    row(g, 19, 1);
    g.set(10, 19, 1, 0, FLAG_BOMB);
    g.set(10, 17, 2); // near the bomb, not part of the path
    g.set(0, 0, 2); // far away
    const res = ClearResult.for(g);
    expect(findClears(g, res)).toBe(1);
    expect(res.pathCellCount).toBe(20);
    expect(res.marked[g.idx(10, 17)]).toBe(1);
    expect(res.marked[g.idx(0, 0)]).toBe(0);
  });
});
