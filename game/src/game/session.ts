// One play-through of a level: board, tray, score, chain, goals, win/lose.
// Driven by fixed ticks (tick()) so it is deterministic and testable headless.
import {
  ATTEMPT_SEED_STEP,
  CHAIN_MAX,
  CHAIN_RESET_ON_DROP,
  CLEAR_FLASH_TICKS,
  END_BONUS_PER_PIECE,
  GRID_H,
  GRID_W,
  PATH_BONUS,
  SCORE_PER_GRAIN,
  SIM_STEPS_PER_TICK,
  TRAY_SIZE,
} from '../config';
import { Emitter } from '../core/events';
import { Rng, deriveSeed } from '../core/rng';
import { ClearResult, findClears, removeMarked } from '../engine/clear';
import { SandGrid } from '../engine/grid';
import { canStamp, fitsAnywhere, PieceBag, pieceShape, rotatePiece, stamp, type Piece } from '../engine/pieces';
import { step } from '../engine/sim';
import type { LevelDef } from '../levels/schema';
import { computeStars, goalDone, GoalTracker } from './goals';
import { buildBoard } from './setup';

export type SessionState = 'playing' | 'won' | 'lost';
export type LoseReason = 'out_of_pieces' | 'no_space';

export type SessionEvent =
  | { type: 'placed'; slot: number; piece: Piece; x: number }
  | { type: 'blocked'; slot: number; x: number }
  | { type: 'rotated'; slot: number }
  | { type: 'trayRefill' }
  | { type: 'clearStart'; paths: number; grains: number }
  | { type: 'cleared'; paths: number; grains: number; chain: number; points: number }
  | { type: 'goalComplete'; index: number }
  | { type: 'settled' }
  | { type: 'won'; score: number; stars: number; bonus: number }
  | { type: 'lost'; reason: LoseReason; score: number };

/** RNG stream ids (see deriveSeed). */
const STREAM_BOARD = 1;
const STREAM_PIECES = 2;
const STREAM_SIM = 3;
const STREAM_COSMETIC = 4;

export interface SessionOptions {
  /** Override the level seed for all streams (e.g. replays / daily challenge). */
  seed?: number;
  /**
   * Attempt number (0-based). The board always uses the base seed; pieces and physics
   * use base + attempt * ATTEMPT_SEED_STEP so every retry deals differently (GDD §4.2).
   */
  attempt?: number;
  gridW?: number;
  gridH?: number;
}

export class Session {
  readonly level: LevelDef;
  readonly grid: SandGrid;
  readonly clear: ClearResult;
  readonly goals: GoalTracker;
  readonly events = new Emitter<SessionEvent>();
  readonly tray: (Piece | null)[] = [];

  state: SessionState = 'playing';
  loseReason: LoseReason | null = null;
  score = 0;
  /** Current chain level (consecutive clears since the last drop). */
  chain = 0;
  bestChain = 0;
  /** Pieces placed so far. */
  placed = 0;
  /** Pieces dealt into the tray so far. */
  dealt = 0;
  /** Total ticks run (for stats / replays). */
  ticks = 0;
  stars = 0;

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
  /** Points from the end-of-level bonus (included in score after a win). */
  endBonus = 0;

  constructor(level: LevelDef, opts: SessionOptions = {}) {
    this.level = level;
    const base = opts.seed ?? level.seed;
    const seed = (base + (opts.attempt ?? 0) * ATTEMPT_SEED_STEP) >>> 0;
    this.grid = new SandGrid(opts.gridW ?? GRID_W, opts.gridH ?? GRID_H);
    this.clear = ClearResult.for(this.grid);
    this.bag = new PieceBag(new Rng(deriveSeed(seed, STREAM_PIECES)), {
      colors: level.colors,
      kinds: level.pieces,
      bombChance: level.specials.bombChance,
    });
    this.rngSim = new Rng(deriveSeed(seed, STREAM_SIM));
    this.rngCosmetic = new Rng(deriveSeed(seed, STREAM_COSMETIC));
    buildBoard(this.grid, level, new Rng(deriveSeed(base, STREAM_BOARD)), this.clear);
    this.regionOrder = new Int32Array(this.grid.h);
    this.goals = new GoalTracker(level.goals);
    this.goalDoneFlags = this.goals.goals.map(() => false);
    for (let i = 0; i < TRAY_SIZE; i++) this.tray.push(null);
    this.refillTray();
  }

  /** Pieces the player can still place (Infinity when unlimited). */
  get piecesLeft(): number {
    return this.level.pieceLimit === null ? Infinity : this.level.pieceLimit - this.placed;
  }

  get isPlaying(): boolean {
    return this.state === 'playing';
  }

  get clearPending(): boolean {
    return this.flashTicks > 0;
  }

  private refillTray(): void {
    const limit = this.level.pieceLimit;
    const toDeal = limit === null ? TRAY_SIZE : Math.min(TRAY_SIZE, limit - this.dealt);
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

  rotate(slot: number): boolean {
    const p = this.tray[slot];
    if (!p || !this.isPlaying) return false;
    rotatePiece(p);
    this.events.emit({ type: 'rotated', slot });
    return true;
  }

  /**
   * Drop the tray piece at grain column x (top of board). A collision never ends
   * the game: the drop is simply refused (sand may still be flowing).
   */
  drop(slot: number, x: number): boolean {
    const p = this.tray[slot];
    if (!p || !this.isPlaying) return false;
    if (!stamp(this.grid, p, x, 0, this.rngCosmetic)) {
      this.events.emit({ type: 'blocked', slot, x });
      return false;
    }
    this.tray[slot] = null;
    this.placed++;
    if (CHAIN_RESET_ON_DROP) this.chain = 0;
    this.settled = false;
    this.needsCheck = true;
    this.events.emit({ type: 'placed', slot, piece: p, x });
    if (this.tray.every((t) => t === null)) this.refillTray();
    return true;
  }

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
      this.settled = false;
      this.needsCheck = true;
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

  private resolveClear(): void {
    const res = this.clear;
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
    for (let k = 0; k < n; k++) {
      this.chain++;
      const z = Math.min(this.chain, CHAIN_MAX);
      points += (res.regionLen[order[k]] * SCORE_PER_GRAIN + PATH_BONUS) * z;
    }
    // Grains removed by specials (bombs): per grain at the current multiplier, no path bonus.
    points += (res.cellCount - res.pathCellCount) * SCORE_PER_GRAIN * Math.min(this.chain, CHAIN_MAX);
    if (this.chain > this.bestChain) this.bestChain = this.chain;
    this.score += points;
    this.goals.onClear(res);
    this.goals.onScore(this.score);
    this.events.emit({ type: 'cleared', paths: res.regionCount, grains: res.cellCount, chain: this.chain, points });
    this.goals.goals.forEach((g, i) => {
      if (!this.goalDoneFlags[i] && goalDone(g)) {
        this.goalDoneFlags[i] = true;
        this.events.emit({ type: 'goalComplete', index: i });
      }
    });
    res.marked.fill(0);
    this.settled = false;
    this.needsCheck = true;
  }

  private evaluateEnd(): void {
    if (this.goals.allDone()) {
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
