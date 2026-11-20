import { describe, expect, it } from 'vitest';
import { ClearResult, findClears } from '../src/engine/clear';
import { SandGrid } from '../src/engine/grid';
import { computeStars, GoalTracker, validateGoal } from '../src/game/goals';

function clearWithPaths(colors: number[]): ClearResult {
  const g = new SandGrid(4, colors.length * 2);
  colors.forEach((c, i) => {
    for (let x = 0; x < 4; x++) g.set(x, i * 2, c);
  });
  const res = ClearResult.for(g);
  findClears(g, res);
  return res;
}

describe('goals', () => {
  it('clear_paths counts every path', () => {
    const t = new GoalTracker([{ type: 'clear_paths', count: 3 }]);
    t.onClear(clearWithPaths([1, 2]));
    expect(t.goals[0].current).toBe(2);
    expect(t.allDone()).toBe(false);
    t.onClear(clearWithPaths([1]));
    expect(t.allDone()).toBe(true);
  });

  it('clear_paths with colour only counts that colour', () => {
    const t = new GoalTracker([{ type: 'clear_paths', count: 1, color: 2 }]);
    t.onClear(clearWithPaths([1, 1]));
    expect(t.goals[0].current).toBe(0);
    t.onClear(clearWithPaths([2]));
    expect(t.allDone()).toBe(true);
  });

  it('score goal follows the score', () => {
    const t = new GoalTracker([{ type: 'score', value: 100 }]);
    t.onScore(60);
    expect(t.progress()).toBeCloseTo(0.6);
    t.onScore(120);
    expect(t.allDone()).toBe(true);
  });

  it('clear_color_grains counts grains of a colour', () => {
    const t = new GoalTracker([{ type: 'clear_color_grains', color: 1, count: 6 }]);
    t.onClear(clearWithPaths([1, 2]));
    expect(t.goals[0].current).toBe(4);
    t.onClear(clearWithPaths([1]));
    expect(t.allDone()).toBe(true);
  });

  it('all goals must be done', () => {
    const t = new GoalTracker([
      { type: 'clear_paths', count: 1 },
      { type: 'score', value: 50 },
    ]);
    t.onClear(clearWithPaths([1]));
    expect(t.allDone()).toBe(false);
    t.onScore(50);
    expect(t.allDone()).toBe(true);
  });

  it('validates goal definitions', () => {
    expect(validateGoal({ type: 'clear_paths', count: 2 }, [1, 2])).toEqual([]);
    expect(validateGoal({ type: 'clear_paths', count: 0 }, [1])).not.toEqual([]);
    expect(validateGoal({ type: 'clear_paths', count: 1, color: 5 }, [1, 2])).not.toEqual([]);
    expect(validateGoal({ type: 'clear_color_grains', count: 10 }, [1])).not.toEqual([]);
    expect(validateGoal({ type: 'nope' }, [1])).not.toEqual([]);
  });

  it('computes stars', () => {
    expect(computeStars(0, [10, 20, 30], false)).toBe(0);
    expect(computeStars(5, [10, 20, 30], true)).toBe(1);
    expect(computeStars(25, [10, 20, 30], true)).toBe(2);
    expect(computeStars(99, [10, 20, 30], true)).toBe(3);
  });
});
