import { describe, expect, it } from 'vitest';
import { MemoryBackend, SaveStore } from '../src/platform/storage';

describe('SaveStore', () => {
  it('persists results and unlocks the next level', async () => {
    const be = new MemoryBackend();
    const s = await SaveStore.load(be);
    const ids = [1, 2, 3];
    expect(s.isUnlocked(1, ids)).toBe(true);
    expect(s.isUnlocked(2, ids)).toBe(false);
    s.recordResult(1, true, 500, 2);
    s.recordResult(1, false, 100, 0);
    expect(s.level(1)).toEqual({ stars: 2, best: 500, completed: true, attempts: 2, lossStreak: 1 });
    expect(s.isUnlocked(2, ids)).toBe(true);
    expect(s.currentLevel(ids)).toBe(2);
    await Promise.resolve();
    const again = await SaveStore.load(be);
    expect(again.level(1)?.stars).toBe(2);
  });

  it('survives corrupt data', async () => {
    const be = new MemoryBackend();
    await be.set('kumakisi.save.v1', '{not json');
    const s = await SaveStore.load(be);
    expect(s.settings.sound).toBe(true);
  });
});
