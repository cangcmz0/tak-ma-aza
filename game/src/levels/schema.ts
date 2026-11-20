// Level definition type + runtime validation. Unknown fields are preserved
// (designers may add fields before code supports them).
import { BLOCK, GRID_H, GRID_W } from '../config';
import { MAX_PLAIN_COLOR } from '../engine/grid';
import { PIECE_BLOCKS, PIECE_KINDS, type PieceKind } from '../engine/pieces';
import { validateGoal, type GoalDef } from '../game/goals';

export type GeoUnit = 'block' | 'grain';

export type PrefillDef =
  | { type: 'none' }
  /** Fill the bottom `rows` grain rows with random BLOCK×BLOCK colour clumps. */
  | { type: 'random'; rows: number; density?: number; colors?: number[] }
  /**
   * Bottom-aligned picture. Each row string is either GRID_W/BLOCK chars (one char = one block)
   * or GRID_W chars (one char = one grain). '.' empty, '#' stone, '1'..'9' colour id,
   * other chars via `legend` (value: colour id, "stone" or "joker").
   */
  | { type: 'pattern'; rows: string[]; legend?: Record<string, LegendValue> };

export type LegendValue = number | 'stone' | 'joker';

export type ObstacleType = 'shelf' | 'sack';

/**
 * Rectangular obstacle. Coordinates from the top-left; default unit = block.
 * `type` "shelf" (default) = stone ("Raf"); "sack" = breakable "Çuval" with `hp` 1..3
 * (default size 2×2 blocks).
 */
export interface ObstacleDef {
  type?: ObstacleType;
  x: number;
  y: number;
  w?: number;
  h?: number;
  unit?: GeoUnit;
  /** Sack hit points 1..3 (default 1). */
  hp?: number;
}

export interface SpecialsDef {
  /** Chance (0..1) that a dealt piece carries a bomb block. */
  bombChance: number;
  /** Chance (0..1) that a dealt piece carries one joker block. */
  jokerChance: number;
  /** Chance (0..1) that a dealt piece has two colours. */
  twoColorChance: number;
  [key: string]: unknown;
}

/** A fixed piece dealt at the start of the level (GDD §18.1 `scriptedPieces`). */
export interface ScriptedPieceDef {
  shape: PieceKind;
  /** Colour id (colour A when `colors` is given). */
  color: number;
  rot?: number;
  /** Block index 0..3 carrying a bomb. */
  bomb?: number;
  /** Block index 0..3 made of joker grains. */
  joker?: number;
  /** Two-colour piece: [A, B]. */
  colors?: [number, number];
}

export type CustomerId = 'ayse' | 'mehmet' | 'selim' | 'anna';
export const CUSTOMERS: readonly CustomerId[] = ['ayse', 'mehmet', 'selim', 'anna'];
export type TutorialId = 't1' | 't2' | 't3';
export const TUTORIALS: readonly TutorialId[] = ['t1', 't2', 't3'];

export interface LevelDef {
  id: number;
  name: string;
  /** Sand colour ids used by this level (see render/theme.ts). */
  colors: number[];
  /** Total pieces the player may place; null = unlimited. */
  pieceLimit: number | null;
  goals: GoalDef[];
  /** Score thresholds for 1/2/3 stars (ascending). */
  stars: [number, number, number];
  prefill: PrefillDef;
  obstacles: ObstacleDef[];
  specials: SpecialsDef;
  seed: number;
  /** Optional: restrict the tetromino pool (default: all 7). */
  pieces?: PieceKind[];
  /** Optional: short Turkish hint shown when the level starts. */
  hint?: string;
  /** Fixed first pieces (tutorials / mechanic introductions). Default []. */
  scriptedPieces: ScriptedPieceDef[];
  /** Tutorial scenario id (GDD §13), or null. */
  tutorial: TutorialId | null;
  /** Mechanic intro card ids (GDD §13), shown once each. Default []. */
  intro: string[];
  /** Order card avatar. Default "ayse". */
  customer: CustomerId;
  /** Extra designer fields are kept as-is. */
  [extra: string]: unknown;
}

export type ValidateResult = { ok: true; level: LevelDef } | { ok: false; errors: string[] };

const isInt = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v);
const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);

function validateColorList(v: unknown, path: string, e: string[]): number[] {
  if (!Array.isArray(v) || v.length === 0) {
    e.push(`${path} must be a non-empty array`);
    return [];
  }
  const out: number[] = [];
  for (const c of v) {
    if (!isInt(c) || c < 1 || c > MAX_PLAIN_COLOR) e.push(`${path}: invalid colour ${String(c)}`);
    else out.push(c);
  }
  return out;
}

