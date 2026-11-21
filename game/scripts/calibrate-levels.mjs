#!/usr/bin/env node
// Level calibration CLI (Level Designer tool). Runs the greedy QA bot many times per
// level in parallel worker threads and prints win rate + score distribution.
// No extra packages: TypeScript sources are loaded through Vite's runnerImport.
//
// Usage (from game/):
//   node scripts/calibrate-levels.mjs                     # all levels, 40 attempts each
//   node scripts/calibrate-levels.mjs --trials 50 --levels 1-10,15 --jobs 4
//   node scripts/calibrate-levels.mjs --apply             # write suggested stars into the JSON files
//   node scripts/calibrate-levels.mjs --json out.json --md out.md
//   node scripts/calibrate-levels.mjs --bot greedy        # only src/dev/bot.ts (default: both bots)
//   node scripts/calibrate-levels.mjs --sweep --trials 40 # piece-limit sweep (unlimited pieces, suggests limits)
//   node scripts/calibrate-levels.mjs --show 3            # ASCII of the starting board
//
// --apply only touches levels with no pending mechanic and no proxy, and at least
// MIN_WINS_FOR_STARS bot wins (2★ = median of won games, 3★ = 80th percentile).
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { cpus } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { isMainThread, parentPort, Worker, workerData } from 'node:worker_threads';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..');
const DATA_DIR = join(ROOT, 'src/levels/data');
const CORE = join(HERE, 'calibrate-levels.ts');

async function loadCore() {
  const { runnerImport } = await import('vite');
  const { module } = await runnerImport(CORE, { root: ROOT, configFile: false, logLevel: 'error' });
  return module;
}

export function loadRawLevels(dir = DATA_DIR) {
  return readdirSync(dir)
    .filter((f) => f.endsWith('.json'))
    .sort()
    .map((f) => ({ file: join(dir, f), raw: JSON.parse(readFileSync(join(dir, f), 'utf8')) }));
}

// ---------- JSON formatting (short values inline, prefill rows one per line) ----------
function inline(v) {
  if (Array.isArray(v)) return `[${v.map(inline).join(', ')}]`;
  if (v && typeof v === 'object') {
    const parts = Object.entries(v).map(([k, x]) => `${JSON.stringify(k)}: ${inline(x)}`);
    return parts.length ? `{ ${parts.join(', ')} }` : '{}';
  }
  return JSON.stringify(v);
}

function fmt(v, ind, key) {
  if (v === null || typeof v !== 'object') return JSON.stringify(v);
  const one = inline(v);
  if (key !== 'rows' && ind.length > 0 && one.length + ind.length <= 100) return one;
  if (key !== 'rows' && ind.length === 0 && Array.isArray(v) && one.length <= 100) return one;
  const next = ind + '  ';
  if (Array.isArray(v)) {
    if (!v.length) return '[]';
    return `[\n${v.map((x) => next + fmt(x, next, null)).join(',\n')}\n${ind}]`;
  }
  const entries = Object.entries(v);
  if (!entries.length) return '{}';
  return `{\n${entries.map(([k, x]) => `${next}${JSON.stringify(k)}: ${fmt(x, next, k)}`).join(',\n')}\n${ind}}`;
}

export function formatLevelJson(obj) {
  const top = Object.entries(obj).map(([k, x]) => `  ${JSON.stringify(k)}: ${fmt(x, '  ', k)}`);
  return `{\n${top.join(',\n')}\n}\n`;
}

// ---------- worker ----------
async function workerMain() {
  const core = await loadCore();
  const features = core.detectFeatures();
  const levels = new Map();
  for (const { raw } of loadRawLevels()) {
    const p = core.prepareLevel(raw, features);
    if (p.level) levels.set(p.id, p.level);
  }
  parentPort.on('message', (msg) => {
    if (msg.type === 'stop') process.exit(0);
    const lv = levels.get(msg.id);
    const trial = msg.sweep ? core.playUnlimited(lv, msg.attempt, msg.bot) : core.playTrial(lv, msg.attempt, msg.bot);
    parentPort.postMessage({ type: 'result', bot: msg.bot, trial });
  });
  parentPort.postMessage({ type: 'ready' });
}

