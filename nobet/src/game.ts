// Oyun simülasyonu. DOM'a dokunmaz; durum tamamen JSON'a çevrilebilir.
import { COMPLAINT_BY_ID, NightCfg, RELATIVE_LINES, ToolId, Zone, ZONE_RANK, dailyConfig, nightConfig } from './data';
import { daySeed } from './daily';
import { PatientSeed, makePatient } from './patients';
import { Rng } from './rng';
import type { Vitals } from './triage';

export const BAL = {
  waitSlots: 6,
  /** Bekleme salonunda saniyede düşen durum puanı (100'den). */
  decay: { red: 3.3, yellow: 1.45 },
  /** Yeşil hastanın sabrı saniyede bu kadar azalır. */
  patience: 1.8,
  ambMult: 1.25,
  /** Yatakta tedavi beklerken düşüş çarpanı (hemşire başında). */
  bedMult: 0.45,
  /** Hafife alınmış hasta, kendi alanından düşük bir yatakta beklerken. */
  underBedMult: 0.8,
  /** Hafife alınmış hasta tedavi sırasında da kötüleşir. */
  underTreatDecay: 0.45,
  treat: { red: 9, yellow: 7, green: 4 },
  underTreatMult: 1.6,
  redBedSpeed: 0.85,
  critical: 30,
  codeRestore: 50,
  ambWarn: 4,
  burstChance: 0.12,
  /** Hasta yakını kaç saniye sonra kavga çıkarır. */
  relTime: 9,
  rep: { start: 80, discharge: 2, complaint: -12, wrongTool: -4, transfer: -25, overflow: -6, under: -5, over: -2, relFight: -8 },
  score: { red: 40, yellow: 25, green: 10, cond: 15, triage: 5, comboStep: 3, comboMax: 5, codeSaved: 20, calm: 5 },
};

export type Status = 'waiting' | 'bed' | 'treating' | 'done';
export type TriageResult = 'correct' | 'over' | 'under';

export interface Patient {
  id: number;
  name: string;
  age: number;
  avatar: string;
  kid: boolean;
  complaintId: string;
  line: string;
  vitals: Vitals;
  /** Gerçek aciliyet (oyuncu bulgulardan çıkarır). */
  severity: Zone;
  amb: boolean;
  hp: number;
  patience: number;
  status: Status;
  zone: Zone | null;
  bed: number;
  progress: number;
  treatTime: number;
  tool: ToolId | null;
  arrivedAt: number;
  triage: TriageResult | null;
  critical: boolean;
  coding: boolean;
  /** Bağıran yakının kalan sabrı (sn); 0 = yakın yok. */
  rel: number;
  relLine: string;
}

export interface Stats {
  arrivals: number;
  discharged: number;
  byZone: Record<Zone, number>;
  triaged: number;
  correct: number;
  under: number;
  over: number;
  wrongTool: number;
  complaints: number;
  transferred: number;
  codes: number;
  codesSaved: number;
  diverted: number;
  bestCombo: number;
  relCalmed: number;
  relFights: number;
}

/** Önceden hesaplanmış geliş. Oyuncunun hamleleri sırayı değiştirmez. */
export interface Arrival {
  at: number;
  amb: boolean;
  warned: boolean;
  p: PatientSeed;
}

/** Hasta sonuçları: r/y/g doğru triajla taburcu, m yanlış triajla taburcu, l kaybedildi, h sabaha devredildi. */
export type LogCode = 'r' | 'y' | 'g' | 'm' | 'l' | 'h';

export interface GameState {
  v: 2;
  night: number;
  daily: string | null;
  seed: number;
  rng: number;
  t: number;
  duration: number;
  queue: Arrival[];
  qi: number;
  rels: { at: number; line: string }[];
  ri: number;
  patients: Patient[];
  beds: Record<Zone, (number | null)[]>;
  waiting: number[];
  score: number;
  rep: number;
  combo: number;
  stats: Stats;
  log: Record<string, LogCode>;
  codeQueue: number[];
  activeCode: number | null;
  over: null | 'done' | 'fired';
  handover: number;
}

export type GameEvent =
  | { type: 'arrive'; pid: number; amb: boolean }
  | { type: 'overflow' }
  | { type: 'ambWarn'; inSec: number }
  | { type: 'assign'; pid: number; zone: Zone; result: TriageResult | 'move'; points: number; combo: number }
  | { type: 'treat'; pid: number; tool: ToolId; ok: boolean }
  | { type: 'ready'; pid: number }
  | { type: 'discharge'; pid: number; points: number; zone: Zone }
  | { type: 'left'; pid: number }
  | { type: 'critical'; pid: number }
  | { type: 'code'; pid: number }
  | { type: 'codeEnd'; pid: number; saved: boolean }
  | { type: 'relative'; pid: number; line: string }
  | { type: 'relCalm'; pid: number; points: number }
  | { type: 'relFight'; pid: number }
  | { type: 'end'; result: 'done' | 'fired' };