function validatePrefill(v: unknown, colors: number[], e: string[]): PrefillDef {
  if (v === undefined) return { type: 'none' };
  if (!isObj(v)) {
    e.push('prefill must be an object');
    return { type: 'none' };
  }
  switch (v.type) {
    case 'none':
      return { type: 'none' };
    case 'random': {
      if (!isInt(v.rows) || v.rows < 0 || v.rows > GRID_H) e.push(`prefill.rows must be 0..${GRID_H}`);
      if (v.density !== undefined && (typeof v.density !== 'number' || v.density < 0 || v.density > 1))
        e.push('prefill.density must be 0..1');
      if (v.colors !== undefined) validateColorList(v.colors, 'prefill.colors', e);
      return { ...v } as PrefillDef;
    }
    case 'pattern': {
      const rows = v.rows;
      if (!Array.isArray(rows) || rows.some((r) => typeof r !== 'string')) {
        e.push('prefill.rows must be an array of strings');
        return { type: 'none' };
      }
      const legend = isObj(v.legend) ? v.legend : {};
      const width = (rows[0] as string | undefined)?.length ?? 0;
      const blockW = GRID_W / BLOCK;
      if (rows.length && width !== blockW && width !== GRID_W)
        e.push(`prefill.rows width must be ${blockW} (blocks) or ${GRID_W} (grains), got ${width}`);
      const unitH = width === GRID_W ? 1 : BLOCK;
      if (rows.length * unitH > GRID_H) e.push('prefill.rows: too many rows');
      rows.forEach((r: string, i) => {
        if (r.length !== width) e.push(`prefill.rows[${i}] length ${r.length} != ${width}`);
        for (const ch of r) {
          if (ch === '.' || ch === '#') continue;
          const lv = legend[ch];
          if (lv === 'stone' || lv === 'joker') continue;
          const c = lv !== undefined ? lv : Number(ch);
          if (!isInt(c) || c < 1 || c > MAX_PLAIN_COLOR) e.push(`prefill.rows[${i}]: unknown char '${ch}'`);
          else if (!colors.includes(c)) e.push(`prefill.rows[${i}]: colour ${c} not in level colors`);
        }
      });
      return { ...v } as PrefillDef;
    }
    default:
      e.push(`unknown prefill type: ${String(v.type)}`);
      return { type: 'none' };
  }
}

/** Default sack size: 2×2 blocks (8×8 grains). */
export function obstacleDefaultSize(unit: GeoUnit): number {
  return unit === 'grain' ? 2 * BLOCK : 2;
}

/** Obstacle rectangle in grains (applies type defaults). */
export function obstacleRect(o: ObstacleDef): { x: number; y: number; w: number; h: number } {
  const unit = o.unit ?? 'block';
  const k = unit === 'grain' ? 1 : BLOCK;
  const def = o.type === 'sack' ? obstacleDefaultSize(unit) : 1;
  return { x: o.x * k, y: o.y * k, w: (o.w ?? def) * k, h: (o.h ?? def) * k };
}

function validateScripted(v: unknown, colors: number[], pieceLimit: number | null, e: string[]): ScriptedPieceDef[] {
  if (v === undefined || v === null) return [];
  if (!Array.isArray(v)) {
    e.push('scriptedPieces must be an array');
    return [];
  }
  if (pieceLimit !== null && v.length > pieceLimit) e.push('scriptedPieces: more pieces than pieceLimit');
  const blockIdx = (x: unknown) => x === undefined || (isInt(x) && x >= 0 && x < PIECE_BLOCKS);
  v.forEach((p, i) => {
    const at = `scriptedPieces[${i}]`;
    if (!isObj(p)) {
      e.push(`${at} must be an object`);
      return;
    }
    if (!(PIECE_KINDS as readonly unknown[]).includes(p.shape)) e.push(`${at}.shape must be one of ${PIECE_KINDS.join(',')}`);
    const cs = p.colors;
    if (cs !== undefined) {
      if (!Array.isArray(cs) || cs.length !== 2 || cs.some((c) => !colors.includes(c as number)))
        e.push(`${at}.colors must be two level colours`);
    }
    if (p.color === undefined && cs === undefined) e.push(`${at}.color is required`);
    else if (p.color !== undefined && !colors.includes(p.color as number)) e.push(`${at}.color ${String(p.color)} is not in level colors`);
    if (p.rot !== undefined && !(isInt(p.rot) && p.rot >= 0 && p.rot <= 3)) e.push(`${at}.rot must be 0..3`);
    if (!blockIdx(p.bomb)) e.push(`${at}.bomb must be a block index 0..3`);
    if (!blockIdx(p.joker)) e.push(`${at}.joker must be a block index 0..3`);
  });
  return (v as Record<string, unknown>[]).map((p) => {
    const cs = p.colors as [number, number] | undefined;
    return { ...p, color: (p.color as number | undefined) ?? (cs ? cs[0] : 0) } as ScriptedPieceDef;
  });
}

