// "Çuval" breakable obstacles (GDD §5.4). A sack is a static rectangle of SACK cells
// with 1..3 hp. A clear event (one resolved check) deals at most 1 damage to each sack:
// - any cleared path grain 4-adjacent to one of its cells, or
// - a bomb blast circle reaching one of its cells.
// At 0 hp the cells are emptied so the sand above can flow.
import { FLAG_STATIC, SACK, type SandGrid } from './grid';
import type { ClearResult } from './clear';

export interface Sack {
  /** Top-left corner and size in grains. */
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
  readonly maxHp: number;
  hp: number;
}

export interface SackHit {
  index: number;
  sack: Sack;
  broken: boolean;
}

export class Sacks {
  readonly list: Sack[] = [];

  get alive(): number {
    let n = 0;
    for (const s of this.list) if (s.hp > 0) n++;
    return n;
  }

  /** Place a sack (cells overwrite whatever is there). */
  add(g: SandGrid, x: number, y: number, w: number, h: number, hp: number): Sack {
    const s: Sack = { x, y, w, h, maxHp: hp, hp };
    this.list.push(s);
    for (let yy = Math.max(0, y); yy < Math.min(g.h, y + h); yy++)
      for (let xx = Math.max(0, x); xx < Math.min(g.w, x + w); xx++) {
        const i = yy * g.w + xx;
        g.color[i] = SACK;
        g.shade[i] = 0;
        g.flags[i] = FLAG_STATIC;
      }
    g.version++;
    return s;
  }

  /** True if the clear touches this sack (path adjacency or blast hit). */
  private touched(g: SandGrid, s: Sack, res: ClearResult): boolean {
    const { w } = g;
    const { marked, obstacleHit } = res;
    const x1 = Math.min(g.w, s.x + s.w);
    const y1 = Math.min(g.h, s.y + s.h);
    for (let y = Math.max(0, s.y); y < y1; y++) {
      for (let x = Math.max(0, s.x); x < x1; x++) {
        const i = y * w + x;
        if (obstacleHit[i]) return true;
        if (x > 0 && marked[i - 1]) return true;
        if (x < w - 1 && marked[i + 1]) return true;
        if (y > 0 && marked[i - w]) return true;
        if (y < g.h - 1 && marked[i + w]) return true;
      }
    }
    return false;
  }

  /**
   * Apply one clear event (call before res.marked is reset). Returns the sacks that took
   * damage; broken ones are already removed from the grid.
   */
  applyClear(g: SandGrid, res: ClearResult): SackHit[] {
    const hits: SackHit[] = [];
    for (let k = 0; k < this.list.length; k++) {
      const s = this.list[k];
      if (s.hp <= 0 || !this.touched(g, s, res)) continue;
      s.hp--;
      const broken = s.hp === 0;
      if (broken) this.removeCells(g, s);
      hits.push({ index: k, sack: s, broken });
    }
    return hits;
  }

  private removeCells(g: SandGrid, s: Sack): void {
    for (let y = s.y; y < s.y + s.h; y++)
      for (let x = s.x; x < s.x + s.w; x++) {
        const i = y * g.w + x;
        if (g.color[i] === SACK) g.clearCell(i);
      }
    g.version++;
  }
}
