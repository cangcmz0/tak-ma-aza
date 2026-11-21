// Level calibration core (Level Designer tool; not shipped with the game).
//
// Plays every level many times with the greedy QA bot (src/dev/bot.ts) using the
// real attempt rule (GDD §4.2: same board, different pieces/physics per attempt)
// and reports win rate + score distribution. Star suggestion follows GDD §8:
// 2★ = median score of won games, 3★ = 80th percentile of won games.
//
// Pure TypeScript (no node imports) so it runs both from the CLI wrapper
// (scripts/calibrate-levels.mjs, via Vite's runnerImport) and from vitest
// (tests/calibrate.test.ts).
//
// Mechanics the engine does not support yet (scripted pieces, joker, two-colour
// pieces, sacks / clear_obstacles) are detected at runtime: levels using them are
// flagged "pending" and, where possible, calibrated with a proxy so piece limits
// can still be sanity-checked. Re-run once the gameplay engineer lands them.
import { Rng } from '../src/core/rng';
import { chooseMove, type BotMove } from '../src/dev/bot';
import { ClearResult, findClears, removeMarked } from '../src/engine/clear';
import { EMPTY, FLAG_BOMB, FLAG_STATIC, JOKER, MAX_SAND_COLOR, SACK, SandGrid, STONE } from '../src/engine/grid';
import { canStamp, maxX, ROTATIONS, stamp, type Piece } from '../src/engine/pieces';
import { settle } from '../src/engine/sim';
import { goalDone, isGoalType } from '../src/game/goals';
import { Session, type LoseReason, type SessionState } from '../src/game/session';
import { validateLevel, type LevelDef } from '../src/levels/schema';

export type Feature = 'scriptedPieces' | 'joker' | 'twoColor' | 'sack';
export type Features = Record<Feature, boolean>;

export const FEATURE_LABEL: Record<Feature, string> = {
  scriptedPieces: 'sabit tepsi (scriptedPieces)',
  joker: 'joker (Karışık Baharat)',
  twoColor: 'ikili kese',
  sack: 'çuval / clear_obstacles',
};

type Raw = Record<string, unknown>;
const isObj = (v: unknown): v is Raw => !!v && typeof v === 'object' && !Array.isArray(v);

function probeLevel(over: Raw): LevelDef | null {
  const r = validateLevel({
    id: 999,
    name: 'probe',
    colors: [1, 2],
    pieceLimit: 30,
    goals: [{ type: 'score', value: 999999 }],
    stars: [1, 2, 3],
    prefill: { type: 'none' },
    obstacles: [],
    specials: { bombChance: 0 },
    seed: 777,
    ...over,
  });
  return r.ok ? r.level : null;
}

/** Drop tray slot `slot` at x and return the grid right after stamping (before physics). */
function stampedColors(s: Session, slot = 0): { colors: Set<number>; flags: number } {
  s.drop(slot, 0);
  const colors = new Set<number>();
  let flags = 0;
  const g = s.grid;
  for (let i = 0; i < g.size; i++) {
    if (g.color[i] === EMPTY) continue;
    colors.add(g.color[i]);
    flags |= g.flags[i];
  }
  return { colors, flags };
}

function safe(fn: () => boolean): boolean {
  try {
    return fn();
  } catch {
    return false;
  }
}

