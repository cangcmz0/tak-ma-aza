// One play-through of a level (or an endless run): board, tray, score, chain, goals, win/lose.
// Driven by fixed ticks (tick()) so it is deterministic and testable headless.
import {
  ATTEMPT_SEED_STEP,
  CHAIN_MAX,
  CHAIN_RESET_ON_DROP,
  CLEAR_FLASH_TICKS,
  DANGER_ROWS,
  END_BONUS_PER_PIECE,
  GRID_H,
  GRID_W,
  HELP_COLOR_WEIGHT,
  HELP_LOSS_STREAK,
  PATH_BONUS,
  SACK_BREAK_POINTS,
  SCORE_PER_GRAIN,
  SIM_STEPS_PER_TICK,
  TRAY_SIZE,
} from '../config';
import { Emitter, type LoseReason, type SessionEvent } from '../core/events';
import { Rng, deriveSeed } from '../core/rng';
import { ClearResult, findClears, removeMarked } from '../engine/clear';
import { FLAG_BOMB, FLAG_FALLING, FLAG_STATIC, JOKER, MAX_SAND_COLOR, SandGrid } from '../engine/grid';
import { canStamp, dropHeight, fitsAnywhere, PieceBag, pieceShape, rotatePiece, stamp, type Piece } from '../engine/pieces';
import { Sacks } from '../engine/sacks';
import { step } from '../engine/sim';
import type { LevelDef, ScriptedPieceDef } from '../levels/schema';
import { buildEndlessBoard, endlessParams } from './endless';
import { computeStars, goalDone, GoalTracker } from './goals';
import { buildBoard } from './setup';

// Event types live in core/events.ts (re-exported for existing imports).
export type { LoseReason, SessionEvent } from '../core/events';

export type SessionState = 'playing' | 'won' | 'lost';

/** RNG stream ids (see deriveSeed). */
const STREAM_BOARD = 1;
const STREAM_PIECES = 2;
const STREAM_SIM = 3;
const STREAM_COSMETIC = 4;

/** Max sampled cells per grainsToGoal event. */
const FLY_SAMPLES = 24;

export interface SessionOptions {
  /** Override the level seed for all streams (e.g. replays / daily challenge). */
  seed?: number;
  /**
   * Attempt number (0-based). The board always uses the base seed; pieces and physics
   * use base + attempt * ATTEMPT_SEED_STEP so every retry deals differently (GDD §4.2).
   */
  attempt?: number;
  /** Help rule (GDD §4.2): goal colours get HELP_COLOR_WEIGHT in the colour bag. See shouldHelp(). */
  help?: boolean;
  /** Endless mode (GDD §6): never won, difficulty follows the score, endless board prefill. */
  endless?: boolean;
  gridW?: number;
  gridH?: number;
}

/** Help rule: active on every HELP_LOSS_STREAK-th consecutive loss, for one attempt. */
export function shouldHelp(lossStreak: number): boolean {
  return lossStreak > 0 && lossStreak % HELP_LOSS_STREAK === 0;
}

/** Colours named by the level goals (help rule targets). */
export function goalColors(level: LevelDef): number[] {
  const out = new Set<number>();
  for (const g of level.goals) if ('color' in g && g.color !== undefined) out.add(g.color);
  return [...out];
}

export function scriptedToPiece(d: ScriptedPieceDef): Piece {
  return {
    kind: d.shape,
    rot: (d.rot ?? 0) & 3,
    color: d.colors ? d.colors[0] : d.color,
    color2: d.colors ? d.colors[1] : null,
    special: d.bomb !== undefined ? 'bomb' : null,
    specialCell: d.bomb ?? -1,
    jokerCell: d.joker ?? -1,
  };
}

export class Session {
  readonly level: LevelDef;
  readonly grid: SandGrid;
  readonly clear: ClearResult;
  readonly goals: GoalTracker;
  readonly sacks: Sacks;
  readonly events = new Emitter<SessionEvent>();
  readonly tray: (Piece | null)[] = [];
  readonly endless: boolean;
  /** True when the help rule is active for this attempt. */
  readonly helped: boolean;