// ---------- main ----------
function parseArgs(argv) {
  const o = { trials: 40, jobs: Math.max(1, Math.min(cpus().length, 8)), levels: null, apply: false, json: null, md: null, show: null, start: 0, bot: 'both', primary: 'smart', sweep: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const val = () => argv[++i];
    if (a === '--trials') o.trials = Number(val());
    else if (a === '--jobs') o.jobs = Number(val());
    else if (a === '--levels') o.levels = val();
    else if (a === '--start') o.start = Number(val());
    else if (a === '--bot') o.bot = val();
    else if (a === '--sweep') o.sweep = true;
    else if (a === '--primary') o.primary = val();
    else if (a === '--apply') o.apply = true;
    else if (a === '--json') o.json = val();
    else if (a === '--md') o.md = val();
    else if (a === '--show') o.show = val();
    else if (a === '-h' || a === '--help') {
      console.log(readFileSync(fileURLToPath(import.meta.url), 'utf8').split('\n').slice(1, 19).join('\n'));
      process.exit(0);
    } else throw new Error(`unknown argument ${a}`);
  }
  return o;
}

function parseIds(spec) {
  if (!spec) return null;
  const ids = new Set();
  for (const part of spec.split(',')) {
    const [a, b] = part.split('-').map(Number);
    for (let i = a; i <= (b || a); i++) ids.add(i);
  }
  return ids;
}

const pct = (x) => (Number.isFinite(x) ? `${Math.round(x * 100)}%` : '–');
const num = (x) => (Number.isFinite(x) ? String(Math.round(x)) : '–');

function table(summaries, labels, other) {
  const head = '| No | İsim | Kazanma (yıldız botu) | Kazanma (diğer bot) | Ort. puan | Medyan (kazanılan) | P80 (kazanılan) | Kayıp: parça/tahta | Yıldız (dosya) | Yıldız (öneri) | Not |';
  const sep = '|---|---|---|---|---|---|---|---|---|---|---|';
  const rows = summaries.map((s) => {
    const o = other.find((x) => x.id === s.id);
    const oc = o && o.trials ? `${pct(o.winRate)} (${o.wins}/${o.trials})` : '–';
    const note = [];
    if (s.pending.length) note.push(`mekanik bekleniyor: ${s.pending.map((f) => labels[f]).join(', ')}`);
    if (s.proxy) note.push(s.proxy);
    if (s.error) note.push(`HATA: ${s.error}`);
    return `| ${s.id} | ${s.name} | ${s.trials ? `${pct(s.winRate)} (${s.wins}/${s.trials})` : '–'} | ${oc} | ${num(s.meanScore)} | ${num(s.median)} | ${num(s.p80)} | ${s.trials ? `${s.outOfPieces}/${s.noSpace}` : '–'} | ${s.currentStars.join('/')} | ${s.suggestedStars ? s.suggestedStars.join('/') : '–'} | ${note.join('; ')} |`;
  });
  return [head, sep, ...rows].join('\n');
}

