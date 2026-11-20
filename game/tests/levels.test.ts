import { describe, expect, it } from 'vitest';
import { ClearResult, findClears } from '../src/engine/clear';
import { Session } from '../src/game/session';
import { LEVEL_ERRORS, LEVELS } from '../src/levels/levels';
import { validateLevel } from '../src/levels/schema';

describe('level schema', () => {
  it('all bundled levels are valid and ids are unique/ordered', () => {
    expect(LEVEL_ERRORS).toEqual([]);
    expect(LEVELS.length).toBeGreaterThanOrEqual(5);
    LEVELS.forEach((l, i) => expect(l.id).toBe(i + 1));
  });

  it('bundled levels start without ready-made paths and with a playable tray', () => {
    for (const l of LEVELS) {
      const s = new Session(l);
      expect(findClears(s.grid, ClearResult.for(s.grid)), `level ${l.id}`).toBe(0);
      expect(s.tray.some((t) => t)).toBe(true);
    }
  });

  it('accepts the documented example and fills defaults', () => {
    const r = validateLevel({
      id: 9,
      name: 'Örnek',
      colors: [1, 2, 3],
      pieceLimit: 15,
      goals: [{ type: 'clear_paths', count: 2 }, { type: 'clear_paths', count: 1, color: 1 }, { type: 'score', value: 1500 }],
      stars: [1000, 2000, 3000],
      prefill: { type: 'random', rows: 12 },
      obstacles: [],
      specials: { bombChance: 0 },
      seed: 12345,
      designerNote: 'kept',
    });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.level.designerNote).toBe('kept');
    const minimal = validateLevel({ id: 3, name: 'x', colors: [1], goals: [{ type: 'score', value: 1 }], stars: [1, 2, 3] });
    expect(minimal.ok).toBe(true);
    if (minimal.ok) {
      expect(minimal.level.pieceLimit).toBeNull();
      expect(minimal.level.prefill).toEqual({ type: 'none' });
      expect(minimal.level.seed).toBe(3 * 7919);
    }
  });

  it('rejects bad levels with readable errors', () => {
    const r = validateLevel({ id: 0, name: '', colors: [], goals: [{ type: 'x' }], stars: [3, 2, 1], prefill: { type: 'pattern', rows: ['123'] } });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.errors.length).toBeGreaterThanOrEqual(5);
      expect(r.errors.join('\n')).toMatch(/width/);
    }
  });

  it('pattern prefill places stones and colours bottom-aligned', () => {
    const r = validateLevel({
      id: 1,
      name: 'p',
      colors: [1, 2],
      goals: [{ type: 'score', value: 1 }],
      stars: [1, 2, 3],
      prefill: { type: 'pattern', rows: ['#..........#', '121212121212'] },
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const s = new Session(r.level);
    const g = s.grid;
    expect(g.get(0, g.h - 5)).toBe(255); // stone in the second row from the bottom
    expect(g.get(0, g.h - 1)).toBe(1);
    expect(g.get(4, g.h - 1)).toBe(2);
  });
});
