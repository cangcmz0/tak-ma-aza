// Sand grid storage. Flat typed arrays, index = y * w + x, y = 0 is the top row.

/** Colour value for empty cells. */
export const EMPTY = 0;
/** Highest colour id usable for sand. Colours 1..MAX_SAND_COLOR take part in path clears. */
export const MAX_SAND_COLOR = 15;
/** Colour id used for stone / obstacle cells (never cleared, never moves). */
export const STONE = 255;

/** Cell flag bits. */
export const FLAG_STATIC = 1 << 0; // never moves (stone, frozen grains)
export const FLAG_BOMB = 1 << 1; // special: bomb grain (see engine/specials.ts)
// Bits 2..7 are free for future special grain types.

export class SandGrid {
  readonly w: number;
  readonly h: number;
  readonly size: number;
  /** 0 = empty, 1..MAX_SAND_COLOR = sand colour, STONE = obstacle. */
  readonly color: Uint8Array;
  /** Cosmetic shade variant per grain. */
  readonly shade: Uint8Array;
  /** Bit flags per cell (FLAG_*). */
  readonly flags: Uint8Array;
  /** Incremented on every mutation; renderers use it to skip redundant uploads. */
  version = 0;

  constructor(w: number, h: number) {
    this.w = w;
    this.h = h;
    this.size = w * h;
    this.color = new Uint8Array(this.size);
    this.shade = new Uint8Array(this.size);
    this.flags = new Uint8Array(this.size);
  }

  idx(x: number, y: number): number {
    return y * this.w + x;
  }

  inBounds(x: number, y: number): boolean {
    return x >= 0 && y >= 0 && x < this.w && y < this.h;
  }

  get(x: number, y: number): number {
    return this.color[y * this.w + x];
  }

  isEmpty(i: number): boolean {
    return this.color[i] === EMPTY;
  }

  set(x: number, y: number, color: number, shade = 0, flags = 0): void {
    const i = y * this.w + x;
    this.color[i] = color;
    this.shade[i] = shade;
    this.flags[i] = flags;
    this.version++;
  }

  clearCell(i: number): void {
    this.color[i] = EMPTY;
    this.shade[i] = 0;
    this.flags[i] = 0;
  }

  /** Place a stone (static obstacle) cell. */
  setStone(x: number, y: number): void {
    this.set(x, y, STONE, 0, FLAG_STATIC);
  }

  reset(): void {
    this.color.fill(0);
    this.shade.fill(0);
    this.flags.fill(0);
    this.version++;
  }

  /** Count grains of a given colour (debug / tests). */
  countColor(c: number): number {
    let n = 0;
    for (let i = 0; i < this.size; i++) if (this.color[i] === c) n++;
    return n;
  }

  copyFrom(o: SandGrid): void {
    this.color.set(o.color);
    this.shade.set(o.shade);
    this.flags.set(o.flags);
    this.version++;
  }
}

export function isSandColor(c: number): boolean {
  return c !== EMPTY && c <= MAX_SAND_COLOR;
}