/** İlk gecenin elle seçilmiş ilk üç hastası: yeşil, sarı, kırmızı. */
export const TUTORIAL: { at: number; complaintId: string; severity: Zone }[] = [
  { at: 1.5, complaintId: 'rapor', severity: 'green' },
  { at: 14, complaintId: 'dusme', severity: 'yellow' },
  { at: 27, complaintId: 'gogus', severity: 'red' },
];
const TUTORIAL_END = 40;

function emptyStats(): Stats {
  return {
    arrivals: 0, discharged: 0, byZone: { red: 0, yellow: 0, green: 0 }, triaged: 0, correct: 0, under: 0,
    over: 0, wrongTool: 0, complaints: 0, transferred: 0, codes: 0, codesSaved: 0, diverted: 0,
    bestCombo: 0, relCalmed: 0, relFights: 0,
  };
}

export function configOf(s: Pick<GameState, 'night' | 'daily' | 'seed'>): NightCfg {
  return s.daily ? dailyConfig(s.daily, s.seed) : nightConfig(s.night);
}

/** Gecenin bütün gelişlerini baştan üretir. */
export function buildSchedule(cfg: NightCfg, rng: Rng): Arrival[] {
  const list: Arrival[] = [];
  const recent: string[] = [];
  const add = (at: number, opts: { severity?: Zone; complaintId?: string; amb?: boolean }) => {
    const p = makePatient(rng, cfg, { ...opts, avoid: recent });
    recent.push(p.complaintId);
    if (recent.length > 3) recent.shift();
    list.push({ at, amb: !!opts.amb, warned: false, p });
  };
  if (cfg.tutorial) for (const sp of TUTORIAL) add(sp.at, sp);
  let t = cfg.tutorial ? TUTORIAL_END : 1.2;
  while (t <= cfg.duration - 6) {
    add(t, {});
    // Ara sıra iki hasta peş peşe gelir.
    t += rng.chance(BAL.burstChance) ? rng.range(1, 2) : rng.range(cfg.spawn[0], cfg.spawn[1]);
  }
  if (cfg.ambulance) {
    let a = rng.range(cfg.ambulance[0], cfg.ambulance[1]) * 0.6;
    while (a <= cfg.duration - 10) {
      add(a, { severity: 'red', amb: true });
      a += rng.range(cfg.ambulance[0], cfg.ambulance[1]);
    }
  }
  return list.sort((x, y) => x.at - y.at);
}

function buildRelatives(cfg: NightCfg, rng: Rng): { at: number; line: string }[] {
  if (!cfg.relatives) return [];
  const out: { at: number; line: string }[] = [];
  let t = rng.range(cfg.relatives[0], cfg.relatives[1]) * 0.7;
  while (t <= cfg.duration - 12) {
    out.push({ at: t, line: rng.pick(RELATIVE_LINES) });
    t += rng.range(cfg.relatives[0], cfg.relatives[1]);
  }
  return out;
}

export class Game {
  s: GameState;
  cfg: NightCfg;
  rng: Rng;
  events: GameEvent[] = [];

  /** Sayı: hikâye gecesi. `{ daily }`: o günün nöbeti. GameState: kayıttan devam. */
  constructor(init: number | { daily: string } | GameState, seed = Math.floor(Math.random() * 2147483646) + 1) {
    if (typeof init === 'object' && 'v' in init) {
      this.s = init;
      this.cfg = configOf(init);
      this.rng = new Rng(init.rng);
      return;
    }
    const daily = typeof init === 'object' ? init.daily : null;
    const night = typeof init === 'number' ? init : 0;
    if (daily) seed = daySeed(daily);
    this.cfg = configOf({ night, daily, seed });
    this.rng = new Rng(seed);
    const cfg = this.cfg;
    const queue = buildSchedule(cfg, this.rng);
    const rels = buildRelatives(cfg, this.rng);
    this.s = {
      v: 2,
      night,
      daily,
      seed,
      rng: this.rng.s,
      t: 0,
      duration: cfg.duration,
      queue,
      qi: 0,
      rels,
      ri: 0,
      patients: [],
      beds: {
        red: Array(cfg.beds.red).fill(null),
        yellow: Array(cfg.beds.yellow).fill(null),
        green: Array(cfg.beds.green).fill(null),
      },
      waiting: [],
      score: 0,
      rep: BAL.rep.start,
      combo: 0,
      stats: emptyStats(),
      log: {},
      codeQueue: [],
      activeCode: null,
      over: null,
      handover: 0,
    };
  }

