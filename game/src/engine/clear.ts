// Path detection: a 4-connected same-colour region touching both the left
// and the right wall is a "path" and gets cleared.
// Joker grains (GDD §5.2) join the region of every colour: colours are searched
// in order 1→MAX_PLAIN_COLOR with "colour c or joker" as passable; jokers used by a
// path are consumed and no longer available to later colours. A joker-only
// wall-to-wall region is a path too (regionColor = JOKER).
import { EMPTY, JOKER, MAX_PLAIN_COLOR, MAX_SAND_COLOR, type SandGrid } from './grid';
import { SPECIALS, SPECIAL_MASK } from './specials';

/** Preallocated result buffers for findClears (reuse one per grid). */
export class ClearResult {
  /** Number of paths found. */
  regionCount = 0;
  /** Path colour (the colour that started the flood fill; JOKER for joker-only paths). */
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
  /** Marked grain count per actual grain colour id (jokers are counted under JOKER). */
  readonly colorCounts: Uint32Array;
  /** 1 for obstacle cells (e.g. sacks) reached by a special effect such as a bomb blast. */
  readonly obstacleHit: Uint8Array;
  /** Indices of obstacleHit cells (first obstacleHitCount entries). */
  readonly obstacleHitCells: Int32Array;
  obstacleHitCount = 0;
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
  private readonly hitFn = (j: number): void => {
    if (this.obstacleHit[j]) return;
    this.obstacleHit[j] = 1;
    this.obstacleHitCells[this.obstacleHitCount++] = j;
  };

  constructor(size: number, h: number) {
    this.regionColor = new Uint8Array(h * 2);
    this.regionStart = new Int32Array(h * 2);
    this.regionLen = new Int32Array(h * 2);
    this.cells = new Int32Array(size);
    this.marked = new Uint8Array(size);
    this.colorCounts = new Uint32Array(256);
    this.obstacleHit = new Uint8Array(size);
    this.obstacleHitCells = new Int32Array(size);
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
    for (let k = 0; k < this.obstacleHitCount; k++) this.obstacleHit[this.obstacleHitCells[k]] = 0;
    this.obstacleHitCount = 0;
    this.grid = null;
  }

  /** Mark one cell outside of path search (tools such as a column scoop). */
  markCell(g: SandGrid, j: number): void {
    this.grid = g;
    this.markFn(j);
  }

  /** Joker grains among the path cells. */
  jokerPathGrains(g: SandGrid): number {
    let n = 0;
    for (let k = 0; k < this.pathCellCount; k++) if (g.color[this.cells[k]] === JOKER) n++;
    return n;
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
        if (f & def.flag) def.onClear(g, i, this.markFn, this.hitFn);
      }
    }
  }
}

/**
 * Flood-fill one region from `s`. Passable: colour === c, or (allowJoker && colour === JOKER),
 * and not yet marked by an earlier path. Returns true if the region touches the right wall
 * and contains at least one grain of colour c. Cells are appended to out.cells.
 */
function flood(g: SandGrid, out: ClearResult, s: number, c: number, allowJoker: boolean): boolean {
  const { w, color } = g;
  const { seen, stack, cells, marked } = out;
  let sp = 0;
  let touchesRight = false;
  let hasC = false;
  stack[sp++] = s;
  seen[s] = 1;
  while (sp > 0) {
    const i = stack[--sp];
    cells[out.cellCount++] = i;
    if (color[i] === c) hasC = true;
    const x = i % w;
    if (x === w - 1) touchesRight = true;
    // Inline neighbour test: passable and unseen.
    let j = i - 1;
    if (x > 0 && !seen[j] && !marked[j] && (color[j] === c || (allowJoker && color[j] === JOKER))) {
      seen[j] = 1;
      stack[sp++] = j;
    }
    j = i + 1;
    if (x < w - 1 && !seen[j] && !marked[j] && (color[j] === c || (allowJoker && color[j] === JOKER))) {
      seen[j] = 1;
      stack[sp++] = j;
    }
    j = i - w;
    if (j >= 0 && !seen[j] && !marked[j] && (color[j] === c || (allowJoker && color[j] === JOKER))) {
      seen[j] = 1;
      stack[sp++] = j;
    }
    j = i + w;
    if (j < g.size && !seen[j] && !marked[j] && (color[j] === c || (allowJoker && color[j] === JOKER))) {
      seen[j] = 1;
      stack[sp++] = j;
    }
  }
  return touchesRight && hasC;
}

function commitRegion(out: ClearResult, g: SandGrid, start: number, c: number): void {
  const r = out.regionCount++;
  out.regionColor[r] = c;
  out.regionStart[r] = start;
  out.regionLen[r] = out.cellCount - start;
  for (let k = start; k < out.cellCount; k++) {
    const i = out.cells[k];
    out.marked[i] = 1;
    out.colorCounts[g.color[i]]++;
  }
}

/**
 * Find all wall-to-wall paths and mark them (plus special blast cells).
 * Allocation-free. @returns number of paths found.
 */
export function findClears(g: SandGrid, out: ClearResult): number {
  out.reset();
  const { w, h, color, size } = g;
  const { seen } = out;
  // Which colours touch the left wall? (A path must contain a left-wall cell.)
  let leftMask = 0; // bit c for colours 1..14
  let leftJoker = false;
  for (let y = 0; y < h; y++) {
    const c = color[y * w];
    if (c === JOKER) leftJoker = true;
    else if (c !== EMPTY && c <= MAX_PLAIN_COLOR) leftMask |= 1 << c;
  }
  if (leftMask === 0 && !leftJoker) return 0;
  let hasJoker = leftJoker;
  if (!hasJoker) {
    for (let i = 0; i < size; i++) {
      if (color[i] === JOKER) {
        hasJoker = true;
        break;
      }
    }
  }

  if (!hasJoker) {
    // Fast path: one pass, each region has the colour of its first cell.
    seen.fill(0);
    for (let y = 0; y < h; y++) {
      const s = y * w;
      const c = color[s];
      if (c === EMPTY || c > MAX_SAND_COLOR || seen[s]) continue;
      const start = out.cellCount;
      if (flood(g, out, s, c, false)) commitRegion(out, g, start, c);
      else out.cellCount = start; // roll back: not a path
    }
  } else {
    // Colour order 1→MAX_PLAIN_COLOR; jokers consumed by a path are unavailable afterwards.
    for (let c = 1; c <= MAX_PLAIN_COLOR; c++) {
      if (!(leftMask & (1 << c)) && !leftJoker) continue;
      seen.fill(0);
      for (let y = 0; y < h; y++) {
        const s = y * w;
        const sc = color[s];
        if ((sc !== c && sc !== JOKER) || seen[s] || out.marked[s]) continue;
        const start = out.cellCount;
        if (flood(g, out, s, c, true)) commitRegion(out, g, start, c);
        else out.cellCount = start;
      }
    }
    // Joker-only paths ("karışık" colour).
    if (leftJoker) {
      seen.fill(0);
      for (let y = 0; y < h; y++) {
        const s = y * w;
        if (color[s] !== JOKER || seen[s] || out.marked[s]) continue;
        const start = out.cellCount;
        if (flood(g, out, s, JOKER, false)) commitRegion(out, g, start, JOKER);
        else out.cellCount = start;
      }
    }
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
