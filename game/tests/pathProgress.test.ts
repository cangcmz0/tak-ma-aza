import { describe, expect, it } from 'vitest';
import { JOKER, SandGrid } from '../src/engine/grid';
import { computePathProgress, PathProgressScanner } from '../src/game/pathProgress';

function row(g: SandGrid, y: number, color: number, from = 0, to = g.w) {
  for (let x = from; x < to; x++) g.set(x, y, color);
}

describe('computePathProgress', () => {
  it('reports how far a left-wall region reaches', () => {
    const g = new SandGrid(20, 6);
    row(g, 5, 2, 0, 12);
    const [p] = computePathProgress(g, [2]);
    expect(p.color).toBe(2);
    expect(p.leftReach).toBe(11);
    expect(p.leftRow).toBe(5);
    expect(p.rightReach).toBe(20);
    expect(p.frac).toBeCloseTo(12 / 20);
  });

  it('adds the region growing from the right wall', () => {
    const g = new SandGrid(20, 6);
    row(g, 5, 1, 0, 8);
    row(g, 4, 1, 15, 20);
    const [p] = computePathProgress(g, [1]);
    expect(p.leftReach).toBe(7);
    expect(p.rightReach).toBe(15);
    expect(p.rightRow).toBe(4);
    expect(p.frac).toBeCloseTo((8 + 5) / 20);
  });

  it('follows bends and lets jokers bridge, like the clear rule', () => {
    const g = new SandGrid(10, 6);
    row(g, 5, 3, 0, 4);
    g.set(3, 4, 3);
    g.set(4, 4, JOKER);
    row(g, 4, 3, 5, 7);
    const [p] = computePathProgress(g, [3]);
    expect(p.leftReach).toBe(6);
    expect(p.leftRow).toBe(4);
  });

  it('a full wall-to-wall path is 100 %', () => {
    const g = new SandGrid(12, 4);
    row(g, 3, 2);
    const [p] = computePathProgress(g, [2]);
    expect(p.leftReach).toBe(11);
    expect(p.rightReach).toBe(0);
    expect(p.frac).toBe(1);
  });

  it('ignores other colours, joker-only regions and regions away from the walls', () => {
    const g = new SandGrid(12, 4);
    row(g, 3, 1, 0, 5);
    row(g, 2, JOKER, 0, 6);
    row(g, 0, 2, 3, 9); // touches neither wall (row 1 stays empty)
    const [p1, p2] = computePathProgress(g, [2, 1]);
    expect(p1.color).toBe(2);
    expect(p1.leftReach).toBe(-1);
    expect(p1.rightReach).toBe(12);
    expect(p1.frac).toBe(0);
    // Pepper region + jokers on top reach column 5.
    expect(p2.leftReach).toBe(5);
  });

  it('scanner reuses its buffers across grids of different sizes', () => {
    const sc = new PathProgressScanner();
    const a = new SandGrid(8, 4);
    row(a, 3, 1, 0, 3);
    expect(sc.scan(a, [1])[0].leftReach).toBe(2);
    const b = new SandGrid(16, 8);
    row(b, 7, 1, 0, 10);
    expect(sc.scan(b, [1])[0].leftReach).toBe(9);
  });
});