function validateObstacles(v: unknown, e: string[]): ObstacleDef[] {
  if (v === undefined) return [];
  if (!Array.isArray(v)) {
    e.push('obstacles must be an array');
    return [];
  }
  v.forEach((o, i) => {
    if (!isObj(o) || !isInt(o.x) || !isInt(o.y)) {
      e.push(`obstacles[${i}] needs integer x, y`);
      return;
    }
    const type = o.type ?? 'shelf';
    if (type !== 'shelf' && type !== 'sack') e.push(`obstacles[${i}].type must be shelf|sack`);
    const unit = o.unit ?? 'block';
    if (unit !== 'block' && unit !== 'grain') e.push(`obstacles[${i}].unit must be block|grain`);
    const k = unit === 'grain' ? 1 : BLOCK;
    const defSize = type === 'sack' ? obstacleDefaultSize(unit as GeoUnit) : 1;
    const w = isInt(o.w) ? o.w : defSize;
    const h = isInt(o.h) ? o.h : defSize;
    if (type === 'sack' && o.hp !== undefined && (!isInt(o.hp) || o.hp < 1 || o.hp > 3)) e.push(`obstacles[${i}].hp must be 1..3`);
    if (type !== 'sack' && o.hp !== undefined) e.push(`obstacles[${i}].hp is only valid for sacks`);
    if (o.x < 0 || o.y < 0 || w < 1 || h < 1 || (o.x + w) * k > GRID_W || (o.y + h) * k > GRID_H)
      e.push(`obstacles[${i}] out of bounds`);
  });
  return v as ObstacleDef[];
}

export function validateLevel(raw: unknown): ValidateResult {
  const e: string[] = [];
  if (!isObj(raw)) return { ok: false, errors: ['level must be an object'] };
  const r = raw;
  if (!isInt(r.id) || r.id < 1) e.push('id must be a positive integer');
  if (typeof r.name !== 'string' || !r.name) e.push('name must be a non-empty string');
  const colors = validateColorList(r.colors, 'colors', e);

  let pieceLimit: number | null = null;
  if (r.pieceLimit !== undefined && r.pieceLimit !== null) {
    if (!isInt(r.pieceLimit) || r.pieceLimit < 1) e.push('pieceLimit must be a positive integer or null');
    else pieceLimit = r.pieceLimit;
  }

  if (!Array.isArray(r.goals) || r.goals.length === 0) e.push('goals must be a non-empty array');
  else r.goals.forEach((g, i) => validateGoal(g, colors).forEach((m) => e.push(`goals[${i}]: ${m}`)));

  let stars: [number, number, number] = [0, 0, 0];
  if (!Array.isArray(r.stars) || r.stars.length !== 3 || !r.stars.every((s) => typeof s === 'number' && s >= 0))
    e.push('stars must be 3 non-negative numbers');
  else if (!(r.stars[0] <= r.stars[1] && r.stars[1] <= r.stars[2])) e.push('stars must be ascending');
  else stars = r.stars as [number, number, number];

  const prefill = validatePrefill(r.prefill, colors, e);
  const obstacles = validateObstacles(r.obstacles, e);

  const specials: SpecialsDef = { bombChance: 0, jokerChance: 0, twoColorChance: 0, ...(isObj(r.specials) ? r.specials : {}) };
  for (const k of ['bombChance', 'jokerChance', 'twoColorChance'] as const) {
    const v = specials[k];
    if (typeof v !== 'number' || v < 0 || v > 1) e.push(`specials.${k} must be 0..1`);
  }
  if (Array.isArray(r.goals)) {
    const sacks = obstacles.filter((o) => isObj(o) && o.type === 'sack').length;
    r.goals.forEach((g, i) => {
      if (isObj(g) && g.type === 'clear_obstacles' && typeof g.count === 'number' && g.count > sacks)
        e.push(`goals[${i}]: clear_obstacles count ${g.count} > sacks in level (${sacks})`);
    });
  }
  const scriptedPieces = validateScripted(r.scriptedPieces, colors, pieceLimit, e);
  if (r.tutorial !== undefined && r.tutorial !== null && !(TUTORIALS as readonly unknown[]).includes(r.tutorial))
    e.push(`tutorial must be one of ${TUTORIALS.join(',')} or null`);
  if (r.intro !== undefined && (!Array.isArray(r.intro) || r.intro.some((x) => typeof x !== 'string')))
    e.push('intro must be an array of strings');
  if (r.customer !== undefined && !(CUSTOMERS as readonly unknown[]).includes(r.customer))
    e.push(`customer must be one of ${CUSTOMERS.join(',')}`);

  if (r.seed !== undefined && !isInt(r.seed)) e.push('seed must be an integer');
  if (r.pieces !== undefined) {
    if (!Array.isArray(r.pieces) || r.pieces.some((k) => !(PIECE_KINDS as readonly unknown[]).includes(k)))
      e.push(`pieces must be a subset of ${PIECE_KINDS.join(',')}`);
  }
  if (r.hint !== undefined && typeof r.hint !== 'string') e.push('hint must be a string');

  if (e.length) return { ok: false, errors: e };
  const level: LevelDef = {
    ...r,
    id: r.id as number,
    name: r.name as string,
    colors,
    pieceLimit,
    goals: r.goals as GoalDef[],
    stars,
    prefill,
    obstacles,
    specials,
    seed: isInt(r.seed) ? r.seed : (r.id as number) * 7919,
    scriptedPieces,
    tutorial: (r.tutorial as TutorialId | undefined) ?? null,
    intro: (r.intro as string[] | undefined) ?? [],
    customer: (r.customer as CustomerId | undefined) ?? 'ayse',
  };
  return { ok: true, level };
}
