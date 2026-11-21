import { describe, expect, it } from 'vitest';
import {
  BOOSTERS,
  boosterUnlocked,
  CHEST_GOLD,
  continueOffer,
  defaultEconomy,
  Economy,
  endlessGold,
  GOLD_CAP,
  levelWinReward,
  sanitizeEconomy,
  START_GOLD,
  type EconomyData,
  type EconomyEvent,
} from '../src/game/economy';

function wallet(over: Partial<EconomyData> = {}) {
  const data = { ...defaultEconomy(), ...over };
  let commits = 0;
  const eco = new Economy(
    () => data,
    () => commits++,
  );
  const events: EconomyEvent[] = [];
  eco.events.on((e) => events.push(e));
  return { eco, data, events, commits: () => commits };
}

describe('economy rules (GDD §9.3 / §10)', () => {
  it('first win pays 20/30/40 by stars', () => {
    expect(levelWinReward(3, 1, undefined).gold).toBe(20);
    expect(levelWinReward(3, 2, undefined).gold).toBe(30);
    expect(levelWinReward(3, 3, { completed: false, stars: 0 }).gold).toBe(40);
    expect(levelWinReward(3, 3, undefined).firstWin).toBe(true);
  });

  it('replay pays the star difference, otherwise 5', () => {
    expect(levelWinReward(3, 3, { completed: true, stars: 1 }).gold).toBe(20);
    expect(levelWinReward(3, 2, { completed: true, stars: 1 }).gold).toBe(10);
    expect(levelWinReward(3, 2, { completed: true, stars: 2 }).gold).toBe(5);
    expect(levelWinReward(3, 1, { completed: true, stars: 3 }).gold).toBe(5);
    expect(levelWinReward(3, 3, { completed: true, stars: 1 }).firstWin).toBe(false);
  });

  it('region end levels open a chest once, on the first win', () => {
    const r = levelWinReward(10, 2, undefined);
    expect(r.chest).toBe(true);
    expect(r.levelGold).toBe(30);
    expect(r.gold).toBe(30 + CHEST_GOLD);
    expect(r.boosters).toEqual({ scoop: 1, sieve: 1 });
    expect(levelWinReward(10, 3, { completed: true, stars: 2 }).chest).toBe(false);
    expect(levelWinReward(20, 1, undefined, true).chest).toBe(false);
    expect(levelWinReward(11, 1, undefined).chest).toBe(false);
  });

  it('endless pays floor(score/500), at most 30', () => {
    expect(endlessGold(0)).toBe(0);
    expect(endlessGold(499)).toBe(0);
    expect(endlessGold(1250)).toBe(2);
    expect(endlessGold(15_000)).toBe(30);
    expect(endlessGold(1e9)).toBe(30);
    expect(endlessGold(Number.NaN)).toBe(0);
  });

  it('continue: free first in levels 1-5, then ad or 300, then 600, then none', () => {
    expect(continueOffer(0, 3)).toEqual({ index: 0, free: true, ad: false, price: 0 });
    expect(continueOffer(1, 3)).toEqual({ index: 1, free: false, ad: false, price: 600 });
    expect(continueOffer(0, 6)).toEqual({ index: 0, free: false, ad: true, price: 300 });
    expect(continueOffer(1, 6)).toEqual({ index: 1, free: false, ad: false, price: 600 });
    expect(continueOffer(2, 6)).toBeNull();
    expect(continueOffer(2, 1)).toBeNull();
  });

  it('boosters unlock at levels 4 / 7 / 12', () => {
    expect(boosterUnlocked('shuffle', 3)).toBe(false);
    expect(boosterUnlocked('shuffle', 4)).toBe(true);
    expect(boosterUnlocked('scoop', 7)).toBe(true);
    expect(boosterUnlocked('sieve', 11)).toBe(false);
    expect(BOOSTERS.shuffle.price).toBe(100);
    expect(BOOSTERS.scoop.price).toBe(150);
    expect(BOOSTERS.sieve.price).toBe(250);
  });
});

