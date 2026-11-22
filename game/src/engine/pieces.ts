// Tetromino definitions, rotation and stamping into the sand grid.
import { BLOCK, SHADES } from '../config';
import type { Rng } from '../core/rng';
import { EMPTY, JOKER, type SandGrid } from './grid';
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
  /** Sand colour id (colour A for a two-colour piece). */
  color: number;
  /** Optional special grain type carried by one block of the piece. */
  special: SpecialId | null;
  /** Index into shape cells that carries the special (kept across rotations). */
  specialCell: number;
  /**
   * "İkili Kese" (GDD §5.5): colour of shape cells 2 and 3. Cell order of every shape is
   * chosen so cells 0-1 / 2-3 are I left/right, O top/bottom, others first/last two.
   * Rotation keeps the split (cell order is preserved by rotateShape).
   */
  color2?: number | null;
  /** Shape cell index made of joker grains ("Karışık Baharat"), -1 / undefined = none. */
  jokerCell?: number;
}

export function pieceShape(p: Piece): Shape {
  return ROTATIONS[p.kind][p.rot & 3];
}

/** Grain colour of shape cell `cell` (joker block, colour B of a two-colour piece, else colour). */
export function blockColor(p: Piece, cell: number): number {
  if (p.jokerCell !== undefined && p.jokerCell >= 0 && cell === p.jokerCell) return JOKER;
  if (p.color2 && cell >= 2) return p.color2;
  return p.color;
}

/** Number of blocks per piece (all tetrominoes). */
export const PIECE_BLOCKS = 4;

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
 * Lowest row (<= wantY) the shape can be placed at column x0 while having a clear
 * path straight down from the top of the board (so pieces cannot be tucked under
 * overhangs). Returns -1 if it does not even fit at the top.
 */
export function dropHeight(g: SandGrid, s: Shape, x0: number, wantY: number): number {
  if (!canStamp(g, s, x0, 0)) return -1;
  const maxY = Math.min(Math.floor(wantY), g.h - s.h * BLOCK);
  let y = 0;
  while (y < maxY && canStamp(g, s, x0, y + 1)) y++;
  return y;
}

/**
 * Write a piece as sand grains. Returns false (and writes nothing) on collision.
 * `shadeRng` is a cosmetic stream so it does not disturb gameplay randomness.
 */
export function stamp(g: SandGrid, p: Piece, x0: number, y0: number, shadeRng: Rng, extraFlags = 0): boolean {
  const s = pieceShape(p);
  if (!canStamp(g, s, x0, y0)) return false;
  const specialFlag = p.special ? specialById(p.special).flag : 0;
  const { w } = g;
  for (let c = 0; c < s.cells.length; c++) {
    const [bx, by] = s.cells[c];
    const f = c === p.specialCell ? specialFlag : 0;
    const col = blockColor(p, c);
    const ox = x0 + bx * BLOCK;
    const oy = y0 + by * BLOCK;
    for (let dy = 0; dy < BLOCK; dy++) {
      for (let dx = 0; dx < BLOCK; dx++) {
        const i = (oy + dy) * w + ox + dx;
        g.color[i] = col;
        g.shade[i] = shadeRng.int(SHADES);
        g.flags[i] = f | extraFlags;
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
  /** Chance (0..1) that a dealt piece carries a bomb block. */
  bombChance?: number;
  /** Chance (0..1) that a dealt piece carries one joker block (GDD §5.2). */
  jokerChance?: number;
  /** Chance (0..1) that a dealt piece is two-coloured (GDD §5.5). */
  twoColorChance?: number;
  /**
   * Weight per colour id in the colour bag (default 1 = two copies per bag).
   * The help rule (GDD §4.2) uses 1.5 for goal colours => three copies.
   */
  colorWeights?: Readonly<Record<number, number>>;
}

/** Copies of a colour in one colour bag for a given weight (base: 2 copies). */
export function colorCopies(weight: number): number {
  return Math.max(1, Math.round(2 * weight));
}

/**
 * Fair dealing (GDD §4.2): shapes come from a shuffled bag of the allowed kinds,
 * colours from a shuffled bag holding every colour twice (×weight). Bags refill when empty.
 * Scripted pieces (level `scriptedPieces`) are dealt first, in order.
 * Options can be changed between deals (endless mode raises colours / chances with score).
 */
export class PieceBag {
  private shapes: PieceKind[] = [];
  private colors: number[] = [];
  private scripted: Piece[] = [];
  private o: PieceGenOptions;

  constructor(
    private readonly rng: Rng,
    o: PieceGenOptions,
    scripted: readonly Piece[] = [],
  ) {
    this.o = { ...o };
    this.scripted = scripted.map((p) => ({ ...p }));
  }

  get options(): Readonly<PieceGenOptions> {
    return this.o;
  }

  /** Change dealing options; the colour bag is rebuilt if colours/weights changed. */
  setOptions(patch: Partial<PieceGenOptions>): void {
    const recolor = (patch.colors && patch.colors.join() !== this.o.colors.join()) || patch.colorWeights !== undefined;
    const reshape = patch.kinds !== undefined;
    this.o = { ...this.o, ...patch };
    if (recolor) this.colors = [];
    if (reshape) this.shapes = [];
  }

  /** Scripted pieces still waiting to be dealt. */
  get scriptedLeft(): number {
    return this.scripted.length;
  }

  private shuffle<T>(a: T[]): T[] {
    for (let i = a.length - 1; i > 0; i--) {
      const j = this.rng.int(i + 1);
      const t = a[i];
      a[i] = a[j];
      a[j] = t;
    }
    return a;
  }

  private nextColor(): number {
    if (!this.colors.length) {
      const bag: number[] = [];
      for (const c of this.o.colors) {
        const n = colorCopies(this.o.colorWeights?.[c] ?? 1);
        for (let k = 0; k < n; k++) bag.push(c);
      }
      this.colors = this.shuffle(bag);
    }
    return this.colors.pop() as number;
  }

  next(): Piece {
    const s = this.scripted.shift();
    if (s) return s;
    if (!this.shapes.length) this.shapes = this.shuffle([...(this.o.kinds && this.o.kinds.length ? this.o.kinds : PIECE_KINDS)]);
    const kind = this.shapes.pop() as PieceKind;
    const color = this.nextColor();
    const rot = this.rng.int(4);
    const piece: Piece = { kind, rot, color, special: null, specialCell: -1 };
    const bombChance = this.o.bombChance ?? 0;
    if (bombChance > 0 && this.rng.chance(bombChance)) {
      piece.special = 'bomb';
      piece.specialCell = this.rng.int(PIECE_BLOCKS);
    }
    const twoChance = this.o.twoColorChance ?? 0;
    if (twoChance > 0 && this.o.colors.length > 1 && this.rng.chance(twoChance)) {
      let c2 = this.nextColor();
      if (c2 === color) {
        const others = this.o.colors.filter((c) => c !== color);
        c2 = others[this.rng.int(others.length)];
      }
      piece.color2 = c2;
    }
    const jokerChance = this.o.jokerChance ?? 0;
    if (jokerChance > 0 && this.rng.chance(jokerChance)) {
      // Never on the bomb block (keeps both readable).
      let cell = this.rng.int(PIECE_BLOCKS);
      if (cell === piece.specialCell) cell = (cell + 1) % PIECE_BLOCKS;
      piece.jokerCell = cell;
    }
    return piece;
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