/** Runtime detection of engine support for the wave-2 mechanics. */
export function detectFeatures(): Features {
  const scriptedPieces = safe(() => {
    const lv = probeLevel({ pieces: ['O'], scriptedPieces: [{ shape: 'I', color: 2, rot: 1 }] });
    if (!lv) return false;
    const s = new Session(lv);
    return s.tray.some((p) => !!p && p.kind === 'I' && p.color === 2);
  });
  const joker = safe(() => {
    const lv = probeLevel({ colors: [1], pieces: ['O'], specials: { bombChance: 0, jokerChance: 1 } });
    if (!lv) return false;
    for (let k = 0; k < 3; k++) {
      const s = new Session(lv, { attempt: k });
      const { colors, flags } = stampedColors(s);
      const odd = [...colors].some((c) => c !== 1 && c !== STONE);
      if (odd || (flags & ~(FLAG_STATIC | FLAG_BOMB)) !== 0) return true;
    }
    return false;
  });
  const twoColor = safe(() => {
    const lv = probeLevel({ colors: [1, 2], pieces: ['O'], specials: { bombChance: 0, twoColorChance: 1 } });
    if (!lv) return false;
    for (let k = 0; k < 3; k++) {
      const s = new Session(lv, { attempt: k });
      const { colors } = stampedColors(s);
      if ([...colors].filter((c) => c >= 1 && c <= MAX_SAND_COLOR).length >= 2) return true;
    }
    return false;
  });
  const sack = safe(() => {
    if (!isGoalType('clear_obstacles')) return false;
    return !!probeLevel({
      goals: [{ type: 'clear_obstacles', count: 1, kind: 'sack' }],
      obstacles: [{ type: 'sack', x: 0, y: 18, w: 2, h: 2, hp: 1 }],
    });
  });
  return { scriptedPieces, joker, twoColor, sack };
}

/** Which wave-2 mechanics a raw level definition uses. */
export function featuresUsed(raw: Raw): Feature[] {
  const out: Feature[] = [];
  const sp = Array.isArray(raw.scriptedPieces) ? (raw.scriptedPieces as unknown[]) : [];
  const specials = isObj(raw.specials) ? raw.specials : {};
  const goals = Array.isArray(raw.goals) ? (raw.goals as unknown[]) : [];
  const obstacles = Array.isArray(raw.obstacles) ? (raw.obstacles as unknown[]) : [];
  if (sp.length) out.push('scriptedPieces');
  if (Number(specials.jokerChance ?? 0) > 0 || sp.some((p) => isObj(p) && p.joker !== undefined)) out.push('joker');
  if (Number(specials.twoColorChance ?? 0) > 0 || sp.some((p) => isObj(p) && Array.isArray(p.colors))) out.push('twoColor');
  if (
    goals.some((g) => isObj(g) && g.type === 'clear_obstacles') ||
    obstacles.some((o) => isObj(o) && o.type === 'sack')
  )
    out.push('sack');
  return out;
}

export interface PreparedLevel {
  id: number;
  name: string;
  raw: Raw;
  /** Level actually played by the bot (may be a proxy); null = cannot be calibrated. */
  level: LevelDef | null;
  /** Mechanics used by the level that the engine does not support yet. */
  pending: Feature[];
  /** Set when the bot plays a substitute (e.g. sack goal replaced by paths). */
  proxy: string | null;
  /** Validation errors of the real level (empty = valid). */
  errors: string[];
}

/**
 * Validate a raw level. If it only fails because `clear_obstacles` is not registered
 * yet, build a proxy that replaces each sack goal by `clear_paths` (one path per hp of
 * the weakest `count` sacks — every path next to a sack deals 1 damage, GDD §5.4).
 */
export function prepareLevel(raw: Raw, features: Features): PreparedLevel {
  const id = Number(raw.id);
  const name = String(raw.name ?? '');
  const pending = featuresUsed(raw).filter((f) => !features[f]);
  const res = validateLevel(raw);
  if (res.ok) return { id, name, raw, level: res.level, pending, proxy: null, errors: [] };
  const errors = res.errors;
  const onlySackGoal = errors.every((e) => /unknown goal type: clear_obstacles/.test(e));
  if (!onlySackGoal || features.sack) return { id, name, raw, level: null, pending, proxy: null, errors };
  const hps = (Array.isArray(raw.obstacles) ? (raw.obstacles as unknown[]) : [])
    .filter((o): o is Raw => isObj(o) && o.type === 'sack')
    .map((o) => (typeof o.hp === 'number' ? o.hp : 1))
    .sort((a, b) => a - b);
  const notes: string[] = [];
  const goals = (raw.goals as Raw[]).map((g) => {
    if (g.type !== 'clear_obstacles') return g;
    const n = typeof g.count === 'number' ? g.count : 1;
    const paths = hps.slice(0, n).reduce((a, b) => a + b, 0) || n;
    notes.push(`${n} çuval → ${paths} yol`);
    return { type: 'clear_paths', count: paths };
  });
  // Note: an extra uncoloured clear_paths goal counts the same paths (AND of counts ≈ max).
  const proxyRes = validateLevel({ ...raw, goals });
  if (!proxyRes.ok) return { id, name, raw, level: null, pending, proxy: null, errors };
  return { id, name, raw, level: proxyRes.level, pending, proxy: `vekil: ${notes.join(', ')}`, errors };
}

