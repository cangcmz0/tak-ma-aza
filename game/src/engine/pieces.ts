// Tetromino definitions, rotation and stamping into the sand grid.
import { BLOCK, SHADES } from '../config';
import type { Rng } from '../core/rng';
import { EMPTY, type SandGrid } from './grid';
import { specialById, type SpecialId } from './specials';

/** Block coordinate [x, y] inside a piece (y down). */
export type Cell = readonly [number, number];

export interface Shape {
  readonly cells: readonly Cell[];
  /** Width / height in blocks. */
  readonly w: number;
  readonly h: number;
}

export const PIECE_KINDS = ['I', 'O', 'T', 'L', 'J', 'S', 'Z'] as const;
export type PieceKind = (typeof PIECE_KINDS)[number];

const SHAPE_DEFS: Record<PieceKind, Cell[]> = {
  I: [[0, 0], [1, 0], [2, 0], [3, 0]],
  O: [[0, 0], [1, 0], [0, 1], [1, 1]],
  T: [[0, 0], [1, 0], [2, 0], [1, 1]],
  L: [[0, 0], [0, 1], [0, 2], [1, 2]],
  J: [[1, 0], [1, 1], [1, 2], [0, 2]],
  S: [[1, 0], [2, 0], [0, 1], [1, 1]],
  Z: [[0, 0], [1, 0], [1, 1], [2, 1]],
};

/** Shift cells so min x/y = 0. Cell order is preserved (special cell index relies on it). */
export function normalize(cells: readonly Cell[]): Shape {
  let mx = Infinity;
  let my = Infinity;
  for (const [x, y] of cells) {
    if (x < mx) mx = x;
    if (y < my) my = y;
  }
  const out: Cell[] = cells.map(([x, y]) => [x - mx, y - my] as const);
  let w = 0;
  let h = 0;
  for (const [x, y] of out) {
    if (x + 1 > w) w = x + 1;
    if (y + 1 > h) h = y + 1;
  }
  return { cells: out, w, h };
}

/** Rotate 90° clockwise. */
export function rotateShape(s: Shape): Shape {
  return normalize(s.cells.map(([x, y]) => [s.h - 1 - y, x] as const));
}

/** Precomputed rotations [0..3] per kind (no allocation during play). */
export const ROTATIONS: Record<PieceKind, readonly Shape[]> = (() => {
  const r = {} as Record<PieceKind, Shape[]>;
  for (const k of PIECE_KINDS) {
    const list: Shape[] = [normalize(SHAPE_DEFS[k])];
    for (let i = 1; i < 4; i++) list.push(rotateShape(list[i - 1]));
    r[k] = list;
  }
  return r;
})();

export interface Piece {
  kind: PieceKind;
  /** Rotation index 0..3 (clockwise quarter turns). */
  rot: number;
  /** Sand colour id. */
  color: number;
  /** Optional special grain type carried by one block of the piece. */
  special: SpecialId | null;
  /** Index into shape cells that carries the special (kept across rotations). */
  specialCell: number;
}

export function pieceShape(p: Piece): Shape {
  return ROTATIONS[p.kind][p.rot & 3];
}

/** Rotate a piece clockwise in place. */
export function rotatePiece(p: Piece): Piece {
  p.rot = (p.rot + 1) & 3;
  return p;
}

/** Rightmost legal x (in grains) for a shape. */
export function maxX(g: SandGrid, s: Shape): number {
  return g.w - s.w * BLOCK;
}

/** True if the shape fits at grain position (x0, y0) without overlapping anything. */
export function canStamp(g: SandGrid, s: Shape, x0: number, y0 = 0): boolean {
  if (x0 < 0 || y0 < 0 || x0 + s.w * BLOCK > g.w || y0 + s.h * BLOCK > g.h) return false;
  const { w, color } = g;
  for (let c = 0; c < s.cells.length; c++) {
    const [bx, by] = s.cells[c];
    const ox = x0 + bx * BLOCK;
    const oy = y0 + by * BLOCK;
    for (let dy = 0; dy < BLOCK; dy++) {
      const row = (oy + dy) * w + ox;
      for (let dx = 0; dx < BLOCK; dx++) if (color[row + dx] !== EMPTY) return false;
    }
  }
  return true;
}

