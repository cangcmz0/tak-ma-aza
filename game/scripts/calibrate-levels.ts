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
import { chooseMove } from '../src/dev/bot';
import { ClearResult, findClears } from '../src/engine/clear';
import { EMPTY, FLAG_BOMB, FLAG_STATIC, MAX_SAND_COLOR, STONE } from '../src/engine/grid';
import { isGoalType } from '../src/game/goals';
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
}

/** One bot play-through of attempt `attempt` (GDD §4.2 seeding: board fixed, pieces vary). */
export function playTrial(level: LevelDef, attempt: number, maxMoves = 500): TrialResult {
  const s = new Session(level, { attempt });
  s.runUntilSettled();
  for (let n = 0; n < maxMoves && s.isPlaying; n++) {
    const m = chooseMove(s);
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
  };
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