describe('Economy wallet', () => {
  it('starts with 200 gold', () => {
    expect(wallet().eco.gold).toBe(START_GOLD);
  });

  it('earn / spend update balance, commit and emit', () => {
    const w = wallet();
    expect(w.eco.earn(50, 'test')).toBe(50);
    expect(w.eco.gold).toBe(250);
    expect(w.eco.spend(100, 'test')).toBe(true);
    expect(w.eco.gold).toBe(150);
    expect(w.commits()).toBe(2);
    expect(w.events.map((e) => (e.type === 'gold' ? e.delta : 0))).toEqual([50, -100]);
    expect(w.data.earned).toBe(50);
    expect(w.data.spent).toBe(100);
  });

  it('never goes negative: an unaffordable spend changes nothing', () => {
    const w = wallet({ gold: 90 });
    expect(w.eco.canAfford(100)).toBe(false);
    expect(w.eco.spend(100, 'x')).toBe(false);
    expect(w.eco.gold).toBe(90);
    expect(w.commits()).toBe(0);
    expect(w.eco.spend(90, 'x')).toBe(true);
    expect(w.eco.gold).toBe(0);
    expect(w.eco.spend(1, 'x')).toBe(false);
  });

  it('refuses invalid amounts', () => {
    const w = wallet();
    for (const bad of [0, -5, 1.5, Number.NaN, Infinity, -Infinity]) {
      expect(w.eco.earn(bad, 'x')).toBe(0);
      expect(w.eco.spend(bad, 'x')).toBe(false);
    }
    expect(w.eco.gold).toBe(START_GOLD);
    expect(w.commits()).toBe(0);
  });

  it('caps the balance', () => {
    const w = wallet({ gold: GOLD_CAP - 10 });
    expect(w.eco.earn(100, 'x')).toBe(10);
    expect(w.eco.gold).toBe(GOLD_CAP);
    expect(w.eco.earn(1, 'x')).toBe(0);
  });

  it('buys and consumes boosters atomically', () => {
    const w = wallet({ gold: 120 });
    expect(w.eco.buyBooster('scoop')).toBe(false); // 150
    expect(w.eco.gold).toBe(120);
    expect(w.eco.count('scoop')).toBe(0);
    expect(w.eco.buyBooster('shuffle')).toBe(true);
    expect(w.eco.gold).toBe(20);
    expect(w.eco.count('shuffle')).toBe(1);
    expect(w.eco.consumeBooster('shuffle')).toBe(true);
    expect(w.eco.consumeBooster('shuffle')).toBe(false);
    expect(w.eco.count('shuffle')).toBe(0);
  });

  it('grants the level reward and opens each chest once', () => {
    const w = wallet();
    const r = w.eco.grantLevelWin(10, 3, undefined);
    expect(r.chest).toBe(true);
    expect(w.eco.gold).toBe(START_GOLD + 40 + CHEST_GOLD);
    expect(w.eco.count('scoop')).toBe(1);
    expect(w.eco.count('sieve')).toBe(1);
    // A corrupted progress (completed=false again) still cannot reopen the chest.
    expect(w.eco.grantLevelWin(10, 3, undefined).chest).toBe(false);
  });

  it('gifts 2 of each booster once when it unlocks', () => {
    const w = wallet();
    expect(w.eco.grantUnlockGifts(3)).toEqual([]);
    expect(w.eco.grantUnlockGifts(4)).toEqual(['shuffle']);
    expect(w.eco.count('shuffle')).toBe(2);
    expect(w.eco.grantUnlockGifts(5)).toEqual([]);
    expect(w.eco.grantUnlockGifts(12)).toEqual(['scoop', 'sieve']);
    expect(w.eco.count('scoop')).toBe(2);
    expect(w.eco.count('sieve')).toBe(2);
    expect(w.eco.count('shuffle')).toBe(2);
  });

  it('delivers non-consumables once, consumables every time', () => {
    const w = wallet();
    const removeAds = { id: 'remove_ads', gold: 500, noAds: true, consumable: false };
    expect(w.eco.deliverProduct(removeAds)).toBe(500);
    expect(w.eco.noAds).toBe(true);
    expect(w.eco.deliverProduct(removeAds)).toBe(0); // restore / duplicate callback
    expect(w.eco.gold).toBe(START_GOLD + 500);
    const pack = { id: 'gold_small', gold: 1000, consumable: true };
    w.eco.deliverProduct(pack);
    w.eco.deliverProduct(pack);
    expect(w.eco.gold).toBe(START_GOLD + 2500);
    expect(w.eco.owns('remove_ads')).toBe(true);
    expect(w.eco.owns('gold_small')).toBe(false);
  });
});

describe('sanitizeEconomy', () => {
  it('fills defaults and repairs bad values', () => {
    expect(sanitizeEconomy(undefined)).toEqual(defaultEconomy());
    const d = sanitizeEconomy({ gold: -50, boosters: { shuffle: '3', scoop: -1, bogus: 9 }, gifts: ['shuffle', 'nope'], noAds: 'yes', owned: [1, 'remove_ads'] });
    expect(d.gold).toBe(START_GOLD);
    expect(d.boosters).toEqual({ shuffle: 3, scoop: 0, sieve: 0 });
    expect(d.gifts).toEqual(['shuffle']);
    expect(d.noAds).toBe(false);
    expect(d.owned).toEqual(['remove_ads']);
    expect(sanitizeEconomy({ gold: 0 }).gold).toBe(0);
    expect(sanitizeEconomy({ gold: 12.9 }).gold).toBe(12);
  });
});
