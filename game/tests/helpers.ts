import { SUB } from '../src/config';
import type { SandGrid } from '../src/engine/grid';
import type { LevelDef } from '../src/levels/schema';

export function makeLevel(over: Partial<LevelDef> = {}): LevelDef {
  return {
    id: 1,
    name: 'Test',
    colors: [1, 2],
    pieceLimit: 10,
    goals: [{ type: 'clear_paths', count: 1 }],
    stars: [10, 20, 30],
    prefill: { type: 'none' },
    obstacles: [],
    specials: { bombChance: 0, jokerChance: 0, twoColorChance: 0 },
    seed: 42,
    scriptedPieces: [],
    tutorial: null,
    intro: [],
    customer: 'ayse',
    ...over,
  };
}

/** Cells per design grain along one axis (tests write geometry in design grains). */
export const S = SUB;

/** Paint one design grain (S×S cells) at design coordinates (x, y). */
export function setGrain(g: SandGrid, x: number, y: number, color: number, shade = 0, flags = 0): void {
  for (let dy = 0; dy < S; dy++) for (let dx = 0; dx < S; dx++) g.set(x * S + dx, y * S + dy, color, shade, flags);
}

/** Design-grain row of a grid (for grids sized in cells). */
export function designH(g: SandGrid): number {
  return g.h / S;
}

export function designW(g: SandGrid): number {
  return g.w / S;
}
