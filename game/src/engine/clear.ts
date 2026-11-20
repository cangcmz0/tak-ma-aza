// Path detection: a 4-connected same-colour region touching both the left
// and the right wall is a "path" and gets cleared.
import { EMPTY, MAX_SAND_COLOR, type SandGrid } from './grid';
import { SPECIALS, SPECIAL_MASK } from './specials';

/** Preallocated result buffers for findClears (reuse one per grid). */
export class ClearResult {
  /** Number of paths found. */
  regionCount = 0;
  readonly regionColor: Uint8Array;
  /** Offsets into `cells` for each path. */
  readonly regionStart: Int32Array;
  readonly regionLen: Int32Array;
  /** Marked cell indices: path cells first, then cells added by specials. */
  readonly cells: Int32Array;
  cellCount = 0;
  /** Number of cells belonging to paths (the rest came from specials). */
  pathCellCount = 0;
  /** 1 for every marked cell (render flash / dedupe). */
  readonly marked: Uint8Array;
  /** Marked grain count per colour id. */
  readonly colorCounts: Uint32Array;
  /** Scratch. */
  readonly seen: Uint8Array;
  readonly stack: Int32Array;

  private grid: SandGrid | null = null;
  private readonly markFn = (j: number): void => {
    if (this.marked[j]) return;
    this.marked[j] = 1;
    this.cells[this.cellCount++] = j;
    if (this.grid) this.colorCounts[this.grid.color[j]]++;
  };

  constructor(size: number, h: number) {
    this.regionColor = new Uint8Array(h);
    this.regionStart = new Int32Array(h);
    this.regionLen = new Int32Array(h);
    this.cells = new Int32Array(size);
    this.marked = new Uint8Array(size);
    this.colorCounts = new Uint32Array(256);
    this.seen = new Uint8Array(size);
    this.stack = new Int32Array(size);
  }

  static for(g: SandGrid): ClearResult {
    return new ClearResult(g.size, g.h);
  }

  reset(): void {
    this.regionCount = 0;
    this.cellCount = 0;
    this.pathCellCount = 0;
    this.marked.fill(0);
    this.colorCounts.fill(0);
    this.grid = null;
  }

  /** Expand marks via special grains (iterative, so blasts can chain). */
  expandSpecials(g: SandGrid): void {
    if (SPECIAL_MASK === 0) return;
    this.grid = g;
    for (let k = 0; k < this.cellCount; k++) {
      const i = this.cells[k];
      const f = g.flags[i] & SPECIAL_MASK;
      if (f === 0) continue;
      for (let s = 0; s < SPECIALS.length; s++) {
        const def = SPECIALS[s];
        if (f & def.flag) def.onClear(g, i, this.markFn);
      }
    }
  }
}

/**
 * Find all wall-to-wall same-colour paths and mark them (plus special blast cells).
 * Allocation-free. @returns number of paths found.
 */
export function findClears(g: SandGrid, out: ClearResult): number {
  out.reset();
  const { w, h, color } = g;
  const { seen, stack, cells, marked, colorCounts } = out;
  seen.fill(0);
  for (let y = 0; y < h; y++) {
    const s = y * w;
    const c = color[s];
    if (c === EMPTY || c > MAX_SAND_COLOR || seen[s]) continue;
    const start = out.cellCount;
    let sp = 0;
    let touchesRight = false;
    stack[sp++] = s;
    seen[s] = 1;
    while (sp > 0) {
      const i = stack[--sp];
      cells[out.cellCount++] = i;
      const x = i % w;
      if (x === w - 1) touchesRight = true;
      if (x > 0 && !seen[i - 1] && color[i - 1] === c) {
        seen[i - 1] = 1;
        stack[sp++] = i - 1;
      }
      if (x < w - 1 && !seen[i + 1] && color[i + 1] === c) {
        seen[i + 1] = 1;
        stack[sp++] = i + 1;
      }
      if (i >= w && !seen[i - w] && color[i - w] === c) {
        seen[i - w] = 1;
        stack[sp++] = i - w;
      }
      if (i + w < g.size && !seen[i + w] && color[i + w] === c) {
        seen[i + w] = 1;
        stack[sp++] = i + w;
      }
    }
    if (!touchesRight) {
      out.cellCount = start; // roll back: not a path
      continue;
    }
    const r = out.regionCount++;
    out.regionColor[r] = c;
    out.regionStart[r] = start;
    out.regionLen[r] = out.cellCount - start;
    for (let k = start; k < out.cellCount; k++) marked[cells[k]] = 1;
    colorCounts[c] += out.cellCount - start;
  }
  out.pathCellCount = out.cellCount;
  if (out.regionCount > 0) out.expandSpecials(g);
  return out.regionCount;
}

/** Remove every marked cell from the grid. */
export function removeMarked(g: SandGrid, res: ClearResult): void {
  for (let k = 0; k < res.cellCount; k++) g.clearCell(res.cells[k]);
  g.version++;
}
