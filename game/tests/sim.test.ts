import { describe, expect, it } from 'vitest';
import { Rng } from '../src/core/rng';
import { SandGrid, STONE } from '../src/engine/grid';
import { settle, step } from '../src/engine/sim';

describe('sand sim', () => {
  it('a grain falls straight down to the floor', () => {
    const g = new SandGrid(5, 6);
    g.set(2, 0, 1);
    settle(g, new Rng(1));
    expect(g.get(2, 5)).toBe(1);
    expect(g.countColor(1)).toBe(1);
  });

  it('a grain on top of another slides diagonally', () => {
    const g = new SandGrid(3, 2);
    g.set(1, 1, 1);
    g.set(1, 0, 2);
    const moved = step(g, new Rng(3));
    expect(moved).toBe(1);
    expect(g.get(1, 0)).toBe(0);
    expect(g.get(0, 1) === 2 || g.get(2, 1) === 2).toBe(true);
  });

  it('slides to the only free diagonal side', () => {
    const g = new SandGrid(3, 2);
    g.set(1, 1, 1);
    g.set(0, 1, 1);
    g.set(1, 0, 2);
    step(g, new Rng(5));
    expect(g.get(2, 1)).toBe(2);
  });

  it('stays put when fully supported', () => {
    const g = new SandGrid(3, 2);
    g.set(0, 1, 1);
    g.set(1, 1, 1);
    g.set(2, 1, 1);
    g.set(1, 0, 2);
    expect(step(g, new Rng(1))).toBe(0);
    expect(g.get(1, 0)).toBe(2);
  });

  it('stone cells never fall', () => {
    const g = new SandGrid(4, 6);
    g.setStone(1, 1);
    settle(g, new Rng(1));
    expect(g.get(1, 1)).toBe(STONE);
    expect(g.get(1, 5)).toBe(0);
  });

  it('sand rests on stone', () => {
    const g = new SandGrid(3, 6);
    g.setStone(0, 3);
    g.setStone(1, 3);
    g.setStone(2, 3);
    g.set(1, 0, 1);
    settle(g, new Rng(1));
    expect(g.get(1, 2)).toBe(1);
  });

  it('carries shade and flags with the grain', () => {
    const g = new SandGrid(1, 3);
    g.set(0, 0, 3, 2, 2);
    settle(g, new Rng(1));
    const i = g.idx(0, 2);
    expect(g.color[i]).toBe(3);
    expect(g.shade[i]).toBe(2);
    expect(g.flags[i]).toBe(2);
  });

  it('reports settled (0 moves) and conserves grains', () => {
    const g = new SandGrid(16, 16);
    const r = new Rng(9);
    for (let i = 0; i < 60; i++) g.set(r.int(16), r.int(8), 1 + r.int(3));
    const before = g.countColor(1) + g.countColor(2) + g.countColor(3);
    expect(settle(g, r)).toBe(true);
    expect(step(g, r)).toBe(0);
    expect(g.countColor(1) + g.countColor(2) + g.countColor(3)).toBe(before);
  });

  it('is deterministic for a given rng seed', () => {
    const mk = () => {
      const g = new SandGrid(12, 12);
      for (let x = 3; x < 9; x++) for (let y = 0; y < 4; y++) g.set(x, y, 1 + (x % 2));
      settle(g, new Rng(77));
      return Array.from(g.color);
    };
    expect(mk()).toEqual(mk());
  });
});
