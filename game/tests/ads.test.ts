import { describe, expect, it } from 'vitest';
import { fixedClock } from '../src/core/clock';
import {
  AdPolicy,
  defaultAds,
  FakeAdProvider,
  INTERSTITIAL_RULES as R,
  PolicyAdService,
  REWARDED_DAILY_TOTAL,
  sanitizeAds,
  type AdData,
  type InterstitialContext,
} from '../src/platform/ads';

const MIN = 60_000;
const T0 = Date.UTC(2026, 10, 21, 9);
const ok: InterstitialContext = { trigger: 'level_exit', unlocked: true, lossStreak: 0 };

/** Policy whose app session is already long enough and with enough level ends. */
function setup(over: Partial<AdData> = {}) {
  const clock = fixedClock(T0);
  const data: AdData = { ...defaultAds(), levelEnds: 5, ...over };
  const policy = new AdPolicy(() => data, () => {}, clock, T0 - 10 * MIN);
  return { clock, data, policy };
}

describe('interstitial rules (GDD §11.2)', () => {
  it('shows when every rule passes', () => {
    expect(setup().policy.decideInterstitial(ok, false)).toEqual({ show: true, reason: 'ok' });
  });

  it('never with "Reklamları Kaldır"', () => {
    expect(setup().policy.decideInterstitial(ok, true).reason).toBe('no_ads');
  });

  it('only on result → map / next level', () => {
    const { policy } = setup();
    for (const trigger of ['retry', 'menu', 'gameplay'] as const) expect(policy.decideInterstitial({ ...ok, trigger }, false).reason).toBe('trigger');
  });

  it('not before level 8 was won', () => {
    expect(setup().policy.decideInterstitial({ ...ok, unlocked: false }, false).reason).toBe('locked');
  });

  it('needs 3 level ends since the last one', () => {
    const { policy, clock } = setup();
    policy.noteInterstitialShown();
    clock.advance(10 * MIN);
    expect(policy.decideInterstitial(ok, false).reason).toBe('level_gap');
    policy.noteLevelEnd();
    policy.noteLevelEnd();
    expect(policy.decideInterstitial(ok, false).reason).toBe('level_gap');
    policy.noteLevelEnd();
    expect(policy.decideInterstitial(ok, false).show).toBe(true);
  });

  it('90 s after any ad, rewarded included', () => {
    const { policy, clock } = setup();
    policy.noteRewardedShown('free_gold');
    clock.advance(89_000);
    expect(policy.decideInterstitial(ok, false).reason).toBe('cooldown');
    clock.advance(1_000);
    expect(policy.decideInterstitial(ok, false).show).toBe(true);
  });

  it('not in the first 3 minutes of the app session', () => {
    const clock = fixedClock(T0);
    const data = { ...defaultAds(), levelEnds: 9 };
    const policy = new AdPolicy(() => data, () => {}, clock);
    expect(policy.decideInterstitial(ok, false).reason).toBe('session');
    clock.advance(R.minSessionMs);
    expect(policy.decideInterstitial(ok, false).show).toBe(true);
  });

  it('skipped after 3 losses in a row on the level', () => {
    const { policy } = setup();
    expect(policy.decideInterstitial({ ...ok, lossStreak: 2 }, false).show).toBe(true);
    expect(policy.decideInterstitial({ ...ok, lossStreak: 3 }, false).reason).toBe('frustration');
  });

  it('at most 4 per hour and 20 per day', () => {
    const { policy, clock } = setup();
    const showOne = () => {
      for (let k = 0; k < R.minLevelEnds; k++) policy.noteLevelEnd();
      const d = policy.decideInterstitial(ok, false);
      if (d.show) policy.noteInterstitialShown();
      return d;
    };
    for (let i = 0; i < 4; i++) {
      expect(showOne().show).toBe(true);
      clock.advance(2 * MIN);
    }
    expect(showOne().reason).toBe('hourly_cap');
    clock.advance(55 * MIN); // first one leaves the hour window
    expect(showOne().show).toBe(true);

    // Day cap: 20 within 24 h even when spread out over hours.
    const s2 = setup();
    let shown = 0;
    for (let i = 0; i < 30; i++) {
      for (let k = 0; k < R.minLevelEnds; k++) s2.policy.noteLevelEnd();
      const d = s2.policy.decideInterstitial(ok, false);
      if (d.show) {
        s2.policy.noteInterstitialShown();
        shown++;
      } else expect(d.reason).toBe('daily_cap');
      s2.clock.advance(16 * MIN); // 3.75 per hour: never the hourly cap
    }
    expect(shown).toBe(R.maxPerDay);
  });
});