// ---------------------------------------------------------------------------
// Goal-aware bot ("hedef-bilinçli"). The shipped QA bot (src/dev/bot.ts) only widens
// same-colour regions and ignores the level goals, treats jokers as a separate colour
// and does not know sacks — so on colour / sack levels it badly underestimates a
// human. This variant keeps the same one-ply search (every slot × rotation × block
// column) but scores each landing by:
//   1. goal progress of the clears it triggers (paths, goal colours, sack hits, points),
//   2. the shape of the board afterwards (wide regions of needed colours, jokers count
//      for every colour, regions touching sacks), minus a stack-height penalty.
// It is still greedy (no planning beyond the current drop).
// ---------------------------------------------------------------------------

export type BotKind = 'greedy' | 'smart';

class SmartEvaluator {
  readonly g: SandGrid;
  readonly res: ClearResult;
  private readonly seen: Int32Array;
  private readonly stack: Int32Array;
  private stampId = 0;
  readonly rng = new Rng(11);

  constructor(w: number, h: number) {
    this.g = new SandGrid(w, h);
    this.res = ClearResult.for(this.g);
    this.seen = new Int32Array(w * h);
    this.stack = new Int32Array(w * h);
  }

  /** Board shape value (higher is better). */
  shape(s: Session, weights: Float64Array, sackBias: number): number {
    const g = this.g;
    const { w, color } = g;
    const { seen, stack } = this;
    let total = 0;
    for (const c of s.level.colors) {
      const id = ++this.stampId;
      for (let i = 0; i < g.size; i++) {
        if (color[i] !== c || seen[i] === id) continue;
        let sp = 0;
        let lo = w;
        let hi = -1;
        let touchesSack = false;
        stack[sp++] = i;
        seen[i] = id;
        while (sp) {
          const j = stack[--sp];
          const x = j % w;
          if (x < lo) lo = x;
          if (x > hi) hi = x;
          for (let d = 0; d < 4; d++) {
            const k = d === 0 ? (x > 0 ? j - 1 : -1) : d === 1 ? (x < w - 1 ? j + 1 : -1) : d === 2 ? j - w : j + w < g.size ? j + w : -1;
            if (k < 0) continue;
            const ck = color[k];
            if (ck === SACK) touchesSack = true;
            else if ((ck === c || ck === JOKER) && seen[k] !== id) {
              seen[k] = id;
              stack[sp++] = k;
            }
          }
        }
        const span = (hi - lo + 1) / w;
        let v = span >= 1 ? 50 : span * span * span * 10;
        if (touchesSack) v *= sackBias;
        total += v * weights[c];
      }
    }
    let top = g.h;
    for (let i = 0; i < g.size; i++)
      if (color[i] !== EMPTY && color[i] !== STONE && color[i] !== SACK) {
        top = Math.floor(i / w);
        break;
      }
    const fill = (g.h - top) / g.h;
    return total - fill * fill * 30 - (top < 16 ? (16 - top) * 15 : 0);
  }