async function main() {
  const o = parseArgs(process.argv.slice(2));
  const core = await loadCore();
  const features = core.detectFeatures();
  const ids = parseIds(o.levels);
  const files = loadRawLevels().filter(({ raw }) => !ids || ids.has(raw.id));
  const preps = files.map(({ file, raw }) => ({ file, prep: core.prepareLevel(raw, features) }));

  if (o.show) {
    const showIds = parseIds(o.show);
    for (const { prep } of preps) {
      if (!showIds.has(prep.id)) continue;
      console.log(`\n== ${prep.id} ${prep.name} ${prep.errors.length ? '(HATA: ' + prep.errors.join('; ') + ')' : ''}`);
      if (prep.level) console.log(core.boardAscii(prep.level));
    }
    return;
  }

  console.log('Motor desteği:', Object.entries(features).map(([k, v]) => `${k}=${v ? 'var' : 'YOK'}`).join(', '));
  if (o.sweep && o.bot === 'both') o.bot = 'smart';
  const bots = o.bot === 'both' ? ['smart', 'greedy'] : [o.bot];
  if (!bots.includes(o.primary)) o.primary = bots[0];
  const tasks = [];
  for (const bot of bots)
    for (const { prep } of preps) if (prep.level) for (let a = 0; a < o.trials; a++) tasks.push({ bot, id: prep.id, attempt: o.start + a, sweep: o.sweep });
  console.log(`${preps.length} bölüm, ${tasks.length} oyun (botlar: ${bots.join(', ')}; yıldızlar: ${o.primary}), ${o.jobs} iş parçacığı…`);

  const results = new Map();
  for (const bot of bots) for (const { prep } of preps) results.set(`${bot}:${prep.id}`, []);
  const t0 = Date.now();
  await new Promise((done, fail) => {
    let next = 0;
    let finished = 0;
    let alive = 0;
    if (!tasks.length) return done();
    for (let j = 0; j < Math.min(o.jobs, tasks.length); j++) {
      const w = new Worker(fileURLToPath(import.meta.url), { workerData: { worker: true } });
      alive++;
      const feed = () => {
        if (next < tasks.length) w.postMessage({ type: 'run', ...tasks[next++] });
        else w.postMessage({ type: 'stop' });
      };
      w.on('message', (m) => {
        if (m.type === 'result') {
          results.get(`${m.bot}:${m.trial.id}`).push(m.trial);
          finished++;
          if (finished % 50 === 0) process.stderr.write(`  ${finished}/${tasks.length} (${Math.round((Date.now() - t0) / 1000)} sn)\n`);
        }
        feed();
      });
      w.on('error', fail);
      w.on('exit', () => {
        if (--alive === 0) done();
      });
    }
  });
  console.log(`Süre: ${Math.round((Date.now() - t0) / 1000)} sn`);

  if (o.sweep) {
    const bot = bots[0];
    console.log(`\nParça limiti taraması (${bot} bot, ${o.trials} deneme, sınırsız parça):\n`);
    console.log('| No | İsim | Zorluk | Hedef oran | Limit (dosya) | Oran @ dosya limiti | Önerilen limit | Gereken parça P50/P80/P95 | Hiç kazanamadı |');
    console.log('|---|---|---|---|---|---|---|---|---|');
    for (const { prep } of preps) {
      const sw = results.get(`${bot}:${prep.id}`);
      if (!sw || !sw.length) continue;
      const d = Number(prep.raw.difficulty ?? 5);
      const target = core.TARGET_WIN_RATE[d] ?? 0.6;
      const limit = prep.raw.pieceLimit;
      const q = (r) => core.limitForRate(sw, r) ?? '∞';
      const never = sw.filter((r) => r.needed === null).length;
      console.log(`| ${prep.id} | ${prep.name} | ${d} | ${pct(target)} | ${limit} | ${pct(core.rateAtLimit(sw, limit))} | ${core.limitForRate(sw, target) ?? '–'} | ${q(0.5)}/${q(0.8)}/${q(0.95)} | ${never}/${sw.length} |`);
    }
    return;
  }

  const summarizeBot = (bot) =>
    preps.map(({ prep }) => {
      const s = core.summarize(prep, results.get(`${bot}:${prep.id}`).sort((a, b) => a.attempt - b.attempt));
      if (prep.errors.length && !prep.level) s.error = prep.errors.join('; ');
      return s;
    });
  const byBot = Object.fromEntries(bots.map((b) => [b, summarizeBot(b)]));
  const summaries = byBot[o.primary];
  const other = bots.length > 1 ? byBot[bots.find((b) => b !== o.primary)] : [];
  const md = `Yıldız botu: ${o.primary}${other.length ? `, diğer bot: ${bots.find((b) => b !== o.primary)}` : ''}; ${o.trials} deneme/bölüm\n\n` + table(summaries, core.FEATURE_LABEL, other);
  console.log('\n' + md);

  if (o.json) writeFileSync(o.json, JSON.stringify({ date: new Date().toISOString(), trials: o.trials, primary: o.primary, features, byBot }, null, 2));
  if (o.md) writeFileSync(o.md, md + '\n');
  if (o.apply) {
    for (const { file, prep } of preps) {
      const s = summaries.find((x) => x.id === prep.id);
      if (!s || !s.suggestedStars || s.pending.length || s.proxy) continue;
      const raw = JSON.parse(readFileSync(file, 'utf8'));
      raw.stars = s.suggestedStars;
      writeFileSync(file, formatLevelJson(raw));
      console.log(`yıldızlar yazıldı: ${prep.id} → ${s.suggestedStars.join('/')}`);
    }
  }
}

if (!isMainThread && workerData?.worker) {
  workerMain();
} else if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