  state: SessionState = 'playing';
  loseReason: LoseReason | null = null;
  score = 0;
  /** Current chain level (consecutive clears; resets when the board settles without a path). */
  chain = 0;
  bestChain = 0;
  /** Pieces placed so far. */
  placed = 0;
  /** Pieces dealt into the tray so far. */
  dealt = 0;
  /** Extra pieces granted on top of the level limit (continue / booster). */
  extraPieces = 0;
  /** Times this attempt was resumed after a loss (revive()). */
  continues = 0;
  /** Total ticks run (for stats / replays). */
  ticks = 0;
  stars = 0;
  /** Settled sand is within DANGER_ROWS of the top. */
  danger = false;
  private dangerWarned = false;

  /** Ticks left in the clear blink; > 0 means a clear is pending (clear.marked is valid). */
  flashTicks = 0;
  /** True when the sand is at rest and no clear is pending. */
  settled = false;
  private needsCheck = true;

  private readonly bag: PieceBag;
  private readonly rngSim: Rng;
  private readonly rngCosmetic: Rng;
  private readonly goalDoneFlags: boolean[];
  private readonly regionOrder: Int32Array;
  private endlessColors = 0;
  /** Points from the end-of-level bonus (included in score after a win). */
  endBonus = 0;

  constructor(level: LevelDef, opts: SessionOptions = {}) {
    this.level = level;
    this.endless = !!opts.endless;
    const base = opts.seed ?? level.seed;
    const seed = (base + (opts.attempt ?? 0) * ATTEMPT_SEED_STEP) >>> 0;
    this.grid = new SandGrid(opts.gridW ?? GRID_W, opts.gridH ?? GRID_H);
    this.clear = ClearResult.for(this.grid);
    const helpColors = opts.help ? goalColors(level) : [];
    this.helped = helpColors.length > 0;
    const colorWeights: Record<number, number> = {};
    for (const c of helpColors) colorWeights[c] = HELP_COLOR_WEIGHT;
    this.bag = new PieceBag(
      new Rng(deriveSeed(seed, STREAM_PIECES)),
      {
        colors: level.colors,
        kinds: level.pieces,
        bombChance: level.specials.bombChance,
        jokerChance: level.specials.jokerChance ?? 0,
        twoColorChance: level.specials.twoColorChance ?? 0,
        colorWeights: this.helped ? colorWeights : undefined,
      },
      (level.scriptedPieces ?? []).map(scriptedToPiece),
    );
    this.rngSim = new Rng(deriveSeed(seed, STREAM_SIM));
    this.rngCosmetic = new Rng(deriveSeed(seed, STREAM_COSMETIC));
    this.sacks = new Sacks();
    if (this.endless) buildEndlessBoard(this.grid, level, new Rng(deriveSeed(base, STREAM_BOARD)), this.clear);
    else buildBoard(this.grid, level, new Rng(deriveSeed(base, STREAM_BOARD)), this.clear, this.sacks);
    this.endlessColors = level.colors.length;
    this.regionOrder = new Int32Array(this.clear.regionColor.length);
    this.goals = new GoalTracker(level.goals);
    this.goalDoneFlags = this.goals.goals.map(() => false);
    for (let i = 0; i < TRAY_SIZE; i++) this.tray.push(null);
    this.refillTray();
  }

  /** Total pieces allowed (level limit + granted extras); Infinity when unlimited. */
  get pieceBudget(): number {
    return this.level.pieceLimit === null ? Infinity : this.level.pieceLimit + this.extraPieces;
  }

  /** Pieces the player can still place (Infinity when unlimited). */
  get piecesLeft(): number {
    return this.pieceBudget - this.placed;
  }

  get isPlaying(): boolean {
    return this.state === 'playing';
  }

  get clearPending(): boolean {
    return this.flashTicks > 0;
  }

  /** Current dealing options (endless difficulty is visible here). */
  get dealOptions() {
    return this.bag.options;
  }

  private refillTray(): void {
    const toDeal = Math.min(TRAY_SIZE, this.pieceBudget - this.dealt);
    if (toDeal <= 0) return;
    for (let i = 0; i < toDeal; i++) {
      this.tray[i] = this.bag.next();
      this.dealt++;
    }
    this.events.emit({ type: 'trayRefill' });
  }

  /** Whether the piece in `slot` could be stamped at grain column x right now. */
  canDrop(slot: number, x: number): boolean {
    const p = this.tray[slot];
    return !!p && this.isPlaying && canStamp(this.grid, pieceShape(p), x, 0);
  }

  /**
   * Row where the piece in `slot` would be placed when released at column x with its
   * top edge aimed at grain row `wantY` (it then falls from there). -1 = blocked.
   */
  dropRow(slot: number, x: number, wantY = 0): number {
    const p = this.tray[slot];
    if (!p || !this.isPlaying) return -1;
    return dropHeight(this.grid, pieceShape(p), x, wantY);
  }