describe('rewarded caps (GDD §11.1)', () => {
  it('free gold 3 / day, booster 3 / day, daily double 1 / day; reset at local midnight', () => {
    const { policy, clock } = setup();
    expect(policy.rewardedLeft('free_gold')).toBe(3);
    for (let i = 0; i < 3; i++) policy.noteRewardedShown('free_gold');
    expect(policy.rewardedLeft('free_gold')).toBe(0);
    expect(policy.rewardedLeft('booster')).toBe(3);
    policy.noteRewardedShown('daily_double');
    expect(policy.rewardedLeft('daily_double')).toBe(0);
    clock.advance(15 * 60 * MIN); // past midnight
    expect(policy.rewardedLeft('free_gold')).toBe(3);
    expect(policy.rewardedLeft('daily_double')).toBe(1);
  });

  it('12 rewarded ads per day in total', () => {
    const { policy } = setup();
    for (let i = 0; i < REWARDED_DAILY_TOTAL; i++) policy.noteRewardedShown('continue');
    expect(policy.rewardedLeft('continue')).toBe(0);
    expect(policy.rewardedLeft('free_gold')).toBe(0);
  });
});

describe('PolicyAdService with the fake provider', () => {
  it('grants the reward only when the ad finished and counts it', async () => {
    const { policy, data } = setup();
    let answer = true;
    const svc = new PolicyAdService(policy, new FakeAdProvider(async () => answer), () => false);
    expect(await svc.showRewarded('free_gold')).toBe(true);
    answer = false; // skipped
    expect(await svc.showRewarded('free_gold')).toBe(false);
    expect(data.rewarded.free_gold).toBe(1);
    expect(svc.fake).toBe(true);
  });

  it('interstitial: shows per policy, never with no-ads', async () => {
    const kinds: string[] = [];
    const { policy, data } = setup();
    let noAds = false;
    const svc = new PolicyAdService(
      policy,
      new FakeAdProvider(async (k) => {
        kinds.push(k);
        return true;
      }),
      () => noAds,
    );
    expect(await svc.maybeShowInterstitial(ok)).toBe(true);
    expect(data.levelEnds).toBe(0);
    expect(await svc.maybeShowInterstitial(ok)).toBe(false);
    expect(svc.lastDecision?.reason).toBe('level_gap');
    noAds = true;
    for (let k = 0; k < 5; k++) svc.noteLevelEnd();
    expect(await svc.maybeShowInterstitial(ok)).toBe(false);
    expect(svc.lastDecision?.reason).toBe('no_ads');
    expect(kinds).toEqual(['interstitial']);
  });

  it('one ad at a time', async () => {
    const { policy } = setup();
    let release: (v: boolean) => void = () => {};
    const svc = new PolicyAdService(policy, new FakeAdProvider(() => new Promise<boolean>((r) => (release = r))), () => false);
    const first = svc.showRewarded('booster');
    expect(svc.canShowRewarded('booster')).toBe(false);
    expect(await svc.showRewarded('booster')).toBe(false);
    release(true);
    expect(await first).toBe(true);
    expect(svc.canShowRewarded('booster')).toBe(true);
  });

  it('a failing provider never grants', async () => {
    const { policy } = setup();
    const svc = new PolicyAdService(policy, new FakeAdProvider(() => Promise.reject(new Error('no fill'))), () => false);
    expect(await svc.showRewarded('booster')).toBe(false);
    expect(await svc.maybeShowInterstitial(ok)).toBe(false);
  });
});

describe('sanitizeAds', () => {
  it('repairs saved state', () => {
    expect(sanitizeAds(undefined)).toEqual(defaultAds());
    const d = sanitizeAds({ levelEnds: -3, lastAdAt: 'x', interstitials: [5, 'a', -1], rewardDay: 1.5, rewarded: { free_gold: 2, bogus: 4 }, rewardedTotal: 2 });
    expect(d).toEqual({ levelEnds: 0, lastAdAt: 0, interstitials: [5], rewardDay: -1, rewarded: { free_gold: 2 }, rewardedTotal: 2 });
  });
});
