import { describe, expect, it } from 'vitest';
import { autoplay } from '../src/dev/bot';
import { LEVELS } from '../src/levels/levels';

describe('greedy bot (level sanity)', () => {
  it('every bundled level runs to a win or a loss', { timeout: 240000 }, () => {
    for (const l of LEVELS) {
      const r = autoplay(l);
      console.log(`level ${l.id} "${l.name}": ${r.state} score=${r.score} pieces=${r.placed}/${l.pieceLimit} stars=${r.stars}`);
      expect(r.state).not.toBe('playing');
    }
  });

  it('level 1 (tutorial) is winnable by the greedy bot', { timeout: 30000 }, () => {
    expect(autoplay(LEVELS[0]).state).toBe('won');
  });
});