  /** Sacks (alive in the session) touched by the current clear marks. */
  sackHits(s: Session): { hits: number; breaks: number } {
    const g = this.g;
    const { marked, obstacleHit } = this.res;
    let hits = 0;
    let breaks = 0;
    for (const sk of s.sacks.list) {
      if (sk.hp <= 0) continue;
      let hit = false;
      for (let y = sk.y - 1; y <= sk.y + sk.h && !hit; y++) {
        if (y < 0 || y >= g.h) continue;
        for (let x = sk.x - 1; x <= sk.x + sk.w; x++) {
          if (x < 0 || x >= g.w) continue;
          const inside = x >= sk.x && x < sk.x + sk.w && y >= sk.y && y < sk.y + sk.h;
          const corner = (x < sk.x || x >= sk.x + sk.w) && (y < sk.y || y >= sk.y + sk.h);
          const i = y * g.w + x;
          if ((inside && obstacleHit[i]) || (!inside && !corner && marked[i])) {
            hit = true;
            break;
          }
        }
      }
      if (hit) {
        hits++;
        if (sk.hp === 1) breaks++;
      }
    }
    return { hits, breaks };
  }

  evaluate(s: Session, p: Piece, rot: number, x: number, ctx: SmartContext): number {
    const g = this.g;
    g.copyFrom(s.grid);
    const r0 = p.rot;
    p.rot = rot;
    const shape = ROTATIONS[p.kind][rot];
    let y = 0;
    while (canStamp(g, shape, x, y + 1)) y++;
    stamp(g, p, x, y, this.rng);
    p.rot = r0;
    settle(g, this.rng, 300);
    let gain = 0;
    const paths = findClears(g, this.res);
    if (paths > 0) {
      const res = this.res;
      for (const gl of ctx.open) {
        const d = gl.def;
        const rem = gl.target - gl.current;
        if (d.type === 'clear_paths') {
          let n = 0;
          for (let r = 0; r < res.regionCount; r++) if (d.color === undefined || res.regionColor[r] === d.color) n++;
          gain += Math.min(n, rem) * (d.color === undefined ? 400 : 700);
        } else if (d.type === 'clear_color_grains') {
          gain += Math.min(res.colorCounts[d.color], rem) * 2.5;
        } else if (d.type === 'score') {
          gain += Math.min(res.cellCount + 100 * paths, rem) * 0.6;
        } else if (d.type === 'clear_obstacles') {
          const { hits, breaks } = this.sackHits(s);
          gain += hits * 250 + Math.min(breaks, rem) * 350;
        }
      }
      gain += 100 * paths; // any clear makes room and keeps the chain going
      removeMarked(g, res);
      settle(g, this.rng, 300);
    }
    return gain + this.shape(s, ctx.weights, ctx.sackBias);
  }
}

interface SmartContext {
  open: Session['goals']['goals'];
  weights: Float64Array;
  sackBias: number;
}

const smartEvaluators = new Map<string, SmartEvaluator>();

/** Goal-aware greedy move choice (see SmartEvaluator). Null if nothing fits. */
export function chooseSmartMove(s: Session, xStep = 4): BotMove | null {
  const grid = s.grid;
  const key = `${grid.w}x${grid.h}`;
  let ev = smartEvaluators.get(key);
  if (!ev) smartEvaluators.set(key, (ev = new SmartEvaluator(grid.w, grid.h)));
  const open = s.goals.goals.filter((gl) => !goalDone(gl));
  const weights = new Float64Array(JOKER + 1).fill(1);
  let sackBias = 1;
  for (const gl of open) {
    const d = gl.def;
    if (d.type === 'clear_paths' || d.type === 'clear_color_grains') {
      if (d.color !== undefined) weights[d.color] = 2.5;
    }
    if (d.type === 'clear_obstacles') sackBias = 2;
  }
  const ctx: SmartContext = { open, weights, sackBias };
  let best: BotMove | null = null;
  let bestScore = -Infinity;
  for (let slot = 0; slot < s.tray.length; slot++) {
    const p = s.tray[slot];
    if (!p) continue;
    const rots = p.kind === 'O' && !p.color2 ? 1 : 4;
    for (let rot = 0; rot < rots; rot++) {
      const shape = ROTATIONS[p.kind][rot];
      const mx = maxX(grid, shape);
      for (let x = 0; x <= mx; x += x + xStep > mx && x < mx ? mx - x : xStep) {
        if (!canStamp(grid, shape, x, 0)) continue;
        const sc = ev.evaluate(s, p, rot, x, ctx);
        if (sc > bestScore) {
          bestScore = sc;
          best = { slot, rot, x };
        }
      }
    }
  }
  return best;
}

