// Injectable wall clock (daily reward, ad frequency caps). Tests use fixedClock().

const DAY_MS = 86_400_000;

/** Wall clock. tzOffsetMin follows Date#getTimezoneOffset (minutes, UTC − local). */
export interface Clock {
  now(): number;
  tzOffsetMin(ms: number): number;
}

export const systemClock: Clock = {
  now: () => Date.now(),
  tzOffsetMin: (ms) => new Date(ms).getTimezoneOffset(),
};

export interface TestClock extends Clock {
  set(ms: number): void;
  advance(ms: number): void;
  setOffset(min: number): void;
}

/** Manually driven clock with a fixed UTC offset (tests / tools). */
export function fixedClock(ms: number, tzOffsetMin = 0): TestClock {
  let t = ms;
  let off = tzOffsetMin;
  return {
    now: () => t,
    tzOffsetMin: () => off,
    set(v) {
      t = v;
    },
    advance(d) {
      t += d;
    },
    setOffset(m) {
      off = m;
    },
  };
}

/** Local calendar day number (days since 1970-01-01 in the clock's local time). */
export function localDay(ms: number, clock: Clock): number {
  return Math.floor((ms - clock.tzOffsetMin(ms) * 60_000) / DAY_MS);
}
