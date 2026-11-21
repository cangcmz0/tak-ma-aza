import { describe, expect, it } from 'vitest';
import { fixedClock } from '../src/core/clock';
import { CONTINUE_CLEAR_ROWS, CONTINUE_PIECES, START_GOLD } from '../src/game/economy';
import { Meta } from '../src/game/meta';
import { Session, type SessionEvent } from '../src/game/session';
import { FakeAdProvider } from '../src/platform/ads';
import { FakeIap } from '../src/platform/iap';
import { MemoryBackend, SaveStore } from '../src/platform/storage';
import { makeLevel } from './helpers';

const small = { gridW: 16, gridH: 24 };

async function makeMeta(opts: { adOk?: boolean; buyOk?: boolean } = {}) {
  const backend = new MemoryBackend();
  const save = await SaveStore.load(backend);
  const clock = fixedClock(Date.UTC(2026, 10, 21, 9));
  const meta = new Meta(
    save,
    new FakeAdProvider(async () => opts.adOk ?? true),
    new FakeIap(async () => opts.buyOk ?? true, () => save.economy.owned),
    clock,
  );
  return { save, meta, backend, clock };
}

function lostSession(reason: 'no_space' | 'out_of_pieces'): Session {
  const s = new Session(makeLevel({ id: 9, pieceLimit: 3 }), small);
  const g = s.grid;
  // Fill the board with a non-clearing pattern (no wall-to-wall path).
  for (let y = 0; y < g.h; y++) for (let x = 0; x < g.w; x++) g.set(x, y, (x >> 1) % 2 ? 1 : 2);
  s.state = 'lost';
  s.loseReason = reason;
  if (reason === 'out_of_pieces') {
    s.placed = 3;
    s.tray.fill(null);
  }
  return s;
}

describe('Session economy hooks', () => {
  it('revive: +5 pieces, clears the top 20 rows only after a no-space loss', () => {
    const s = lostSession('no_space');
    const ev: SessionEvent[] = [];
    s.events.on((e) => ev.push(e));
    const before = s.piecesLeft;
    expect(s.revive(CONTINUE_PIECES, CONTINUE_CLEAR_ROWS)).toBe(true);
    expect(s.state).toBe('playing');
    expect(s.loseReason).toBeNull();
    expect(s.continues).toBe(1);
    expect(s.piecesLeft).toBe(before + 5);
    const g = s.grid;
    expect(s.topSandRow()).toBe(Math.min(g.h, CONTINUE_CLEAR_ROWS));
    expect(ev.map((e) => e.type)).toEqual(['revived', 'piecesAdded']);
    expect(ev[0]).toMatchObject({ pieces: 5, rows: CONTINUE_CLEAR_ROWS, grains: CONTINUE_CLEAR_ROWS * g.w });
    expect(s.revive(5, 20)).toBe(false); // not lost any more
  });

  it('revive after out of pieces keeps the board and refills the tray', () => {
    const s = lostSession('out_of_pieces');
    expect(s.revive(CONTINUE_PIECES, CONTINUE_CLEAR_ROWS)).toBe(true);
    expect(s.topSandRow()).toBe(0);
    expect(s.tray.filter(Boolean).length).toBe(3);
    expect(s.piecesLeft).toBe(5);
  });

  it('sieve removes one colour, counts grain goals, 1 point per grain, never jokers', () => {
    const s = new Session(makeLevel({ goals: [{ type: 'clear_color_grains', color: 1, count: 10 }, { type: 'clear_paths', count: 1 }] }), small);
    const g = s.grid;
    for (let x = 0; x < 6; x++) {
      g.set(x, g.h - 1, 1);
      g.set(x, g.h - 2, 2);
    }
    g.set(8, g.h - 1, 15); // joker
    expect(s.sieveColor(15)).toBe(0);
    expect(s.sieveColor(1)).toBe(6);
    expect(s.score).toBe(6);
    expect(s.goals.goals[0].current).toBe(6);
    expect(s.goals.goals[1].current).toBe(0); // not a path
    expect(g.color[(g.h - 1) * g.w + 8]).toBe(15);
  });
});

