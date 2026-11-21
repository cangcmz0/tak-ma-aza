import { describe, expect, it } from 'vitest';
import { Rng, deriveSeed } from '../src/core/rng';

describe('Rng', () => {
  it('is deterministic for the same seed', () => {
    const a = new Rng(12345);
    const b = new Rng(12345);
    const sa = Array.from({ length: 50 }, () => a.next());
    const sb = Array.from({ length: 50 }, () => b.next());
    expect(sa).toEqual(sb);
  });

  it('differs for different seeds', () => {
    const a = new Rng(1);
    const b = new Rng(2);
    expect(a.next()).not.toBe(b.next());
  });

  it('int stays in range and covers all values', () => {
    const r = new Rng(7);
    const seen = new Set<number>();
    for (let i = 0; i < 1000; i++) {
      const v = r.int(5);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(5);
      seen.add(v);
    }
    expect(seen.size).toBe(5);
  });

  it('state can be saved and restored', () => {
    const r = new Rng(99);
    r.next();
    const st = r.state;
    const x = r.next();
    r.state = st;
    expect(r.next()).toBe(x);
  });

  it('deriveSeed gives independent streams', () => {
    expect(deriveSeed(1, 1)).not.toBe(deriveSeed(1, 2));
    expect(deriveSeed(1, 1)).toBe(deriveSeed(1, 1));
  });
});
