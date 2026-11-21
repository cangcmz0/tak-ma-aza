// Builds the initial board for a level: obstacles + prefill, then settles it.
import { BLOCK, SHADES } from '../config';
import type { Rng } from '../core/rng';
import { ClearResult, findClears, removeMarked } from '../engine/clear';
import { EMPTY, FLAG_STATIC, JOKER, STONE, type SandGrid } from '../engine/grid';
import { Sacks } from '../engine/sacks';
import { settle } from '../engine/sim';
import { obstacleRect, type LevelDef, type PrefillDef } from '../levels/schema';

/** Fill a rectangle. With keep = true, occupied cells (obstacles) are left untouched. */
function fillRect(g: SandGrid, x0: number, y0: number, w: number, h: number, color: number, rng: Rng, keep = false): void {
  for (let y = Math.max(0, y0); y < Math.min(g.h, y0 + h); y++) {
    for (let x = Math.max(0, x0); x < Math.min(g.w, x0 + w); x++) {
      const i = y * g.w + x;
      if (keep && g.color[i] !== EMPTY) continue;
      if (color === STONE) {
        g.color[i] = STONE;
        g.shade[i] = rng.int(SHADES);
        g.flags[i] = FLAG_STATIC;
      } else {
        g.color[i] = color;
        g.shade[i] = rng.int(SHADES);
        g.flags[i] = 0;
      }
    }
  }
  g.version++;
}

function applyObstacles(g: SandGrid, level: LevelDef, rng: Rng, sacks: Sacks): void {
  for (const o of level.obstacles) {
    const r = obstacleRect(o);
    if (o.type === 'sack') sacks.add(g, r.x, r.y, r.w, r.h, o.hp ?? 1);
    else fillRect(g, r.x, r.y, r.w, r.h, STONE, rng);
  }
}

function applyRandom(g: SandGrid, p: Extract<PrefillDef, { type: 'random' }>, colors: number[], rng: Rng, clear: ClearResult): void {
  const palette = p.colors && p.colors.length ? p.colors : colors;
  const density = p.density ?? 1;
  const top = g.h - p.rows;
  // Colour clumps aligned to the bottom so they line up with dropped blocks.
  for (let y = g.h - BLOCK; y > top - BLOCK; y -= BLOCK) {
    for (let x = 0; x < g.w; x += BLOCK) {
      if (density < 1 && !rng.chance(density)) continue;
      const y0 = Math.max(y, top);
      const c = rng.pick(palette);
      for (let yy = y0; yy < y + BLOCK; yy++)
        for (let xx = x; xx < x + BLOCK; xx++) {
          const i = yy * g.w + xx;
          if (g.color[i] !== EMPTY) continue; // keep obstacles
          g.color[i] = c;
          g.shade[i] = rng.int(SHADES);
        }
    }
  }
  g.version++;
  settle(g, rng);
  // Break accidental wall-to-wall paths by recolouring a middle stripe of each.
  for (let iter = 0; iter < 30 && findClears(g, clear) > 0; iter++) {
    const midX = (g.w >> 1) - (BLOCK >> 1);
    for (let r = 0; r < clear.regionCount; r++) {
      const rc = clear.regionColor[r];
      const others = palette.filter((c) => c !== rc);
      if (!others.length) break;
      const nc = rng.pick(others);
      const s = clear.regionStart[r];
      for (let k = s; k < s + clear.regionLen[r]; k++) {
        const i = clear.cells[k];
        const x = i % g.w;
        if (x >= midX && x < midX + BLOCK) g.color[i] = nc;
      }
    }
    g.version++;
  }
  if (findClears(g, clear) > 0) {
    removeMarked(g, clear);
    settle(g, rng);
  }
}

function applyPattern(g: SandGrid, p: Extract<PrefillDef, { type: 'pattern' }>, rng: Rng): void {
  const rows = p.rows;
  if (!rows.length) return;
  const unit = rows[0].length === g.w ? 1 : BLOCK;
  const legend = p.legend ?? {};
  const top = g.h - rows.length * unit;
  rows.forEach((row, ry) => {
    for (let cx = 0; cx < row.length; cx++) {
      const ch = row[cx];
      if (ch === '.') continue;
      const lv = legend[ch];
      const color = ch === '#' || lv === 'stone' ? STONE : lv === 'joker' ? JOKER : lv !== undefined ? lv : Number(ch);
      // Obstacles are placed first; the pattern never overwrites them (GDD §18.2).
      fillRect(g, cx * unit, top + ry * unit, unit, unit, color, rng, true);
    }
  });
}

/**
 * Reset the grid and lay out the level's starting board. Deterministic for a given rng.
 * Sacks are registered into `sacks` (pass a fresh instance).
 */
export function buildBoard(g: SandGrid, level: LevelDef, rng: Rng, clear: ClearResult = ClearResult.for(g), sacks: Sacks = new Sacks()): Sacks {
  g.reset();
  applyObstacles(g, level, rng, sacks);
  const p = level.prefill;
  if (p.type === 'random') applyRandom(g, p, level.colors, rng, clear);
  else if (p.type === 'pattern') applyPattern(g, p, rng);
  settle(g, rng);
  return sacks;
}