describe('Meta', () => {
  it('pays a first win, then 5 for a plain replay; never on a loss', async () => {
    const { meta, save } = await makeMeta();
    const s = new Session(makeLevel({ id: 3 }), small);
    s.state = 'won';
    s.stars = 2;
    const info = meta.onSessionEnd(s);
    expect(info.reward?.gold).toBe(30);
    save.recordResult(3, true, 100, 2);
    expect(meta.onSessionEnd(s).reward?.gold).toBe(5);
    s.state = 'lost';
    const lost = meta.onSessionEnd(s);
    expect(lost.reward).toBeNull();
    expect(lost.adContext.lossStreak).toBe(1);
    expect(meta.economy.gold).toBe(START_GOLD + 35);
  });

  it('interstitial context: unlocked only once level 8 was won before', async () => {
    const { meta, save } = await makeMeta();
    const s = new Session(makeLevel({ id: 8 }), small);
    s.state = 'won';
    s.stars = 1;
    expect(meta.onSessionEnd(s).adContext.unlocked).toBe(false);
    save.recordResult(8, true, 100, 1);
    expect(meta.onSessionEnd(s).adContext.unlocked).toBe(true);
  });

  it('endless pays floor(score/500)', async () => {
    const { meta } = await makeMeta();
    const s = new Session(makeLevel(), { ...small, endless: true });
    s.score = 2600;
    expect(meta.onSessionEnd(s).endlessGold).toBe(5);
    expect(meta.economy.gold).toBe(START_GOLD + 5);
  });

  it('doubles a first win once after a watched ad', async () => {
    const { meta } = await makeMeta();
    const s = new Session(makeLevel({ id: 4 }), small);
    s.state = 'won';
    s.stars = 3;
    const info = meta.onSessionEnd(s);
    expect(await meta.doubleWin(info)).toBe(40);
    expect(await meta.doubleWin(info)).toBe(0);
    expect(meta.economy.gold).toBe(START_GOLD + 80);
  });

  it('daily: claim, ×2 with an ad, persisted in the save', async () => {
    const { meta, save, backend, clock } = await makeMeta();
    expect((await meta.claimDaily(false))?.gold).toBe(25);
    expect(await meta.claimDaily(false)).toBeNull();
    clock.advance(86_400_000);
    expect((await meta.claimDaily(true))?.gold).toBe(100);
    expect(meta.economy.gold).toBe(START_GOLD + 125);
    await save.flush();
    const again = await SaveStore.load(backend);
    expect(again.daily.streak).toBe(2);
    expect(again.economy.gold).toBe(START_GOLD + 125);
  });

  it('daily ×2: a skipped ad claims nothing', async () => {
    const { meta } = await makeMeta({ adOk: false });
    expect(await meta.claimDaily(true)).toBeNull();
    expect(meta.daily.status().available).toBe(true);
  });

  it('fake purchases deliver gold / remove ads; cancel delivers nothing; restore', async () => {
    const { meta } = await makeMeta();
    expect(await meta.buy('gold_small')).toEqual({ ok: true, gold: 1000 });
    expect(await meta.buy('remove_ads')).toEqual({ ok: true, gold: 500 });
    expect(meta.economy.noAds).toBe(true);
    expect(await meta.restore()).toEqual(['remove_ads']);
    expect(meta.economy.gold).toBe(START_GOLD + 1500);
    const c = await makeMeta({ buyOk: false });
    expect(await c.meta.buy('gold_large')).toEqual({ ok: false, cancelled: true, gold: 0 });
    expect(c.meta.economy.gold).toBe(START_GOLD);
  });

  it('undoLastLoss takes a continued attempt back', async () => {
    const { save } = await makeMeta();
    save.recordResult(5, false, 10, 0);
    save.undoLastLoss(5);
    expect(save.level(5)).toMatchObject({ attempts: 0, lossStreak: 0 });
    save.undoLastLoss(5); // nothing to undo
    expect(save.level(5)).toMatchObject({ attempts: 0, lossStreak: 0 });
  });
});
