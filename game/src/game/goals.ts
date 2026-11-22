// Level goals. Each goal type registers a validator and a factory in GOAL_TYPES.
// To add a new goal type: add its def to GoalDef, register it below, add HUD text in ui/goalText.ts.
import { cellsToGrains } from '../config';
import type { ClearResult } from '../engine/clear';

export interface ClearPathsGoalDef {
  type: 'clear_paths';
  count: number;
  /** Only paths of this colour count (optional). */
  color?: number;
}
export interface ScoreGoalDef {
  type: 'score';
  value: number;
}
export interface ClearColorGrainsGoalDef {
  type: 'clear_color_grains';
  color: number;
  count: number;
}
export interface ClearObstaclesGoalDef {
  type: 'clear_obstacles';
  count: number;
  /** Obstacle kind (only "sack" exists). */
  kind?: 'sack';
}
export type GoalDef = ClearPathsGoalDef | ScoreGoalDef | ClearColorGrainsGoalDef | ClearObstaclesGoalDef;
export type GoalType = GoalDef['type'];

/** Runtime goal instance. */
export interface Goal {
  readonly def: GoalDef;
  readonly target: number;
  current: number;
  /** Called after cleared cells were removed. */
  onClear(res: ClearResult): void;
  /** Called whenever the score changes. */
  onScore(score: number): void;
  /** Called when a breakable obstacle is destroyed (optional). */
  onObstacle?(kind: 'sack'): void;
}

interface GoalTypeDef<D extends GoalDef> {
  /** Return error strings (empty = valid). `colors` = level colours. */
  validate(raw: Record<string, unknown>, colors: readonly number[]): string[];
  create(def: D): Goal;
}

const isPosInt = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v) && v > 0;

function colorErr(v: unknown, colors: readonly number[], required: boolean): string[] {
  if (v === undefined) return required ? ['color is required'] : [];
  if (!isPosInt(v)) return ['color must be a positive integer'];
  if (!colors.includes(v)) return [`color ${v} is not in level colors`];
  return [];
}

const clearPaths: GoalTypeDef<ClearPathsGoalDef> = {
  validate(raw, colors) {
    const e: string[] = [];
    if (!isPosInt(raw.count)) e.push('count must be a positive integer');
    e.push(...colorErr(raw.color, colors, false));
    return e;
  },
  create(def) {
    return {
      def,
      target: def.count,
      current: 0,
      onClear(res) {
        for (let r = 0; r < res.regionCount; r++) {
          if (def.color === undefined || res.regionColor[r] === def.color) this.current++;
        }
      },
      onScore() {},
    };
  },
};

const score: GoalTypeDef<ScoreGoalDef> = {
  validate(raw) {
    return isPosInt(raw.value) ? [] : ['value must be a positive integer'];
  },
  create(def) {
    return {
      def,
      target: def.value,
      current: 0,
      onClear() {},
      onScore(s) {
        this.current = s;
      },
    };
  },
};

const clearColorGrains: GoalTypeDef<ClearColorGrainsGoalDef> = {
  validate(raw, colors) {
    const e: string[] = [];
    if (!isPosInt(raw.count)) e.push('count must be a positive integer');
    e.push(...colorErr(raw.color, colors, true));
    return e;
  },
  create(def) {
    // Count exact cells, report design grains (grams): SUB×SUB cells = 1 g.
    let cells = 0;
    return {
      def,
      target: def.count,
      current: 0,
      onClear(res) {
        cells += res.colorCounts[def.color];
        this.current = cellsToGrains(cells);
      },
      onScore() {},
    };
  },
};

const clearObstacles: GoalTypeDef<ClearObstaclesGoalDef> = {
  validate(raw) {
    const e: string[] = [];
    if (!isPosInt(raw.count)) e.push('count must be a positive integer');
    if (raw.kind !== undefined && raw.kind !== 'sack') e.push('kind must be "sack"');
    // "count <= sacks in level" is checked by validateLevel (needs the obstacle list).
    return e;
  },
  create(def) {
    const kind = def.kind ?? 'sack';
    return {
      def,
      target: def.count,
      current: 0,
      onClear() {},
      onScore() {},
      onObstacle(k) {
        if (k === kind) this.current++;
      },
    };
  },
};

export const GOAL_TYPES: { [K in GoalType]: GoalTypeDef<Extract<GoalDef, { type: K }>> } = {
  clear_paths: clearPaths,
  score,
  clear_color_grains: clearColorGrains,
  clear_obstacles: clearObstacles,
};

export function isGoalType(t: unknown): t is GoalType {
  return typeof t === 'string' && Object.prototype.hasOwnProperty.call(GOAL_TYPES, t);
}

export function validateGoal(raw: unknown, colors: readonly number[]): string[] {
  if (!raw || typeof raw !== 'object') return ['goal must be an object'];
  const r = raw as Record<string, unknown>;
  if (!isGoalType(r.type)) return [`unknown goal type: ${String(r.type)}`];
  return GOAL_TYPES[r.type].validate(r, colors);
}

export function createGoal(def: GoalDef): Goal {
  // The registry is keyed by type, so this cast is safe.
  return (GOAL_TYPES[def.type] as GoalTypeDef<GoalDef>).create(def);
}

export function goalDone(g: Goal): boolean {
  return g.current >= g.target;
}

/** Tracks all goals of a level. */
export class GoalTracker {
  readonly goals: Goal[];

  constructor(defs: readonly GoalDef[]) {
    this.goals = defs.map(createGoal);
  }

  onClear(res: ClearResult): void {
    for (const g of this.goals) g.onClear(res);
  }

  onScore(s: number): void {
    for (const g of this.goals) g.onScore(s);
  }

  onObstacle(kind: 'sack'): void {
    for (const g of this.goals) g.onObstacle?.(kind);
  }

  allDone(): boolean {
    return this.goals.every(goalDone);
  }

  /** Overall progress 0..1 (for UI bars). */
  progress(): number {
    if (!this.goals.length) return 1;
    let sum = 0;
    for (const g of this.goals) sum += Math.min(1, g.current / g.target);
    return sum / this.goals.length;
  }
}

/** Stars for a won level: at least 1, plus one per threshold reached (max 3). */
export function computeStars(score: number, thresholds: readonly number[], won: boolean): number {
  if (!won) return 0;
  let n = 0;
  for (const t of thresholds) if (score >= t) n++;
  return Math.max(1, Math.min(3, n));
}