  serialize(): GameState {
    this.s.rng = this.rng.s;
    return JSON.parse(JSON.stringify(this.s));
  }

  get(pid: number): Patient | undefined {
    return this.s.patients.find((p) => p.id === pid);
  }

  freeBeds(zone: Zone): number {
    return this.s.beds[zone].filter((b) => b === null).length;
  }

  private emit(e: GameEvent) {
    this.events.push(e);
  }

  get busy(): boolean {
    return this.s.over !== null || this.s.activeCode !== null;
  }

  tick(dt: number) {
    const s = this.s;
    if (this.busy) return;
    s.t += dt;
    this.runArrivals();
    this.runRelatives();
    for (const p of s.patients.slice()) {
      if (s.over) return;
      this.updatePatient(p, dt);
    }
    if (s.over) return;
    if (s.codeQueue.length) {
      s.activeCode = s.codeQueue.shift()!;
      s.stats.codes++;
      this.emit({ type: 'code', pid: s.activeCode });
      return;
    }
    if (s.t >= s.duration) this.finish('done');
  }

  private runArrivals() {
    const s = this.s;
    for (let i = s.qi; i < s.queue.length && s.queue[i].at <= s.t + BAL.ambWarn; i++) {
      const a = s.queue[i];
      if (a.amb && !a.warned) {
        a.warned = true;
        this.emit({ type: 'ambWarn', inSec: Math.max(1, Math.round(a.at - s.t)) });
      }
    }
    while (s.qi < s.queue.length && s.queue[s.qi].at <= s.t) {
      const id = s.qi + 1;
      this.admit(id, s.queue[s.qi]);
      s.qi++;
    }
  }

  private admit(id: number, a: Arrival) {
    const s = this.s;
    if (s.waiting.length >= BAL.waitSlots) {
      s.stats.diverted++;
      s.log[id] = 'l';
      this.emit({ type: 'overflow' });
      this.addRep(BAL.rep.overflow);
      return;
    }
    const p: Patient = {
      id,
      ...a.p,
      amb: a.amb,
      hp: 100,
      patience: 100,
      status: 'waiting',
      zone: null,
      bed: -1,
      progress: 0,
      treatTime: 0,
      tool: null,
      arrivedAt: s.t,
      triage: null,
      critical: false,
      coding: false,
      rel: 0,
      relLine: '',
    };
    s.patients.push(p);
    if (p.amb) s.waiting.unshift(p.id);
    else s.waiting.push(p.id);
    s.stats.arrivals++;
    this.emit({ type: 'arrive', pid: p.id, amb: p.amb });
  }

  private runRelatives() {
    const s = this.s;
    while (s.ri < s.rels.length && s.rels[s.ri].at <= s.t) {
      const r = s.rels[s.ri++];
      // En uzun bekleyen hastanın yakını patlar.
      const target = s.patients
        .filter((p) => (p.status === 'waiting' || p.status === 'bed') && p.rel === 0 && !p.coding)
        .sort((a, b) => a.arrivedAt - b.arrivedAt)[0];
      if (!target) continue;
      target.rel = BAL.relTime;
      target.relLine = r.line;
      this.emit({ type: 'relative', pid: target.id, line: r.line });
    }
  }

