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
    specials: { bombChance: 0 },
    seed: 42,
    ...over,
  };
}
