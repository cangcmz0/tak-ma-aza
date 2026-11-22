// Level calibration (Level Designer). The heavy run is opt-in:
//   CALIBRATE=1 npx vitest run tests/calibrate.test.ts --silent=false
//   CALIBRATE=1 CAL_TRIALS=40 CAL_LEVELS=10,15,20 CAL_BOT=greedy npx vitest run tests/calibrate.test.ts --silent=false
// The parallel CLI (node scripts/calibrate-levels.mjs) is faster and can --apply stars.
// The small helper tests below always run.
import { describe, expect, it } from 'vitest';
import {
  detectFeatures,
  featuresUsed,
  limitForRate,
  percentile,
  playTrial,
  prepareLevel,
  suggestStars,
  summarize,
  type BotKind,
  type TrialResult,
} from '../scripts/calibrate-levels.core';
import { LEVELS } from '../src/levels/levels';

const rawLevels = Object.values(import.meta.glob<{ default: Record<string, unknown> }>('../src/levels/data/*.json', { eager: true }))
  .map((m) => m.default)
  .sort((a, b) => Number(a.id) - Number(b.id));

describe('calibration helpers', () => {
  it('percentile interpolates', () => {
    expect(percentile([1, 2, 3, 4, 5], 0.5)).toBe(3);
    expect(percentile([10, 20], 0.8)).toBeCloseTo(18);
    expect(Number.isNaN(percentile([], 0.5))).toBe(true);
  });

  it('stars follow GDD §8 (2★ = median, 3★ = P80 of won games; score goal = 1★)', () => {
    const lv = LEVELS[0];
    expect(suggestStars(lv, [100, 200])).toBeNull();
    const s = suggestStars(lv, [1000, 1100, 1200, 1300, 1400, 1500])!;
    expect(s[1]).toBe(1250);
    expect(s[2]).toBe(1400);
    expect(s[0]).toBeLessThanOrEqual(s[1]);
    const scoreLevel = LEVELS.find((l) => l.goals.some((g) => g.type === 'score'))!;
    const goal = scoreLevel.goals.find((g) => g.type === 'score')!;
    expect(suggestStars(scoreLevel, [5000, 6000, 7000, 8000, 9000])![0]).toBe(goal.type === 'score' ? goal.value : -1);
  });

  it('limit sweep picks the smallest limit reaching a win rate', () => {
    const sw = [5, 7, 9, null].map((needed, attempt) => ({ id: 1, attempt, needed, scoreAtWin: 0 }));
    expect(limitForRate(sw, 0.5)).toBe(7);
    expect(limitForRate(sw, 0.75)).toBe(9);
    expect(limitForRate(sw, 1)).toBeNull();
  });

  it('every bundled level prepares without errors and uses only supported mechanics', () => {
    const f = detectFeatures();
    for (const raw of rawLevels) {
      const p = prepareLevel(raw, f);
      expect(p.errors, `level ${p.id}`).toEqual([]);
      expect(p.pending, `level ${p.id} uses ${featuresUsed(raw).join(',')}`).toEqual([]);
    }
  });
});

const RUN = !!process.env.CALIBRATE;

describe.skipIf(!RUN)('level calibration (opt-in, CALIBRATE=1)', () => {
  it('plays every level with the bot and prints win rate / score distribution', { timeout: 3_600_000 }, () => {
    const trials = Number(process.env.CAL_TRIALS ?? 20);
    const bot = (process.env.CAL_BOT ?? 'smart') as BotKind;
    const only = process.env.CAL_LEVELS ? new Set(process.env.CAL_LEVELS.split(',').map(Number)) : null;
    const features = detectFeatures();
    console.log(`bot=${bot} trials=${trials}`);
    for (const raw of rawLevels) {
      const p = prepareLevel(raw, features);
      if (only && !only.has(p.id)) continue;
      if (!p.level) {
        console.log(`${p.id} ${p.name}: HATA ${p.errors.join('; ')}`);
        continue;
      }
      const res: TrialResult[] = [];
      for (let a = 0; a < trials; a++) res.push(playTrial(p.level, a, bot));
      const s = summarize(p, res);
      console.log(
        `${s.id} ${s.name}: kazanma ${Math.round(s.winRate * 100)}% ort=${Math.round(s.meanScore)} medyan=${Math.round(s.median)} p80=${Math.round(s.p80)} ` +
          `yıldız dosya=${s.currentStars.join('/')} öneri=${s.suggestedStars?.join('/') ?? '–'}${s.pending.length ? ` (mekanik bekleniyor: ${s.pending.join(',')})` : ''}`,
      );
      expect(res.every((r) => r.state !== 'playing')).toBe(true);
    }
  });
});
