import { describe, expect, it } from 'vitest';
import { BOMB_RADIUS, SACK_BREAK_POINTS } from '../src/config';
import type { SessionEvent } from '../src/core/events';
import { EMPTY, FLAG_BOMB, SACK, STONE } from '../src/engine/grid';
import { Session } from '../src/game/session';
import { obstacleRect, validateLevel, type LevelDef } from '../src/levels/schema';
import { makeLevel } from './helpers';

const small = { gridW: 16, gridH: 24 };

function collect(s: Session): SessionEvent[] {
  const ev: SessionEvent[] = [];
  s.events.on((e) => ev.push(e));
  return ev;
}

/** Sack 4×4 grains at the bottom-left corner area, red path row directly above it. */
function sackSession(hp: number, goals: LevelDef['goals'] = [{ type: 'clear_obstacles', count: 1 }]) {
  const s = new Session(
    makeLevel({ colors: [1, 2], goals, obstacles: [{ type: 'sack', x: 6, y: 20, w: 4, h: 4, unit: 'grain', hp }] }),
    small,
  );
  return s;
}

function fill(s: Session, y0: number, y1: number, color: number) {
  for (let y = y0; y <= y1; y++) for (let x = 0; x < s.grid.w; x++) if (s.grid.get(x, y) === EMPTY) s.grid.set(x, y, color);
}

/** Support the rows beside the sack (y 20..23) with colour 3 (split by the sack: no path), then a red row on top. */
function redRow(s: Session, y: number) {
  for (let yy = 20; yy <= 23; yy++)
    for (let x = 0; x < s.grid.w; x++) if (s.grid.get(x, yy) === EMPTY) s.grid.set(x, yy, x < 8 ? 3 : 4);
  fill(s, y, y, 1);
  s.wake();
}

describe('sacks (Çuval, GDD §5.4)', () => {
  it('builds static sack cells with the default 2×2 block size', () => {
    expect(obstacleRect({ type: 'sack', x: 1, y: 2 })).toEqual({ x: 4, y: 8, w: 8, h: 8 });
    expect(obstacleRect({ x: 1, y: 2 })).toEqual({ x: 4, y: 8, w: 4, h: 4 });
    const s = new Session(makeLevel({ obstacles: [{ type: 'sack', x: 0, y: 4, hp: 2 }] }), small);
    expect(s.grid.get(0, 16)).toBe(SACK);
    expect(s.grid.get(7, 23)).toBe(SACK);
    expect(s.sacks.list[0]).toMatchObject({ hp: 2, maxHp: 2, w: 8, h: 8 });
  });

  it('a path touching a sack deals 1 damage, then a second clear tears it', () => {
    const s = sackSession(2);
    const ev = collect(s);
    redRow(s, 19); // directly above the sack (y = 20..23)
    s.runUntilSettled();
    expect(s.sacks.list[0].hp).toBe(1);
    expect(s.grid.get(6, 20)).toBe(SACK);
    expect(ev.some((e) => e.type === 'sackHit' && e.hp === 1)).toBe(true);
    expect(s.goals.goals[0].current).toBe(0);
    redRow(s, 19);
    s.runUntilSettled();
    expect(s.sacks.list[0].hp).toBe(0);
    expect(s.grid.countColor(SACK)).toBe(0);
    expect(s.goals.goals[0].current).toBe(1);
    expect(ev.some((e) => e.type === 'sackBreak')).toBe(true);
    expect(s.state).toBe('won');
  });

  it('one clear event deals at most 1 damage even with several touching paths', () => {
    const s = new Session(
      makeLevel({ colors: [1, 2], goals: [{ type: 'clear_paths', count: 9 }], obstacles: [{ type: 'sack', x: 6, y: 16, w: 4, h: 4, unit: 'grain', hp: 3 }] }),
      small,
    );
    fill(s, 20, 23, 2); // yellow path under the sack
    fill(s, 16, 19, 3); // beside the sack (no path)
    fill(s, 15, 15, 1); // red path on top of the sack
    const ev = collect(s);
    s.runUntilSettled();
    const first = ev.find((e) => e.type === 'cleared');
    expect(first && first.type === 'cleared' && first.paths).toBe(2);
    expect(s.sacks.list[0].hp).toBe(2);
  });

  it('breaking a sack scores flat points and lets sand fall through', () => {
    const s = sackSession(1, [{ type: 'clear_paths', count: 5 }]);
    const g = s.grid;
    redRow(s, 19);
    g.set(7, 10, 2); // a lone grain will fall into the sack hole later
    s.runUntilSettled();
    expect(s.score).toBe(16 + 100 + SACK_BREAK_POINTS);
    // Sand flowed into the hole: the yellow grain ended up below the old sack top.
    let yellowY = -1;
    for (let i = 0; i < g.size; i++) if (g.color[i] === 2) yellowY = Math.floor(i / g.w);
    expect(yellowY).toBeGreaterThanOrEqual(20);
    expect(g.countColor(SACK)).toBe(0);
  });

  it('a bomb blast hits sacks but never removes shelf or sack cells', () => {
    const s = new Session(
      makeLevel({
        colors: [1, 2],
        goals: [{ type: 'clear_paths', count: 9 }],
        obstacles: [
          { type: 'sack', x: 10, y: 16, w: 4, h: 4, unit: 'grain', hp: 2 },
          { x: 0, y: 16, w: 3, h: 1, unit: 'grain' },
        ],
      }),
      small,
    );
    const g = s.grid;
    for (let x = 0; x < g.w; x++) g.set(x, g.h - 1, 1);
    g.flags[(g.h - 1) * g.w + 8] = FLAG_BOMB;
    expect(BOMB_RADIUS).toBeGreaterThanOrEqual(5);
    s.runUntilSettled();
    expect(s.sacks.list[0].hp).toBe(1);
    expect(g.get(0, 16)).toBe(STONE);
    expect(g.get(10, 19)).toBe(SACK);
  });

  it('validates sack fields and clear_obstacles against the number of sacks', () => {
    const base = { id: 1, name: 's', colors: [1, 2], stars: [1, 2, 3] };
    const ok = validateLevel({
      ...base,
      goals: [{ type: 'clear_obstacles', count: 2, kind: 'sack' }],
      obstacles: [
        { type: 'sack', x: 0, y: 18, hp: 3 },
        { type: 'sack', x: 4, y: 18 },
        { type: 'shelf', x: 0, y: 10, w: 3 },
      ],
    });
    expect(ok.ok).toBe(true);
    const tooMany = validateLevel({ ...base, goals: [{ type: 'clear_obstacles', count: 2 }], obstacles: [{ type: 'sack', x: 0, y: 18 }] });
    expect(tooMany.ok).toBe(false);
    if (!tooMany.ok) expect(tooMany.errors.join()).toMatch(/clear_obstacles/);
    const badHp = validateLevel({ ...base, goals: [{ type: 'score', value: 1 }], obstacles: [{ type: 'sack', x: 0, y: 0, hp: 4 }] });
    expect(badHp.ok).toBe(false);
    const badType = validateLevel({ ...base, goals: [{ type: 'score', value: 1 }], obstacles: [{ type: 'barrel', x: 0, y: 0 }] });
    expect(badType.ok).toBe(false);
    const sackOob = validateLevel({ ...base, goals: [{ type: 'score', value: 1 }], obstacles: [{ type: 'sack', x: 11, y: 0 }] });
    expect(sackOob.ok).toBe(false); // default 2 blocks wide does not fit at x = 11
  });
});
