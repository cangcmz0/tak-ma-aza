import { describe, expect, it } from 'vitest';
import { COMPLAINT_BY_ID, Zone } from '../src/data';
import { BAL, Game, clockText, outcomeGrid, summarize } from '../src/game';
import { triageOf } from '../src/triage';

function run(g: Game, seconds: number, step = 0.1, each?: () => void) {
  for (let t = 0; t < seconds && !g.s.over; t += step) {
    g.tick(step);
    each?.();
  }
}

/** Kusursuz ama insan hızında oynayan doktor: her `think` saniyede bir hamle. */
function botPlay(night: number, seed: number, opts: { think: number; accuracy: number }) {
  const g = new Game(night, seed);
  let cooldown = 0;
  const rnd = (() => {
    let x = seed;
    return () => ((x = (x * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
  })();
  while (!g.s.over) {
    if (g.s.activeCode !== null) {
      g.resolveCode(rnd() < 0.75);
      continue;
    }
    g.tick(0.1);
    cooldown -= 0.1;
    if (cooldown > 0) continue;
    const s = g.s;
    // 0) Bağıran yakını sakinleştir.
    const loud = s.patients.find((p) => p.rel > 0);
    if (loud) {
      g.calm(loud.id);
      cooldown = opts.think * 0.3;
      continue;
    }
    // 1) Biten hastayı taburcu et.
    const done = s.patients.find((p) => p.status === 'done');
    if (done) {
      g.discharge(done.id);
      cooldown = opts.think * 0.4;
      continue;
    }
    // 2) Yataktaki hastayı tedavi et.
    const inBed = s.patients.find((p) => p.status === 'bed');
    if (inBed) {
      const right = COMPLAINT_BY_ID[inBed.complaintId].tool;
      g.treat(inBed.id, rnd() < opts.accuracy ? right : right === 'ilac' ? 'rontgen' : 'ilac');
      cooldown = opts.think * 0.6;
      continue;
    }
    // 3) Bekleyeni triaj et (önce en kritik).
    const waiting = s.waiting
      .map((id) => g.get(id)!)
      .sort((a, b) => (a.severity === 'green' ? a.patience : a.hp) - (b.severity === 'green' ? b.patience : b.hp));
    for (const p of waiting) {
      let zone: Zone = triageOf(p.vitals);
      if (rnd() > opts.accuracy) zone = zone === 'red' ? 'yellow' : zone === 'yellow' ? 'green' : 'yellow';
      const order: Zone[] = zone === 'red' ? ['red', 'yellow'] : zone === 'yellow' ? ['yellow', 'red'] : ['green', 'yellow'];
      const target = order.find((z) => g.freeBeds(z) > 0);
      if (target && g.assign(p.id, target)) {
        cooldown = opts.think;
        break;
      }
    }
  }
  return { g, sum: summarize(g.s) };
}

describe('oyun akışı', () => {
  it('ilk gece eğitim hastaları sırayla gelir', () => {
    const g = new Game(1, 123);
    run(g, 30);
    const sev = g.s.patients.map((p) => p.severity);
    expect(sev.slice(0, 3)).toEqual(['green', 'yellow', 'red']);
  });

  it('triaj, tedavi ve taburcu', () => {
    const g = new Game(1, 5);
    run(g, 2);
    const p = g.s.patients[0];
    expect(p.status).toBe('waiting');
    expect(g.assign(p.id, 'green')).toBe(true);
    expect(g.s.stats.correct).toBe(1);
    expect(g.treat(p.id, 'rontgen')).toBe('wrong');
    expect(g.treat(p.id, 'ilac')).toBe('ok');
    run(g, BAL.treat.green + 0.5);
    expect(g.get(p.id)?.status).toBe('done');
    const before = g.s.score;
    expect(g.discharge(p.id)).toBe(true);
    expect(g.s.score).toBeGreaterThan(before);
    expect(g.s.beds.green.every((b) => b === null)).toBe(true);
  });

  it('bekletilen kırmızı hasta Kod Mavi verir ve dünya durur', () => {
    const g = new Game(1, 9);
    run(g, 27.2);
    const red = g.s.patients.find((p) => p.severity === 'red')!;
    expect(red).toBeTruthy();
    run(g, 40, 0.1, () => {});
    expect(g.s.activeCode).toBe(red.id);
    const t = g.s.t;
    g.tick(1);
    expect(g.s.t).toBe(t);
    g.resolveCode(false);
    expect(g.get(red.id)).toBeUndefined();
    expect(g.s.stats.transferred).toBe(1);
  });

  it('hiçbir şey yapmayan doktor kovulur', () => {
    const g = new Game(2, 77);
    run(g, 400, 0.1, () => {
      if (g.s.activeCode !== null) g.resolveCode(false);
    });
    expect(g.s.over).toBe('fired');
  });

  it('durum JSON ile kaydedilip geri yüklenir', () => {
    const g = new Game(3, 11);
    run(g, 20);
    const copy = new Game(g.serialize());
    run(g, 10);
    run(copy, 10);
    expect(copy.s.patients.map((p) => p.name)).toEqual(g.s.patients.map((p) => p.name));
  });

  it('saat 23:00 ile başlar 08:00 ile biter', () => {
    expect(clockText(0, 150)).toBe('23:00');
    expect(clockText(150, 150)).toBe('08:00');
  });
});

describe('denge', () => {
  it('iyi bir oyuncu tüm hikâye gecelerini en az 2 yıldızla bitirir', () => {
    for (let n = 1; n <= 5; n++) {
      const results = [1, 2, 3].map((seed) => botPlay(n, seed * 101 + n, { think: 1.1, accuracy: 0.95 }));
      const stars = results.map((r) => r.sum.stars);
      const line = results
        .map((r) => `${r.sum.stars}★ taburcu %${Math.round(r.sum.served * 100)} başhekim ${Math.round(r.g.s.rep)} sevk ${r.g.s.stats.transferred} şikâyet ${r.g.s.stats.complaints} geliş ${r.g.s.stats.arrivals}`)
        .join(' | ');
      console.log(`İyi oyuncu, gece ${n}: ${line}`);
      expect(Math.min(...stars)).toBeGreaterThanOrEqual(2);
    }
  });

  it('yavaş ve dalgın oyuncu ileri gecelerde zorlanır', () => {
    const results = [1, 2, 3].map((seed) => botPlay(5, seed, { think: 3.2, accuracy: 0.7 }));
    console.log('Yavaş oyuncu, gece 5:', results.map((r) => `${r.sum.stars}★ ${r.sum.result} başhekim ${Math.round(r.g.s.rep)}`).join(' | '));
    expect(Math.max(...results.map((r) => r.sum.stars))).toBeLessThanOrEqual(2);
  });
});

describe('v0.2', () => {
  it('Günün Nöbeti: aynı gün herkese aynı hastalar, oyuncu ne yaparsa yapsın', () => {
    const a = new Game({ daily: '2026-11-15' });
    const b = new Game({ daily: '2026-11-15' });
    expect(a.s.queue.map((q) => q.p.name)).toEqual(b.s.queue.map((q) => q.p.name));
    expect(a.cfg.title).toBe(b.cfg.title);
    // Biri oynar, öteki bekler: gelen hastalar yine aynı kalır.
    run(a, 60, 0.1, () => {
      const w = a.s.waiting[0];
      if (w !== undefined) a.assign(w, 'red');
      if (a.s.activeCode !== null) a.resolveCode(true);
    });
    run(b, 60, 0.1, () => {
      if (b.s.activeCode !== null) b.resolveCode(false);
    });
    const firstA = a.s.queue.slice(0, 8).map((q) => q.p.complaintId);
    const firstB = b.s.queue.slice(0, 8).map((q) => q.p.complaintId);
    expect(firstA).toEqual(firstB);
    const other = new Game({ daily: '2026-11-16' });
    expect(other.s.queue.map((q) => q.p.name)).not.toEqual(a.s.queue.map((q) => q.p.name));
  });

  it('hasta yakını: sakinleştirince puan, bekletince kavga', () => {
    const g = new Game(3, 21);
    const firstRel = g.s.rels[0];
    expect(firstRel).toBeTruthy();
    run(g, firstRel.at + 0.05, 0.05, () => {
      if (g.s.activeCode !== null) g.resolveCode(true);
    });
    const loud = g.s.patients.find((p) => p.rel > 0);
    expect(loud).toBeTruthy();
    const score = g.s.score;
    expect(g.calm(loud!.id)).toBe(true);
    expect(g.s.score).toBe(score + BAL.score.calm);

    const h = new Game(3, 21);
    run(h, firstRel.at + BAL.relTime + 0.3, 0.05, () => {
      if (h.s.activeCode !== null) h.resolveCode(true);
    });
    expect(h.s.stats.relFights).toBeGreaterThanOrEqual(1);
  });

  it('seri: art arda doğru triaj puanı artırır, hata sıfırlar', () => {
    const g = new Game(1, 3);
    run(g, 28);
    const ids = g.s.waiting.slice();
    const pts: number[] = [];
    for (const id of ids) {
      const p = g.get(id)!;
      const before = g.s.score;
      g.assign(id, p.severity);
      pts.push(g.s.score - before);
    }
    expect(g.s.combo).toBe(ids.length);
    expect(pts[pts.length - 1]).toBeGreaterThan(pts[0]);
    const inBed = g.s.patients.find((p) => p.status === 'bed')!;
    g.treat(inBed.id, 'dikis' === COMPLAINT_BY_ID[inBed.complaintId].tool ? 'ilac' : 'dikis');
    expect(g.s.combo).toBe(0);
  });

  it('sonuç kareleri her gelen hasta için bir kare verir', () => {
    const { g } = botPlay(2, 5, { think: 1.1, accuracy: 0.95 });
    const cells = [...outcomeGrid(g.s).replace(/\n/g, '')].filter((ch) => ch.trim());
    expect(cells.length).toBe(g.s.qi);
  });
});
