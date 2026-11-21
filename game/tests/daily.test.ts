import { describe, expect, it } from 'vitest';
import { fixedClock, localDay } from '../src/core/clock';
import { DAILY_REWARDS, DailyRewards, defaultDaily, sanitizeDaily, scaleReward, type DailyData } from '../src/game/daily';

const HOUR = 3_600_000;
const DAY = 24 * HOUR;
/** 2026-11-21 00:00 UTC */
const T0 = Date.UTC(2026, 10, 21);

function setup(tzOffsetMin = 0, start = T0 + 10 * HOUR) {
  const clock = fixedClock(start, tzOffsetMin);
  const data: DailyData = defaultDaily();
  const daily = new DailyRewards(() => data, () => {}, clock);
  return { clock, data, daily };
}

describe('localDay', () => {
  it('changes at local midnight', () => {
    const utc = fixedClock(0, 0);
    expect(localDay(T0 - 1, utc)).toBe(localDay(T0, utc) - 1);
    // Istanbul (UTC+3, offset -180): local midnight is 21:00 UTC the day before.
    const ist = fixedClock(0, -180);
    expect(localDay(T0 - 3 * HOUR, ist)).toBe(localDay(T0, utc));
    expect(localDay(T0 - 3 * HOUR - 1, ist)).toBe(localDay(T0, utc) - 1);
    // New York winter (UTC-5, offset 300).
    const ny = fixedClock(0, 300);
    expect(localDay(T0 + 4 * HOUR, ny)).toBe(localDay(T0, utc) - 1);
    expect(localDay(T0 + 5 * HOUR, ny)).toBe(localDay(T0, utc));
  });
});

describe('DailyRewards (GDD §12.1)', () => {
  it('first claim is day 1 with streak 1, then nothing until tomorrow', () => {
    const { daily, clock } = setup();
    const st = daily.status();
    expect(st).toMatchObject({ available: true, index: 0, streak: 1, reset: false });
    expect(daily.claim()).toEqual(DAILY_REWARDS[0]);
    expect(daily.status().available).toBe(false);
    expect(daily.claim()).toBeNull();
    clock.advance(13 * HOUR); // 23:00 same day
    expect(daily.status().available).toBe(false);
    clock.advance(1 * HOUR); // 00:00 next day
    expect(daily.status()).toMatchObject({ available: true, index: 1, streak: 2 });
  });

  it('walks the 7-day cycle, wraps to day 1 and keeps counting the streak', () => {
    const { daily, clock, data } = setup();
    const got = [];
    for (let d = 0; d < 9; d++) {
      got.push(daily.status().index);
      daily.claim();
      clock.advance(DAY);
    }
    expect(got).toEqual([0, 1, 2, 3, 4, 5, 6, 0, 1]);
    expect(data.streak).toBe(9);
    expect(data.best).toBe(9);
  });

  it('missing a day resets to day 1', () => {
    const { daily, clock, data } = setup();
    daily.claim();
    clock.advance(DAY);
    daily.claim();
    clock.advance(DAY);
    daily.claim(); // day 3, streak 3
    clock.advance(2 * DAY); // skipped one day
    expect(daily.status()).toMatchObject({ available: true, index: 0, streak: 1, reset: true });
    daily.claim();
    expect(data.streak).toBe(1);
    expect(data.best).toBe(3);
  });

  it('claim late at night, next claim early next morning still counts as consecutive', () => {
    const { daily, clock } = setup(-180, T0 + 20 * HOUR + 59 * 60_000); // 23:59 Istanbul
    daily.claim();
    clock.advance(2 * 60_000); // 00:01 Istanbul next day
    expect(daily.status()).toMatchObject({ available: true, index: 1, streak: 2 });
  });

  it('follows the device time zone (travel / DST shift)', () => {
    const { daily, clock } = setup(0, T0 + 23 * HOUR); // 23:00 UTC
    daily.claim();
    clock.setOffset(-180); // phone switches to UTC+3: it is now 02:00 the next local day
    expect(daily.status()).toMatchObject({ available: true, index: 1 });
  });

  it('clock set back does not get stuck', () => {
    const { daily, clock } = setup();
    daily.claim();
    clock.advance(-3 * DAY);
    expect(daily.status()).toMatchObject({ available: true, index: 0, streak: 1 });
  });

  it('scaleReward doubles gold and boosters', () => {
    expect(scaleReward(DAILY_REWARDS[6], 2)).toEqual({ gold: 300, boosters: { sieve: 2 } });
    expect(scaleReward(DAILY_REWARDS[2], 2)).toEqual({ gold: 0, boosters: { shuffle: 2 } });
  });

  it('sanitizes saved state', () => {
    expect(sanitizeDaily(null)).toEqual(defaultDaily());
    expect(sanitizeDaily({ lastDay: 20000, index: 9, streak: -2, best: 4 })).toEqual({ lastDay: 20000, index: 0, streak: 0, best: 4 });
    expect(sanitizeDaily({ lastDay: 'x', index: 3, streak: 5 })).toEqual({ lastDay: null, index: 3, streak: 5, best: 5 });
  });
});
