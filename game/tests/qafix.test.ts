// QA report 1 fixes (Oynanış): QA-004, QA-007, QA-010, QA-011, QA-018.
import { describe, expect, it } from 'vitest';
import { fmt, num } from '../src/i18n';
import { tr } from '../src/i18n/tr';
import { MemoryBackend, SaveStore } from '../src/platform/storage';
import { TUTORIAL_STEPS } from '../src/ui/tutorial';

describe('QA-011 thousands separator', () => {
  it('fmt groups numbers the Turkish way', () => {
    expect(num(12345)).toBe('12.345');
    expect(fmt(tr.result.score, { n: 13645 })).toBe('Puan: 13.645');
    expect(fmt('Bölüm {n}', { n: 7 })).toBe('Bölüm 7');
    expect(fmt('{a}', { a: 'metin 1000' })).toBe('metin 1000'); // strings untouched
  });
});

describe('QA-012 one term for pieces', () => {
  it('player-facing strings say "kese", never "parça"', () => {
    const all = JSON.stringify(tr);
    expect(all).not.toMatch(/[Pp]arça/);
    expect(tr.hud.pieces).toBe('Kese');
  });
});

describe('QA-018 / QA-004 / QA-007 save rules', () => {
  it('clamps stars and counters from a corrupt save', async () => {
    const be = new MemoryBackend();
    await be.set('kumakisi.save.v1', JSON.stringify({ version: 1, levels: { 2: { stars: '9', best: -5, attempts: 'x', lossStreak: 2.7, completed: 1 } } }));
    const s = await SaveStore.load(be);
    expect(s.level(2)).toEqual({ stars: 3, best: 0, completed: true, attempts: 0, lossStreak: 2 });
    s.recordResult(3, true, 10, 7);
    expect(s.level(3)?.stars).toBe(3);
  });

  it('an abandoned attempt counts (new deal) but is not a loss', async () => {
    const s = await SaveStore.load(new MemoryBackend());
    expect(s.isFresh).toBe(true);
    s.recordResult(4, false, 0, 0);
    s.recordAbandon(4);
    expect(s.level(4)).toMatchObject({ attempts: 2, lossStreak: 1, completed: false });
    expect(s.isFresh).toBe(false);
  });
});

describe('QA-010 tutorial t3', () => {
  it('dropping without rotating skips to the chain step', () => {
    const t3 = TUTORIAL_STEPS.t3;
    expect(t3[0].until).toBe('rotated');
    expect(t3[0].orOn).toEqual({ type: 'placed', skip: 2 });
    expect(t3[2].until).toBe('chainWord');
  });
});
