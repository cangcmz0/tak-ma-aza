import { describe, expect, it } from 'vitest';
import { COMPLAINTS, ZONES, nightConfig, severitiesOf } from '../src/data';
import { genVitals, makePatient } from '../src/patients';
import { Rng } from '../src/rng';
import { levelOf, triageOf } from '../src/triage';

describe('triaj eşikleri', () => {
  it('nabız sınırları', () => {
    expect(levelOf('nabiz', 100)).toBe(0);
    expect(levelOf('nabiz', 101)).toBe(1);
    expect(levelOf('nabiz', 130)).toBe(1);
    expect(levelOf('nabiz', 131)).toBe(2);
    expect(levelOf('nabiz', 55)).toBe(0);
    expect(levelOf('nabiz', 54)).toBe(1);
    expect(levelOf('nabiz', 44)).toBe(2);
  });
  it('SpO2, tansiyon ve ateş sınırları', () => {
    expect(levelOf('spo2', 95)).toBe(0);
    expect(levelOf('spo2', 94)).toBe(1);
    expect(levelOf('spo2', 89)).toBe(2);
    expect(levelOf('sistolik', 159)).toBe(0);
    expect(levelOf('sistolik', 160)).toBe(1);
    expect(levelOf('sistolik', 190)).toBe(2);
    expect(levelOf('sistolik', 99)).toBe(1);
    expect(levelOf('sistolik', 89)).toBe(2);
    expect(levelOf('ates', 37.9)).toBe(0);
    expect(levelOf('ates', 38)).toBe(1);
    expect(levelOf('ates', 40)).toBe(2);
  });
});

describe('hasta üretici', () => {
  it('üretilen bulgular her zaman hedef aciliyete denk gelir', () => {
    const rng = new Rng(42);
    for (const c of COMPLAINTS) {
      for (const sev of severitiesOf(c)) {
        for (let i = 0; i < 400; i++) {
          expect(triageOf(genVitals(rng, sev, c.focus))).toBe(sev);
        }
      }
    }
  });

  it('her gece her aciliyet için şikâyet bulunur', () => {
    for (let n = 1; n <= 8; n++) {
      const cfg = nightConfig(n);
      const rng = new Rng(n);
      for (const sev of ZONES) {
        const p = makePatient(rng, cfg, { severity: sev });
        expect(p.severity).toBe(sev);
        expect(triageOf(p.vitals)).toBe(sev);
        expect(p.line.length).toBeGreaterThan(3);
      }
    }
  });

  it('aynı tohum aynı hastayı verir', () => {
    const a = makePatient(new Rng(7), nightConfig(3));
    const b = makePatient(new Rng(7), nightConfig(3));
    expect(a).toEqual(b);
  });
});