export interface TrialResult {
  id: number;
  attempt: number;
  state: SessionState;
  reason: LoseReason | null;
  /** Final score (includes the end bonus on a win). */
  score: number;
  bonus: number;
  placed: number;
  bestChain: number;
  /** Goal progress 0..1 at the end. */
  progress: number;
  /** [current, target] per goal at the end. */
  goals: [number, number][];
}

/** One bot play-through of attempt `attempt` (GDD §4.2 seeding: board fixed, pieces vary). */
export function playTrial(level: LevelDef, attempt: number, bot: BotKind = 'greedy', maxMoves = 500): TrialResult {
  const s = new Session(level, { attempt });
  const choose = bot === 'smart' ? chooseSmartMove : chooseMove;
  s.runUntilSettled();
  for (let n = 0; n < maxMoves && s.isPlaying; n++) {
    const m = choose(s);
    if (!m) break;
    const p = s.tray[m.slot];
    if (p) p.rot = m.rot;
    s.drop(m.slot, m.x);
    s.runUntilSettled();
  }
  return {
    id: level.id,
    attempt,
    state: s.state,
    reason: s.loseReason,
    score: s.score,
    bonus: s.endBonus,
    placed: s.placed,
    bestChain: s.bestChain,
    progress: s.goals.progress(),
    goals: s.goals.goals.map((g) => [g.current, g.target] as [number, number]),
  };
}

export interface SweepResult {
  id: number;
  attempt: number;
  /** Pieces placed when the last goal completed; null = never (board full / move cap). */
  needed: number | null;
  /** Score at the moment of winning (before the end bonus). */
  scoreAtWin: number;
}

/**
 * Piece-limit sweep: play with an unlimited piece budget and record how many pieces the
 * bot needed. The bot's choices do not depend on the limit, so the win rate for any
 * limit L is ≈ P(needed ≤ L) — one run gives the whole curve.
 */
export function playUnlimited(level: LevelDef, attempt: number, bot: BotKind = 'smart', maxMoves = 80): SweepResult {
  const lv: LevelDef = { ...level, pieceLimit: null };
  const s = new Session(lv, { attempt });
  const choose = bot === 'smart' ? chooseSmartMove : chooseMove;
  s.runUntilSettled();
  for (let n = 0; n < maxMoves && s.isPlaying; n++) {
    const m = choose(s);
    if (!m) break;
    const p = s.tray[m.slot];
    if (p) p.rot = m.rot;
    s.drop(m.slot, m.x);
    s.runUntilSettled();
  }
  const won = s.state === 'won';
  return { id: level.id, attempt, needed: won ? s.placed : null, scoreAtWin: won ? s.score - s.endBonus : 0 };
}

/** Target first-try win rate for the calibration bot by GDD difficulty (§8 table, interpolated). */
export const TARGET_WIN_RATE: Record<number, number> = { 1: 0.97, 2: 0.95, 3: 0.85, 4: 0.78, 5: 0.68, 6: 0.6, 7: 0.5, 8: 0.42, 9: 0.33, 10: 0.28 };

/** Smallest piece limit whose sweep win rate reaches `rate` (null if never). */
export function limitForRate(sweep: readonly SweepResult[], rate: number): number | null {
  const need = sweep.map((r) => (r.needed === null ? Infinity : r.needed)).sort((a, b) => a - b);
  const k = Math.ceil(rate * need.length) - 1;
  const v = need[Math.max(0, k)];
  return Number.isFinite(v) ? v : null;
}

/** Win rate at limit L estimated from a sweep. */
export function rateAtLimit(sweep: readonly SweepResult[], limit: number): number {
  return sweep.filter((r) => r.needed !== null && r.needed <= limit).length / Math.max(1, sweep.length);
}