  private updatePatient(p: Patient, dt: number) {
    const s = this.s;
    const sev = ZONE_RANK[p.severity];
    const zr = p.zone ? ZONE_RANK[p.zone] : -1;
    const usesHp = p.severity !== 'green';
    let mult = 0;
    switch (p.status) {
      case 'waiting':
        mult = 1;
        break;
      case 'bed':
        mult = zr >= sev ? BAL.bedMult : BAL.underBedMult;
        break;
      case 'treating':
        mult = zr >= sev || !usesHp ? 0 : BAL.underTreatDecay;
        p.progress = Math.min(1, p.progress + dt / p.treatTime);
        if (p.progress >= 1) {
          p.status = 'done';
          this.emit({ type: 'ready', pid: p.id });
        }
        break;
      case 'done':
        mult = 0;
        break;
    }
    if (p.rel > 0) {
      p.rel = Math.max(0, p.rel - dt);
      if (p.rel === 0) {
        s.stats.relFights++;
        this.emit({ type: 'relFight', pid: p.id });
        this.addRep(BAL.rep.relFight);
        if (s.over) return;
      }
    }
    if (usesHp) {
      if (mult > 0) {
        const rate = BAL.decay[p.severity as 'red' | 'yellow'] * (p.amb ? BAL.ambMult : 1);
        p.hp = Math.max(0, p.hp - rate * mult * dt);
      }
      const crit = p.hp < BAL.critical && p.status !== 'done';
      if (crit && !p.critical) this.emit({ type: 'critical', pid: p.id });
      p.critical = crit;
      if (p.hp <= 0 && !p.coding) {
        p.coding = true;
        p.rel = 0;
        s.codeQueue.push(p.id);
      }
    } else {
      if (mult > 0) p.patience = Math.max(0, p.patience - BAL.patience * (p.status === 'bed' ? 0.9 : 1) * mult * dt);
      p.critical = p.patience < BAL.critical && p.status !== 'done';
      if (p.patience <= 0) {
        s.stats.complaints++;
        s.log[p.id] = 'l';
        this.emit({ type: 'left', pid: p.id });
        this.remove(p.id);
        this.addRep(BAL.rep.complaint);
      }
    }
  }

  private remove(pid: number) {
    const s = this.s;
    s.patients = s.patients.filter((p) => p.id !== pid);
    s.waiting = s.waiting.filter((id) => id !== pid);
    s.codeQueue = s.codeQueue.filter((id) => id !== pid);
    for (const z of ['red', 'yellow', 'green'] as Zone[]) {
      s.beds[z] = s.beds[z].map((b) => (b === pid ? null : b));
    }
  }

  private addRep(d: number) {
    const s = this.s;
    s.rep = Math.max(0, Math.min(100, s.rep + d));
    if (s.rep <= 0) this.finish('fired');
  }

  private finish(result: 'done' | 'fired') {
    const s = this.s;
    if (s.over) return;
    s.over = result;
    s.activeCode = null;
    s.handover = s.patients.length;
    for (const p of s.patients) s.log[p.id] = 'h';
    this.emit({ type: 'end', result });
  }

  /** Hastayı bir alana yatırır (ilk kez ise triaj sayılır) ya da alanını değiştirir. */
  assign(pid: number, zone: Zone, preferBed = -1): boolean {
    const s = this.s;
    const p = this.get(pid);
    if (!p || this.busy) return false;
    if (p.status !== 'waiting' && p.status !== 'bed') return false;
    if (p.zone === zone) return false;
    const bed = s.beds[zone][preferBed] === null ? preferBed : s.beds[zone].indexOf(null);
    if (bed < 0) return false;
    const first = p.status === 'waiting';
    if (first) s.waiting = s.waiting.filter((id) => id !== pid);
    else s.beds[p.zone!][p.bed] = null;
    s.beds[zone][bed] = pid;
    p.zone = zone;
    p.bed = bed;
    p.status = 'bed';
    let result: TriageResult | 'move' = 'move';
    let points = 0;
    if (first) {
      // Yatağa alınan hastanın yakını da susar.
      p.rel = 0;
      const d = ZONE_RANK[zone] - ZONE_RANK[p.severity];
      result = d === 0 ? 'correct' : d > 0 ? 'over' : 'under';
      p.triage = result;
      s.stats.triaged++;
      if (result === 'correct') {
        s.stats.correct++;
        s.combo++;
        s.stats.bestCombo = Math.max(s.stats.bestCombo, s.combo);
        points = BAL.score.triage + BAL.score.comboStep * Math.min(s.combo - 1, BAL.score.comboMax);
        s.score += points;
      } else {
        s.combo = 0;
        if (result === 'over') s.stats.over++;
        else s.stats.under++;
      }
    }
    this.emit({ type: 'assign', pid, zone, result, points, combo: s.combo });
    if (result === 'over') this.addRep(BAL.rep.over);
    if (result === 'under') this.addRep(BAL.rep.under);
    return true;
  }

