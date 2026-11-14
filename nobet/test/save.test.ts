import { describe, expect, it } from 'vitest';
import { dayKey, daySeed, prevDayKey } from '../src/daily';
import { liveStreak, rankOf, recordDaily, SaveData } from '../src/save';

const blank = (): SaveData => ({ stars: {}, best: {}, sound: true, daily: {}, streak: { last: '', count: 0, best: 0 } });
const rec = { score: 100, stars: 2, accuracy: 0.9, grid: '🟩', fired: false };

describe('Günün Nöbeti kaydı', () => {
  it('ay ve yıl geçişinde önceki günü bulur', () => {
    expect(prevDayKey('2026-03-01')).toBe('2026-02-28');
    expect(prevDayKey('2027-01-01')).toBe('2026-12-31');
    expect(dayKey(new Date(2026, 10, 5))).toBe('2026-11-05');
    expect(daySeed('2026-11-15')).toBe(daySeed('2026-11-15'));
    expect(daySeed('2026-11-15')).not.toBe(daySeed('2026-11-16'));
  });

  it('art arda günler seriyi büyütür, gün atlanırsa sıfırlanır', () => {
    const d = blank();
    expect(recordDaily(d, '2026-11-14', rec)).toBe(true);
    expect(recordDaily(d, '2026-11-14', { ...rec, score: 999 })).toBe(false);
    expect(d.daily['2026-11-14'].score).toBe(100);
    recordDaily(d, '2026-11-15', rec);
    expect(d.streak.count).toBe(2);
    expect(liveStreak(d, '2026-11-16')).toBe(2);
    expect(liveStreak(d, '2026-11-17')).toBe(0);
    recordDaily(d, '2026-11-17', rec);
    expect(d.streak.count).toBe(1);
    expect(d.streak.best).toBe(2);
  });

  it('unvan yıldızla yükselir', () => {
    expect(rankOf(0).title).toBe('Stajyer');
    expect(rankOf(7).title).toBe('Uzman');
    expect(rankOf(99).next).toBeNull();
  });
});