/** Linear-interpolated percentile (p in 0..1) of an unsorted list. */
export function percentile(values: readonly number[], p: number): number {
  if (!values.length) return NaN;
  const a = [...values].sort((x, y) => x - y);
  const pos = (a.length - 1) * p;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  return a[lo] + (a[hi] - a[lo]) * (pos - lo);
}

const round50 = (v: number): number => Math.round(v / 50) * 50;

export interface LevelSummary {
  id: number;
  name: string;
  trials: number;
  wins: number;
  winRate: number;
  meanScore: number;
  /** Over won games only (GDD star rule). */
  median: number;
  p80: number;
  p10: number;
  outOfPieces: number;
  noSpace: number;
  meanPlacedWin: number;
  meanProgressLoss: number;
  currentStars: [number, number, number];
  suggestedStars: [number, number, number] | null;
  pending: Feature[];
  proxy: string | null;
}

/** Minimum number of won games before stars are suggested. */
export const MIN_WINS_FOR_STARS = 5;

export function suggestStars(level: LevelDef, winScores: readonly number[]): [number, number, number] | null {
  if (winScores.length < MIN_WINS_FOR_STARS) return null;
  const scoreGoal = level.goals.find((g) => g.type === 'score');
  let s1 = round50(percentile(winScores, 0.5));
  let s2 = round50(percentile(winScores, 0.8));
  const s0 = scoreGoal && scoreGoal.type === 'score' ? scoreGoal.value : Math.min(round50(percentile(winScores, 0.1)), s1);
  s1 = Math.max(s1, s0);
  if (s2 <= s1) s2 = s1 + 50;
  return [s0, s1, s2];
}

export function summarize(prep: PreparedLevel, trials: readonly TrialResult[]): LevelSummary {
  const won = trials.filter((t) => t.state === 'won');
  const lost = trials.filter((t) => t.state !== 'won');
  const winScores = won.map((t) => t.score);
  const mean = (xs: readonly number[]): number => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : NaN);
  const raw = prep.raw;
  const cur = (Array.isArray(raw.stars) ? raw.stars : [0, 0, 0]) as [number, number, number];
  return {
    id: prep.id,
    name: prep.name,
    trials: trials.length,
    wins: won.length,
    winRate: trials.length ? won.length / trials.length : NaN,
    meanScore: mean(trials.map((t) => t.score)),
    median: percentile(winScores, 0.5),
    p80: percentile(winScores, 0.8),
    p10: percentile(winScores, 0.1),
    outOfPieces: lost.filter((t) => t.reason === 'out_of_pieces').length,
    noSpace: lost.filter((t) => t.reason === 'no_space').length,
    meanPlacedWin: mean(won.map((t) => t.placed)),
    meanProgressLoss: mean(lost.map((t) => t.progress)),
    currentStars: cur,
    suggestedStars: prep.level ? suggestStars(prep.level, winScores) : null,
    pending: prep.pending,
    proxy: prep.proxy,
  };
}

/** ASCII dump of a level's starting board (after obstacles + prefill + settle). */
export function boardAscii(level: LevelDef): string {
  const s = new Session(level);
  const g = s.grid;
  let top = g.h;
  for (let i = 0; i < g.size; i++)
    if (g.color[i] !== EMPTY) {
      top = Math.floor(i / g.w);
      break;
    }
  const ready = findClears(g, ClearResult.for(g));
  const lines: string[] = [`hazır yol: ${ready}${ready ? '  <-- GEÇERSİZ (GDD §8)' : ''}`];
  for (let y = Math.max(0, top - 2); y < g.h; y++) {
    let line = '';
    for (let x = 0; x < g.w; x++) {
      const i = y * g.w + x;
      const c = g.color[i];
      if (c === EMPTY) line += '.';
      else if (c === STONE) line += '#';
      else if (g.flags[i] & FLAG_BOMB) line += '*';
      else if (c <= 9) line += String(c);
      else line += '?';
    }
    lines.push(`${String(y).padStart(2)}${y % 4 === 0 ? '-' : ' '}${line}`);
  }
  return lines.join('\n');
}