  rotate(slot: number): boolean {
    const p = this.tray[slot];
    if (!p || !this.isPlaying) return false;
    rotatePiece(p);
    this.events.emit({ type: 'rotated', slot });
    return true;
  }

  /**
   * Drop the tray piece at grain column x, released with its top at row wantY (0 = top of
   * board); it falls from there as a rigid block. A collision never ends
   * the game: the drop is simply refused (sand may still be flowing).
   */
  drop(slot: number, x: number, wantY = 0): boolean {
    const p = this.tray[slot];
    if (!p || !this.isPlaying) return false;
    const y = dropHeight(this.grid, pieceShape(p), x, wantY);
    if (y < 0 || !stamp(this.grid, p, x, y, this.rngCosmetic, FLAG_FALLING)) {
      this.events.emit({ type: 'blocked', slot, x });
      return false;
    }
    this.tray[slot] = null;
    this.placed++;
    if (CHAIN_RESET_ON_DROP) this.chain = 0;
    this.wake();
    this.events.emit({ type: 'placed', slot, piece: p, x });
    if (this.tray.every((t) => t === null)) this.refillTray();
    return true;
  }

  // --- external actions (boosters / continue; economy wave) ----------------

  /** Grant extra pieces (e.g. "continue +5"). Refills an empty tray. */
  addPieces(n: number): void {
    if (n <= 0 || !Number.isFinite(this.pieceBudget)) return;
    this.extraPieces += n;
    this.events.emit({ type: 'piecesAdded', n });
    if (this.tray.every((t) => t === null)) this.refillTray();
    this.wake();
  }

  /** Replace every piece in the tray with a new one (does not use up the piece limit). */
  rerollTray(): boolean {
    if (!this.isPlaying) return false;
    let any = false;
    for (let i = 0; i < this.tray.length; i++) {
      if (this.tray[i]) {
        this.tray[i] = this.bag.next();
        any = true;
      }
    }
    if (any) {
      this.events.emit({ type: 'trayRerolled' });
      this.wake();
    }
    return any;
  }

  /**
   * Remove all sand in grain columns [x0, x0 + w) ("Kepçe"). Grains count for colour goals,
   * score 1 point each without multiplier (GDD §4.7). Refused while a clear is blinking.
   * @returns grains removed
   */
  scoopColumns(x0: number, w: number): number {
    if (!this.isPlaying || this.clearPending) return 0;
    const g = this.grid;
    const res = this.clear;
    res.reset();
    for (let y = 0; y < g.h; y++)
      for (let x = Math.max(0, x0); x < Math.min(g.w, x0 + w); x++) {
        const i = y * g.w + x;
        const c = g.color[i];
        if (c !== 0 && c <= MAX_SAND_COLOR && !(g.flags[i] & FLAG_STATIC)) res.markCell(g, i);
      }
    return this.removeToolMarks();
  }

  /**
   * Remove every grain of one sand colour ("Elek"). Counts for grain goals (not path goals),
   * 1 point per grain without multiplier (GDD §4.7). Jokers / obstacles cannot be sieved.
   * Refused while a clear is blinking. @returns grains removed
   */
  sieveColor(color: number): number {
    if (!this.isPlaying || this.clearPending || color <= 0 || color >= JOKER) return 0;
    const g = this.grid;
    const res = this.clear;
    res.reset();
    for (let i = 0; i < g.size; i++) if (g.color[i] === color && !(g.flags[i] & FLAG_STATIC)) res.markCell(g, i);
    return this.removeToolMarks();
  }

  /** Shared tail of the tool clears: remove marked cells, score, goals, events. */
  private removeToolMarks(): number {
    const res = this.clear;
    const n = res.cellCount;
    if (n > 0) {
      removeMarked(this.grid, res);
      this.score += n;
      this.goals.onClear(res);
      this.goals.onScore(this.score);
      this.events.emit({ type: 'toolCleared', grains: n, points: n });
      this.checkGoalCompletion();
      this.wake();
    }
    res.reset();
    return n;
  }

