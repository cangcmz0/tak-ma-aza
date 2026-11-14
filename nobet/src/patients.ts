// Hasta üretici: aciliyete uygun şikâyet, söz ve yaşam bulguları.
import { AVATARS, Complaint, COMPLAINT_BY_ID, Focus, NAMES, NightCfg, VitalTarget, Zone, complaintsFor, severitiesOf } from './data';
import type { Rng } from './rng';
import type { Vitals } from './triage';

export interface PatientSeed {
  name: string;
  age: number;
  avatar: string;
  kid: boolean;
  complaintId: string;
  line: string;
  vitals: Vitals;
  severity: Zone;
}

const round1 = (x: number) => Math.round(x * 10) / 10;

/** Bir bulguyu sarı (1) ya da kırmızı (2) aralığa taşır. Aralıklar eşiklerden uzak tutulur. */
function abnormal(rng: Rng, v: VitalTarget, dir: 1 | -1, lvl: 1 | 2): number {
  switch (v) {
    case 'nabiz':
      if (dir > 0) return lvl === 1 ? rng.int(104, 127) : rng.int(135, 162);
      return lvl === 1 ? rng.int(46, 53) : rng.int(33, 42);
    case 'ates':
      return lvl === 1 ? round1(rng.range(38.2, 39.7)) : round1(rng.range(40.1, 41.2));
    case 'spo2':
      return lvl === 1 ? rng.int(90, 94) : rng.int(79, 88);
    case 'sistolik':
      if (dir > 0) return lvl === 1 ? rng.int(163, 186) : rng.int(194, 228);
      return lvl === 1 ? rng.int(91, 98) : rng.int(68, 86);
  }
}

export function genVitals(rng: Rng, severity: Zone, focus: Focus[]): Vitals {
  const v: Vitals = {
    nabiz: rng.int(64, 94),
    ates: round1(rng.range(36.3, 37.5)),
    spo2: rng.int(96, 99),
    sistolik: rng.int(112, 148),
    diastolik: 0,
  };
  if (severity !== 'green') {
    const pool = focus.length ? focus : [{ v: 'nabiz', dir: 1 } as Focus];
    const seen = new Set<VitalTarget>();
    const picks = rng.shuffle(pool).filter((f) => (seen.has(f.v) ? false : (seen.add(f.v), true)));
    const [first, second] = picks;
    if (severity === 'red') {
      v[first.v] = abnormal(rng, first.v, first.dir, 2);
      if (second && rng.chance(0.5)) v[second.v] = abnormal(rng, second.v, second.dir, 1);
    } else {
      v[first.v] = abnormal(rng, first.v, first.dir, 1);
      if (second && rng.chance(0.35)) v[second.v] = abnormal(rng, second.v, second.dir, 1);
    }
  }
  v.diastolik = Math.round(v.sistolik * 0.62 + rng.range(-6, 6));
  return v;
}

export function pickSeverity(rng: Rng, cfg: NightCfg): Zone {
  return rng.weighted<Zone>(['red', 'yellow', 'green'], (z) => cfg.weights[z]);
}

export function pickComplaint(rng: Rng, cfg: NightCfg, severity: Zone, avoid: readonly string[] = []): Complaint {
  const pool = complaintsFor(cfg.n).filter((c) => severitiesOf(c).includes(severity));
  return rng.weighted(pool, (c) => (cfg.theme[c.id] ?? 1) * (avoid.includes(c.id) ? 0.35 : 1));
}

export function makePatient(
  rng: Rng,
  cfg: NightCfg,
  opts: { severity?: Zone; complaintId?: string; avoid?: readonly string[] } = {},
): PatientSeed {
  let severity = opts.severity ?? pickSeverity(rng, cfg);
  const complaint: Complaint =
    (opts.complaintId && COMPLAINT_BY_ID[opts.complaintId]) || pickComplaint(rng, cfg, severity, opts.avoid);
  if (!severitiesOf(complaint).includes(severity)) {
    // Şikâyet o aciliyeti desteklemiyorsa şikâyete uyan ilk aciliyete geç.
    severity = severitiesOf(complaint)[0];
  }

  const kidLines = complaint.kid?.[severity];
  const group: 'kid' | 'adult' | 'old' = kidLines && rng.chance(0.18) ? 'kid' : rng.chance(0.25) ? 'old' : 'adult';
  const g: 'm' | 'f' = rng.chance(0.5) ? 'm' : 'f';
  const first = rng.pick(NAMES[g]);
  let name: string;
  let age: number;
  if (group === 'kid') {
    name = first;
    age = rng.int(4, 13);
  } else if (group === 'old') {
    name = `${first} ${g === 'm' ? 'Amca' : 'Teyze'}`;
    age = rng.int(66, 89);
  } else {
    name = `${first} ${rng.pick(NAMES.initials.split(''))}.`;
    age = rng.int(18, 62);
  }
  const line = rng.pick(group === 'kid' && kidLines ? kidLines : complaint.lines[severity]!);
  return {
    name,
    age,
    avatar: rng.pick(AVATARS[group][g]),
    kid: group === 'kid',
    complaintId: complaint.id,
    line,
    vitals: genVitals(rng, severity, complaint.focus),
    severity,
  };
}
