// Oyun simülasyonu. DOM'a dokunmaz; durum tamamen JSON'a çevrilebilir.
import { COMPLAINT_BY_ID, NightCfg, ToolId, Zone, ZONE_RANK, nightConfig } from './data';
import { makePatient } from './patients';
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
  rep: { start: 80, discharge: 2, complaint: -12, wrongTool: -4, transfer: -25, overflow: -6, under: -5, over: -2 },
  score: { red: 40, yellow: 25, green: 10, cond: 15, triage: 5, codeSaved: 20 },
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
}

export interface GameState {
  v: 1;
  night: number;
  seed: number;
  rng: number;
  t: number;
  duration: number;
  nextId: number;
  nextSpawn: number;
  /** Sonraki ambulansın varış zamanı, yoksa -1. */
  nextAmb: number;
  ambWarned: boolean;
  scriptIdx: number;
  patients: Patient[];
  beds: Record<Zone, (number | null)[]>;
  waiting: number[];
  score: number;
  rep: number;
  stats: Stats;
  codeQueue: number[];
  activeCode: number | null;
  over: null | 'done' | 'fired';
  handover: number;
}

export type GameEvent =
  | { type: 'arrive'; pid: number; amb: boolean }
  | { type: 'overflow' }
  | { type: 'ambWarn'; inSec: number }
  | { type: 'assign'; pid: number; zone: Zone; result: TriageResult | 'move' }
  | { type: 'treat'; pid: number; tool: ToolId; ok: boolean }
  | { type: 'ready'; pid: number }
  | { type: 'discharge'; pid: number; points: number; zone: Zone }
  | { type: 'left'; pid: number }
  | { type: 'critical'; pid: number }
  | { type: 'code'; pid: number }
  | { type: 'codeEnd'; pid: number; saved: boolean }
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
  };
}

export class Game {
  s: GameState;
  cfg: NightCfg;
  rng: Rng;
  events: GameEvent[] = [];

  constructor(init: number | GameState, seed = Math.floor(Math.random() * 2147483646) + 1) {
    if (typeof init === 'number') {
      this.cfg = nightConfig(init);
      this.rng = new Rng(seed);
      const cfg = this.cfg;
      this.s = {
        v: 1,
        night: init,
        seed,
        rng: seed,
        t: 0,
        duration: cfg.duration,
        nextId: 1,
        nextSpawn: cfg.tutorial ? TUTORIAL_END : 1.2,
        nextAmb: cfg.ambulance ? this.rng.range(cfg.ambulance[0], cfg.ambulance[1]) * 0.6 : -1,
        ambWarned: false,
        scriptIdx: 0,
        patients: [],
        beds: {
          red: Array(cfg.beds.red).fill(null),
          yellow: Array(cfg.beds.yellow).fill(null),
          green: Array(cfg.beds.green).fill(null),
        },
        waiting: [],
        score: 0,
        rep: BAL.rep.start,
        stats: emptyStats(),
        codeQueue: [],
        activeCode: null,
        over: null,
        handover: 0,
      };
    } else {
      this.s = init;
      this.cfg = nightConfig(init.night);
      this.rng = new Rng(init.rng);
    }
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
    this.runSpawns();
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

  private runSpawns() {
    const s = this.s;
    const cfg = this.cfg;
    if (cfg.tutorial) {
      while (s.scriptIdx < TUTORIAL.length && s.t >= TUTORIAL[s.scriptIdx].at) {
        const sp = TUTORIAL[s.scriptIdx++];
        this.spawn({ severity: sp.severity, complaintId: sp.complaintId });
      }
    }
    const closing = s.t > s.duration - 6;
    if (!closing && s.t >= s.nextSpawn) {
      this.spawn({});
      // Ara sıra iki hasta peş peşe gelir.
      const gap = this.rng.chance(BAL.burstChance) ? this.rng.range(1, 2) : this.rng.range(cfg.spawn[0], cfg.spawn[1]);
      s.nextSpawn = s.t + gap;
    }
    if (cfg.ambulance && s.nextAmb > 0) {
      if (!s.ambWarned && s.t >= s.nextAmb - BAL.ambWarn) {
        if (s.nextAmb > s.duration - 10) {
          s.nextAmb = -1;
        } else {
          s.ambWarned = true;
          this.emit({ type: 'ambWarn', inSec: BAL.ambWarn });
        }
      }
      if (s.ambWarned && s.t >= s.nextAmb) {
        s.ambWarned = false;
        this.spawn({ severity: 'red', amb: true });
        s.nextAmb = s.t + this.rng.range(cfg.ambulance[0], cfg.ambulance[1]);
      }
    }
  }

  private spawn(opts: { severity?: Zone; complaintId?: string; amb?: boolean }) {
    const s = this.s;
    if (s.waiting.length >= BAL.waitSlots) {
      s.stats.diverted++;
      this.emit({ type: 'overflow' });
      this.addRep(BAL.rep.overflow);
      return;
    }
    const avoid = s.waiting.map((id) => this.get(id)?.complaintId ?? '');
    const seed = makePatient(this.rng, this.cfg, { ...opts, avoid });
    const p: Patient = {
      id: s.nextId++,
      ...seed,
      amb: !!opts.amb,
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
    };
    s.patients.push(p);
    if (p.amb) s.waiting.unshift(p.id);
    else s.waiting.push(p.id);
    s.stats.arrivals++;
    this.emit({ type: 'arrive', pid: p.id, amb: p.amb });
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
        s.codeQueue.push(p.id);
      }
    } else {
      if (mult > 0) p.patience = Math.max(0, p.patience - BAL.patience * (p.status === 'bed' ? 0.9 : 1) * mult * dt);
      p.critical = p.patience < BAL.critical && p.status !== 'done';
      if (p.patience <= 0) {
        s.stats.complaints++;
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
    if (first) {
      const d = ZONE_RANK[zone] - ZONE_RANK[p.severity];
      result = d === 0 ? 'correct' : d > 0 ? 'over' : 'under';
      p.triage = result;
      s.stats.triaged++;
      if (result === 'correct') {
        s.stats.correct++;
        s.score += BAL.score.triage;
      } else if (result === 'over') {
        s.stats.over++;
      } else {
        s.stats.under++;
      }
    }
    this.emit({ type: 'assign', pid, zone, result });
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
    this.emit({ type: 'treat', pid, tool, ok: true });
    return 'ok';
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

/** 23:00'ten 08:00'e oyun saati, 5 dakikalık adımlarla. */
export function clockText(t: number, duration: number): string {
  const mins = 23 * 60 + Math.floor(((Math.min(t, duration) / duration) * 540) / 5) * 5;
  const m = mins % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
}