  /**
   * Resume a lost attempt ("Devam et", GDD §10.1): +`pieces` pieces and, when the loss was
   * "no space", the top `clearRows` grain rows are emptied (grains do not count for goals or
   * score). @returns false if the attempt is not lost
   */
  revive(pieces: number, clearRows: number): boolean {
    if (this.state !== 'lost') return false;
    const noSpace = this.loseReason === 'no_space';
    let grains = 0;
    const rows = noSpace ? Math.max(0, Math.min(this.grid.h, clearRows)) : 0;
    const g = this.grid;
    for (let i = 0; i < rows * g.w; i++) {
      if (g.color[i] !== 0 && !(g.flags[i] & FLAG_STATIC)) {
        g.clearCell(i);
        grains++;
      }
    }
    if (grains > 0) g.version++;
    this.state = 'playing';
    this.loseReason = null;
    this.continues++;
    this.chain = 0;
    this.events.emit({ type: 'revived', pieces, rows, grains });
    this.addPieces(pieces);
    this.wake();
    return true;
  }

  /** The grid changed outside of tick() (tools, debug edits): re-run physics and path checks. */
  wake(): void {
    this.settled = false;
    this.needsCheck = true;
  }

  // --- simulation -----------------------------------------------------------

  /** Advance one fixed simulation tick. */
  tick(): void {
    if (!this.isPlaying) return;
    this.ticks++;
    if (this.flashTicks > 0) {
      if (--this.flashTicks === 0) this.resolveClear();
      return;
    }
    let moved = 0;
    for (let k = 0; k < SIM_STEPS_PER_TICK; k++) moved += step(this.grid, this.rngSim);
    if (moved > 0) {
      this.wake();
      return;
    }
    if (!this.needsCheck) return;
    this.needsCheck = false;
    const paths = findClears(this.grid, this.clear);
    if (paths > 0) {
      this.flashTicks = CLEAR_FLASH_TICKS;
      this.events.emit({ type: 'clearStart', paths, grains: this.clear.cellCount });
      return;
    }
    this.settled = true;
    this.chain = 0;
    this.events.emit({ type: 'settled' });
    this.updateDanger();
    this.evaluateEnd();
  }

  /** Run ticks until settled (or game over). For tests / tools. */
  runUntilSettled(maxTicks = 100000): boolean {
    for (let i = 0; i < maxTicks; i++) {
      if (!this.isPlaying || (this.settled && !this.needsCheck)) return true;
      this.tick();
    }
    return false;
  }

  /** Highest row (0 = top) holding a non-static grain; grid.h if the board is empty. */
  topSandRow(): number {
    const { color, flags, size, w, h } = this.grid;
    for (let i = 0; i < size; i++) if (color[i] !== 0 && !(flags[i] & FLAG_STATIC)) return (i / w) | 0;
    return h;
  }

  private updateDanger(): void {
    const on = this.topSandRow() < DANGER_ROWS;
    if (on === this.danger) return;
    this.danger = on;
    const first = on && !this.dangerWarned;
    if (on) this.dangerWarned = true;
    this.events.emit({ type: 'danger', on, first });
  }

  private emitClearDetails(): { cx: number; cy: number } {
    const res = this.clear;
    const g = this.grid;
    const w = g.w;
    // Path centre (score popup anchor) and bomb origin.
    let sx = 0;
    let sy = 0;
    let bomb = -1;
    for (let k = 0; k < res.pathCellCount; k++) {
      const i = res.cells[k];
      sx += i % w;
      sy += (i / w) | 0;
      if (bomb < 0 && g.flags[i] & FLAG_BOMB) bomb = i;
    }
    const n = Math.max(1, res.pathCellCount);
    // Grains flying into the order bag (one event per grain goal whose colour was cleared).
    this.goals.goals.forEach((goal, gi) => {
      if (goal.def.type !== 'clear_color_grains' || goalDone(goal)) return;
      const color = goal.def.color;
      const total = res.colorCounts[color];
      if (!total) return;
      const cells: number[] = [];
      const stride = Math.max(1, Math.floor(total / FLY_SAMPLES));
      let seen = 0;
      for (let k = 0; k < res.cellCount && cells.length < FLY_SAMPLES; k++) {
        const i = res.cells[k];
        if (g.color[i] !== color) continue;
        if (seen++ % stride === 0) cells.push(i);
      }
      this.events.emit({ type: 'grainsToGoal', goal: gi, color, total, cells });
    });
    const jokers = res.jokerPathGrains(g);
    if (jokers > 0) this.events.emit({ type: 'joker', grains: jokers });
    if (bomb >= 0) this.events.emit({ type: 'bomb', grains: res.cellCount - res.pathCellCount, x: bomb % w, y: (bomb / w) | 0 });
    return { cx: sx / n, cy: sy / n };
  }

