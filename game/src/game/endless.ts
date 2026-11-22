// Endless mode "Serbest Tezgâh" (GDD §6): no piece limit, no goals, chase a high score.
// Colours and special chances ramp up with the score; no shelves, sacks or two-colour pieces.
import { BLOCK } from '../config';
import { Rng } from '../core/rng';
import { ClearResult, findClears, removeMarked } from '../engine/clear';
import type { SandGrid } from '../engine/grid';
import { maxX, PieceBag, pieceShape, stamp } from '../engine/pieces';
import { settle } from '../engine/sim';
import type { LevelDef } from '../levels/schema';

/** Pieces dropped onto the empty board before play starts. */
export const ENDLESS_PREFILL_PIECES = 9;

export interface EndlessParams {
  colors: number[];
  bombChance: number;
  jokerChance: number;
}

/** Difficulty for a given score (GDD §6 table). */
export function endlessParams(score: number): EndlessParams {
  const colors = score >= 8000 ? [1, 2, 3, 4, 5] : score >= 3000 ? [1, 2, 3, 4] : [1, 2, 3];
  return { colors, bombChance: score >= 2000 ? 0.05 : 0, jokerChance: score >= 5000 ? 0.03 : 0 };
}

/** Synthetic level definition used by a Session in endless mode. */
export function makeEndlessLevel(seed: number): LevelDef {
  const p = endlessParams(0);
  return {
    id: 0,
    name: 'Serbest Tezgâh',
    colors: p.colors,
    pieceLimit: null,
    goals: [],
    stars: [0, 0, 0],
    prefill: { type: 'none' },
    obstacles: [],
    specials: { bombChance: p.bombChance, jokerChance: p.jokerChance, twoColorChance: 0 },
    seed: seed >>> 0,
    scriptedPieces: [],
    tutorial: null,
    intro: [],
    customer: 'ayse',
  };
}

/** Empty board + ENDLESS_PREFILL_PIECES random pieces settled at the bottom, no ready paths. */
export function buildEndlessBoard(g: SandGrid, level: LevelDef, rng: Rng, clear: ClearResult): void {
  g.reset();
  const bag = new PieceBag(new Rng(rng.int(0x7fffffff)), { colors: level.colors });
  for (let n = 0; n < ENDLESS_PREFILL_PIECES; n++) {
    const p = bag.next();
    const cols = maxX(g, pieceShape(p)) / BLOCK;
    stamp(g, p, rng.int(cols + 1) * BLOCK, 0, rng);
    settle(g, rng);
  }
  for (let k = 0; k < 10 && findClears(g, clear) > 0; k++) {
    removeMarked(g, clear);
    settle(g, rng);
  }
  clear.reset();
}
