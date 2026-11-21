import { describe, expect, it } from 'vitest';
import { PreferencesBackend, type PreferencesApi } from '../src/platform/preferencesBackend';
import { MemoryBackend, SaveStore, type KeyValueBackend } from '../src/platform/storage';
import { SceneManager, type Scene } from '../src/ui/app';
import { validateLevel } from '../src/levels/schema';

class CountingBackend extends MemoryBackend {
  sets = 0;
  override async set(key: string, value: string) {
    this.sets++;
    await new Promise((r) => setTimeout(r, 5)); // slow native bridge
    await super.set(key, value);
  }
}

function fakePrefs(): PreferencesApi & { m: Map<string, string> } {
  const m = new Map<string, string>();
  return {
    m,
    async get({ key }) {
      return { value: m.has(key) ? (m.get(key) as string) : null };
    },
    async set({ key, value }) {
      m.set(key, value);
    },
    async remove({ key }) {
      m.delete(key);
    },
  };
}

describe('SaveStore (wave 2 fields, background writes)', () => {
  it('keeps endless best, seen intros and finished tutorials', async () => {
    const be = new MemoryBackend();
    const s = await SaveStore.load(be);
    expect(s.recordEndless(1200)).toBe(true);
    expect(s.recordEndless(800)).toBe(false);
    s.markIntroSeen('sack');
    s.markIntroSeen('sack');
    s.markTutorialDone('t1');
    await s.flush();
    const again = await SaveStore.load(be);
    expect(again.endlessBest).toBe(1200);
    expect(again.hasSeenIntro('sack')).toBe(true);
    expect(again.hasSeenIntro('joker')).toBe(false);
    expect(again.isTutorialDone('t1')).toBe(true);
  });

  it('coalesces many changes into few ordered writes and flush() waits for them', async () => {
    const be = new CountingBackend();
    const s = await SaveStore.load(be);
    for (let i = 0; i < 10; i++) s.recordResult(1, false, i, 0);
    await s.flush();
    expect(be.sets).toBe(1);
    s.recordResult(1, true, 99, 3);
    s.setSetting('sound', false);
    await s.flush();
    expect(be.sets).toBe(2);
    const again = await SaveStore.load(be);
    expect(again.level(1)).toMatchObject({ attempts: 11, best: 99, completed: true, lossStreak: 0 });
    expect(again.settings.sound).toBe(false);
  });

  it('loads old saves without the new fields', async () => {
    const be = new MemoryBackend();
    await be.set('kumakisi.save.v1', JSON.stringify({ version: 1, levels: { 1: { stars: 2, best: 10, completed: true } }, settings: {} }));
    const s = await SaveStore.load(be);
    expect(s.endlessBest).toBe(0);
    expect(s.isTutorialDone('t1')).toBe(false);
    expect(s.level(1)?.stars).toBe(2);
  });

  it('a failing backend never breaks the game', async () => {
    const broken: KeyValueBackend = {
      get: async () => null,
      set: async () => {
        throw new Error('disk full');
      },
      remove: async () => {},
    };
    const s = await SaveStore.load(broken);
    s.recordEndless(5);
    await expect(s.flush()).resolves.toBeUndefined();
    expect(s.endlessBest).toBe(5);
  });
});

describe('PreferencesBackend', () => {
  it('reads/writes through the Preferences API', async () => {
    const api = fakePrefs();
    const be = new PreferencesBackend(api, null);
    await be.set('k', 'v');
    expect(api.m.get('k')).toBe('v');
    expect(await be.get('k')).toBe('v');
    await be.remove('k');
    expect(await be.get('k')).toBeNull();
  });

  it('falls back to the old store for keys Preferences does not have (migration)', async () => {
    const old = new MemoryBackend();
    await old.set('kumakisi.save.v1', '{"version":1,"endlessBest":77}');
    const be = new PreferencesBackend(fakePrefs(), old);
    const s = await SaveStore.load(be);
    expect(s.endlessBest).toBe(77);
  });
});

describe('SceneManager.back (Android back button)', () => {
  const scene = (back?: () => void): Scene => ({ el: { remove() {} } as unknown as HTMLElement, back });
  it('returns false at a scene without back (main menu → exit app)', () => {
    const sm = new SceneManager({ append() {} } as unknown as HTMLElement);
    sm.replace(scene());
    expect(sm.back()).toBe(false);
    let called = 0;
    sm.push(scene(() => called++));
    expect(sm.back()).toBe(true);
    expect(called).toBe(1);
  });
});

describe('level schema: wave 2 fields', () => {
  const base = { id: 1, name: 'x', colors: [1, 2], goals: [{ type: 'score', value: 1 }], stars: [1, 2, 3] };
  it('fills defaults', () => {
    const r = validateLevel(base);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.level).toMatchObject({ scriptedPieces: [], tutorial: null, intro: [], customer: 'ayse' });
    expect(r.level.specials).toMatchObject({ bombChance: 0, jokerChance: 0, twoColorChance: 0 });
  });
  it('accepts valid and rejects invalid values', () => {
    const ok = validateLevel({ ...base, tutorial: 't2', intro: ['joker'], customer: 'anna', specials: { jokerChance: 0.2, twoColorChance: 0.3 } });
    expect(ok.ok).toBe(true);
    const bad = validateLevel({ ...base, tutorial: 't9', intro: 'joker', customer: 'bob', specials: { jokerChance: 2, twoColorChance: -1 } });
    expect(bad.ok).toBe(false);
    if (!bad.ok) expect(bad.errors.length).toBe(5);
  });
});