/**
 * Write a piece as sand grains. Returns false (and writes nothing) on collision.
 * `shadeRng` is a cosmetic stream so it does not disturb gameplay randomness.
 */
export function stamp(g: SandGrid, p: Piece, x0: number, y0: number, shadeRng: Rng): boolean {
  const s = pieceShape(p);
  if (!canStamp(g, s, x0, y0)) return false;
  const specialFlag = p.special ? specialById(p.special).flag : 0;
  const { w } = g;
  for (let c = 0; c < s.cells.length; c++) {
    const [bx, by] = s.cells[c];
    const f = c === p.specialCell ? specialFlag : 0;
    const ox = x0 + bx * BLOCK;
    const oy = y0 + by * BLOCK;
    for (let dy = 0; dy < BLOCK; dy++) {
      for (let dx = 0; dx < BLOCK; dx++) {
        const i = (oy + dy) * w + ox + dx;
        g.color[i] = p.color;
        g.shade[i] = shadeRng.int(SHADES);
        g.flags[i] = f;
      }
    }
  }
  g.version++;
  return true;
}

/** True if the piece fits anywhere on the top row in any rotation. */
export function fitsAnywhere(g: SandGrid, p: Piece): boolean {
  const rots = ROTATIONS[p.kind];
  for (let r = 0; r < 4; r++) {
    const s = rots[r];
    const mx = maxX(g, s);
    for (let x = 0; x <= mx; x++) if (canStamp(g, s, x, 0)) return true;
  }
  return false;
}

export interface PieceGenOptions {
  colors: readonly number[];
  kinds?: readonly PieceKind[];
  bombChance?: number;
}

/**
 * Fair dealing (GDD §4.2): shapes come from a shuffled bag of the allowed kinds,
 * colours from a shuffled bag holding every colour twice. Bags refill when empty.
 */
export class PieceBag {
  private shapes: PieceKind[] = [];
  private colors: number[] = [];

  constructor(
    private readonly rng: Rng,
    private readonly o: PieceGenOptions,
  ) {}

  private shuffle<T>(a: T[]): T[] {
    for (let i = a.length - 1; i > 0; i--) {
      const j = this.rng.int(i + 1);
      const t = a[i];
      a[i] = a[j];
      a[j] = t;
    }
    return a;
  }

  next(): Piece {
    if (!this.shapes.length) this.shapes = this.shuffle([...(this.o.kinds && this.o.kinds.length ? this.o.kinds : PIECE_KINDS)]);
    if (!this.colors.length) this.colors = this.shuffle([...this.o.colors, ...this.o.colors]);
    const kind = this.shapes.pop() as PieceKind;
    const color = this.colors.pop() as number;
    const rot = this.rng.int(4);
    const chance = this.o.bombChance ?? 0;
    const bomb = chance > 0 && this.rng.chance(chance);
    return { kind, rot, color, special: bomb ? 'bomb' : null, specialCell: bomb ? this.rng.int(4) : -1 };
  }
}

/** Independent random piece (no bag). */
export function randomPiece(rng: Rng, o: PieceGenOptions): Piece {
  const kinds = o.kinds && o.kinds.length ? o.kinds : PIECE_KINDS;
  const kind = rng.pick(kinds);
  const color = rng.pick(o.colors);
  const rot = rng.int(4);
  const bomb = (o.bombChance ?? 0) > 0 && rng.chance(o.bombChance ?? 0);
  return {
    kind,
    rot,
    color,
    special: bomb ? 'bomb' : null,
    specialCell: bomb ? rng.int(ROTATIONS[kind][0].cells.length) : -1,
  };
}