  private resolveClear(): void {
    const res = this.clear;
    const { cx, cy } = this.emitClearDetails();
    // Sack damage needs the marks of this clear (before they are reset).
    const sackHits = this.sacks.list.length ? this.sacks.applyClear(this.grid, res) : [];
    removeMarked(this.grid, res);
    // Paths of one check are separate chain steps, largest first (GDD §4.6/4.7).
    const order = this.regionOrder;
    const n = res.regionCount;
    for (let r = 0; r < n; r++) order[r] = r;
    for (let a = 1; a < n; a++) {
      const v = order[a];
      let b = a - 1;
      while (b >= 0 && res.regionLen[order[b]] < res.regionLen[v]) {
        order[b + 1] = order[b];
        b--;
      }
      order[b + 1] = v;
    }
    let points = 0;
    const colors: number[] = [];
    for (let k = 0; k < n; k++) {
      colors.push(res.regionColor[order[k]]);
      this.chain++;
      const z = Math.min(this.chain, CHAIN_MAX);
      points += (res.regionLen[order[k]] * SCORE_PER_GRAIN + PATH_BONUS) * z;
    }
    // Grains removed by specials (bombs): per grain at the current multiplier, no path bonus.
    points += (res.cellCount - res.pathCellCount) * SCORE_PER_GRAIN * Math.min(this.chain, CHAIN_MAX);
    // Torn sacks: flat points, no multiplier.
    let broken = 0;
    for (const hit of sackHits) if (hit.broken) broken++;
    points += broken * SACK_BREAK_POINTS;
    if (this.chain > this.bestChain) this.bestChain = this.chain;
    this.score += points;
    this.goals.onClear(res);
    for (let k = 0; k < broken; k++) this.goals.onObstacle('sack');
    this.goals.onScore(this.score);
    this.events.emit({ type: 'cleared', paths: n, grains: res.cellCount, chain: this.chain, points, cx, cy, colors });
    if (n >= 2) this.events.emit({ type: 'double', paths: n });
    if (this.chain >= 2) this.events.emit({ type: 'chainWord', chain: Math.min(this.chain, CHAIN_MAX) });
    for (const { index, sack: s, broken: b } of sackHits) {
      if (b) this.events.emit({ type: 'sackBreak', index, x: s.x, y: s.y, w: s.w, h: s.h, points: SACK_BREAK_POINTS });
      else this.events.emit({ type: 'sackHit', index, hp: s.hp, maxHp: s.maxHp, x: s.x, y: s.y, w: s.w, h: s.h });
    }
    this.checkGoalCompletion();
    if (this.endless) this.applyEndlessDifficulty();
    res.marked.fill(0);
    this.wake();
  }

  private checkGoalCompletion(): void {
    this.goals.goals.forEach((g, i) => {
      if (!this.goalDoneFlags[i] && goalDone(g)) {
        this.goalDoneFlags[i] = true;
        this.events.emit({ type: 'goalComplete', index: i });
      }
    });
  }

  private applyEndlessDifficulty(): void {
    const p = endlessParams(this.score);
    if (p.colors.length !== this.endlessColors || p.bombChance !== this.bag.options.bombChance || p.jokerChance !== this.bag.options.jokerChance) {
      this.endlessColors = p.colors.length;
      this.bag.setOptions({ colors: p.colors, bombChance: p.bombChance, jokerChance: p.jokerChance });
    }
  }

  private evaluateEnd(): void {
    if (!this.endless && this.goals.allDone()) {
      this.state = 'won';
      // End bonus for unused pieces; added after goal checks so it never completes a score goal.
      this.endBonus = Number.isFinite(this.piecesLeft) ? this.piecesLeft * END_BONUS_PER_PIECE : 0;
      this.score += this.endBonus;
      this.stars = computeStars(this.score, this.level.stars, true);
      this.events.emit({ type: 'won', score: this.score, stars: this.stars, bonus: this.endBonus });
      return;
    }
    const hasPiece = this.tray.some((t) => t !== null);
    if (!hasPiece && this.piecesLeft <= 0) return this.lose('out_of_pieces');
    if (hasPiece && !this.tray.some((t) => t !== null && fitsAnywhere(this.grid, t))) this.lose('no_space');
  }

  private lose(reason: LoseReason): void {
    this.state = 'lost';
    this.loseReason = reason;
    this.events.emit({ type: 'lost', reason, score: this.score });
  }
}