  treat(pid: number, tool: ToolId): 'ok' | 'wrong' | 'invalid' {
    const s = this.s;
    const p = this.get(pid);
    if (!p || this.busy || p.status !== 'bed' || !p.zone) return 'invalid';
    if (COMPLAINT_BY_ID[p.complaintId].tool !== tool) {
      s.stats.wrongTool++;
      s.combo = 0;
      if (p.severity === 'green') p.patience = Math.max(1, p.patience - 15);
      else p.hp = Math.max(1, p.hp - 8);
      this.emit({ type: 'treat', pid, tool, ok: false });
      this.addRep(BAL.rep.wrongTool);
      return 'wrong';
    }
    const under = ZONE_RANK[p.zone] < ZONE_RANK[p.severity];
    p.treatTime = BAL.treat[p.severity] * (under ? BAL.underTreatMult : 1) * (p.zone === 'red' ? BAL.redBedSpeed : 1);
    p.status = 'treating';
    p.progress = 0;
    p.tool = tool;
    p.rel = 0;
    this.emit({ type: 'treat', pid, tool, ok: true });
    return 'ok';
  }

  /** Bağıran hasta yakınını sakinleştirir. */
  calm(pid: number): boolean {
    const s = this.s;
    const p = this.get(pid);
    if (!p || this.busy || p.rel <= 0) return false;
    p.rel = 0;
    s.stats.relCalmed++;
    s.score += BAL.score.calm;
    this.emit({ type: 'relCalm', pid, points: BAL.score.calm });
    return true;
  }

  /** Tedavisi biten hastayı taburcu eder (kırmızıyı servise yatırır) ve yatağı boşaltır. */
  discharge(pid: number): boolean {
    const s = this.s;
    const p = this.get(pid);
    if (!p || this.busy || p.status !== 'done') return false;
    const cond = p.severity === 'green' ? p.patience : p.hp;
    const points = BAL.score[p.severity] + Math.round((BAL.score.cond * cond) / 100);
    s.score += points;
    s.stats.discharged++;
    s.stats.byZone[p.severity]++;
    s.log[p.id] = p.triage === 'correct' ? (p.severity[0] as LogCode) : 'm';
    this.emit({ type: 'discharge', pid, points, zone: p.severity });
    this.remove(pid);
    this.addRep(BAL.rep.discharge);
    return true;
  }

  resolveCode(saved: boolean) {
    const s = this.s;
    const pid = s.activeCode;
    if (pid === null) return;
    s.activeCode = null;
    const p = this.get(pid);
    if (!p) return;
    p.coding = false;
    if (saved) {
      p.hp = BAL.codeRestore;
      p.critical = false;
      s.stats.codesSaved++;
      s.score += BAL.score.codeSaved;
      this.emit({ type: 'codeEnd', pid, saved: true });
    } else {
      s.stats.transferred++;
      s.log[p.id] = 'l';
      this.emit({ type: 'codeEnd', pid, saved: false });
      this.remove(pid);
      this.addRep(BAL.rep.transfer);
    }
  }
}

export interface Summary {
  result: 'done' | 'fired';
  stars: number;
  served: number;
  accuracy: number;
  criteria: { label: string; ok: boolean }[];
}

export function summarize(s: GameState): Summary {
  const st = s.stats;
  const seen = st.arrivals + st.diverted;
  const served = seen ? st.discharged / seen : 0;
  const accuracy = st.triaged ? st.correct / st.triaged : 0;
  const survived = s.over === 'done';
  const two = survived && served >= 0.6 && s.rep >= 50;
  const three = two && served >= 0.75 && accuracy >= 0.85 && st.transferred === 0;
  return {
    result: survived ? 'done' : 'fired',
    stars: !survived ? 0 : three ? 3 : two ? 2 : 1,
    served,
    accuracy,
    criteria: [
      { label: 'Sabaha kadar dayan', ok: survived },
      { label: 'Gelenlerin %60’ını taburcu et, Başhekim 50+', ok: two },
      { label: '%75 taburcu, %85 doğru triaj, sevk yok', ok: three },
    ],
  };
}

const LOG_EMOJI: Record<LogCode, string> = { r: '🟥', y: '🟨', g: '🟩', m: '🟧', l: '⬛', h: '⬜' };

/** Gelen her hasta için bir kare, geliş sırasıyla, satır başına 8. */
export function outcomeGrid(s: GameState, perRow = 8): string {
  const cells: string[] = [];
  for (let id = 1; id <= s.qi; id++) cells.push(LOG_EMOJI[s.log[id] ?? 'h']);
  const rows: string[] = [];
  for (let i = 0; i < cells.length; i += perRow) rows.push(cells.slice(i, i + perRow).join(''));
  return rows.join('\n');
}

/** 23:00'ten 08:00'e oyun saati, 5 dakikalık adımlarla. */
export function clockText(t: number, duration: number): string {
  const mins = 23 * 60 + Math.floor(((Math.min(t, duration) / duration) * 540) / 5) * 5;
  const m = mins % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
}
