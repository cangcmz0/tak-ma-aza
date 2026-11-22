// Falling-sand cellular automaton. Allocation-free; operates in place.
//
// Active-range optimisation: a grain in row y can only start moving when something changed in
// rows y..y+2 (below, diagonal below, and the repose check one row further). So each step
// records the rows where grains moved and the next step scans only [movedLo - 2, movedHi].
// Any outside mutation (detected via SandGrid.version) forces a full rescan.
import { SAND_REPOSE } from '../config';
import type { Rng } from '../core/rng';
import { EMPTY, FLAG_FALLING, FLAG_STATIC, type SandGrid } from './grid';

function move(g: SandGrid, a: number, b: number): void {
  g.color[b] = g.color[a];
  g.shade[b] = g.shade[a];
  g.flags[b] = g.flags[a];
  g.color[a] = EMPTY;
  g.shade[a] = 0;
  g.flags[a] = 0;
}

/** Locate the rows of FLAG_FALLING grains (full scan; after outside mutations). */
function findFalling(g: SandGrid): void {
  const { w, flags, size } = g;
  let lo = g.h;
  let hi = -1;
  for (let i = 0; i < size; i++) {
    if ((flags[i] & FLAG_FALLING) === 0) continue;
    const y = (i / w) | 0;
    if (y < lo) lo = y;
    hi = y;
  }
  g.fallLo = lo;
  g.fallHi = hi;
}

/**
 * One physics pass, bottom-up. A grain falls straight down if possible,
 * otherwise slides diagonally (random side when both are free).
 * Static cells (FLAG_STATIC) never move but support grains.
 * @returns number of grains that moved (0 => the board is settled).
 */
export function step(g: SandGrid, rng: Rng, repose: number = SAND_REPOSE): number {
  const { w, h, color, flags } = g;
  let lo: number;
  let hi: number;
  if (g.version !== g.simVersion) {
    findFalling(g);
    lo = 0;
    hi = h - 2;
  } else {
    lo = g.scanLo;
    hi = g.scanHi;
  }
  let mLo = h;
  let mHi = -1;
  let moved = 0;
  if (g.fallLo <= g.fallHi) {
    const a = g.fallLo;
    const b = g.fallHi;
    moved = stepFalling(g);
    // Rows the falling piece occupied (and moved into) may hold loose sand now.
    const bb = moved ? b + 1 : b;
    if (a - 2 < lo) lo = a - 2;
    if (bb > hi) hi = bb;
    if (moved) {
      mLo = a;
      mHi = bb;
    }
  }
  if (lo < 0) lo = 0;
  if (hi > h - 2) hi = h - 2;
  for (let y = hi; y >= lo; y--) {
    const ltr = rng.next() < 0.5;
    const row = y * w;
    let rowMoved = false;
    for (let k = 0; k < w; k++) {
      const x = ltr ? k : w - 1 - k;
      const i = row + x;
      if (color[i] === EMPTY || (flags[i] & (FLAG_STATIC | FLAG_FALLING)) !== 0) continue;
      const below = i + w;
      if (color[below] === EMPTY) {
        move(g, i, below);
        moved++;
        rowMoved = true;
        continue;
      }
      const deep = repose >= 2 && y + 2 < h;
      const dl = x > 0 && color[below - 1] === EMPTY && (repose < 2 || (deep && color[below - 1 + w] === EMPTY));
      const dr = x < w - 1 && color[below + 1] === EMPTY && (repose < 2 || (deep && color[below + 1 + w] === EMPTY));
      if (dl && dr) {
        move(g, i, rng.next() < 0.5 ? below - 1 : below + 1);
      } else if (dl) {
        move(g, i, below - 1);
      } else if (dr) {
        move(g, i, below + 1);
      } else continue;
      moved++;
      rowMoved = true;
    }
    if (rowMoved) {
      if (y < mLo) mLo = y;
      if (y + 1 > mHi) mHi = y + 1;
    }
  }
  if (mHi >= 0) {
    g.scanLo = mLo - 2 < 0 ? 0 : mLo - 2;
    g.scanHi = mHi > h - 2 ? h - 2 : mHi;
  } else {
    g.scanLo = 1;
    g.scanHi = 0;
  }
  if (moved) g.version++;
  g.simVersion = g.version;
  return moved;
}

// Scratch buffers for stepFalling (reused; resized only when the grid size changes).
let compOf = new Int32Array(0); // component id + 1 per cell (0 = not labelled this step)
let stack = new Int32Array(0);
const MAX_COMPS = 64;
const compFalls = new Uint8Array(MAX_COMPS);

/**
 * Just-dropped pieces (FLAG_FALLING grains) move down one row as rigid blocks. Each
 * connected falling block is handled on its own (QA-005): when one block touches
 * support only that block turns into loose sand; a block still in the air keeps falling.
 * Only the rows in [fallLo, fallHi] are touched.
 * @returns number of grains moved
 */
function stepFalling(g: SandGrid): number {
  const { w, h, color, flags } = g;
  if (compOf.length !== g.size) {
    compOf = new Int32Array(g.size);
    stack = new Int32Array(g.size);
  }
  const i0 = g.fallLo * w;
  const i1 = Math.min(g.size, (g.fallHi + 1) * w);
  // 1) Label 4-connected components of falling grains.
  let comps = 0;
  for (let i = i0; i < i1; i++) compOf[i] = 0;
  for (let i = i0; i < i1; i++) {
    if ((flags[i] & FLAG_FALLING) === 0 || compOf[i] !== 0) continue;
    const id = comps < MAX_COMPS ? comps++ : MAX_COMPS - 1;
    let sp = 0;
    stack[sp++] = i;
    compOf[i] = id + 1;
    while (sp > 0) {
      const c = stack[--sp];
      const x = c % w;
      const n0 = x > 0 ? c - 1 : -1;
      const n1 = x < w - 1 ? c + 1 : -1;
      const n2 = c - w;
      const n3 = c + w;
      if (n0 >= i0 && (flags[n0] & FLAG_FALLING) !== 0 && compOf[n0] === 0) { compOf[n0] = id + 1; stack[sp++] = n0; }
      if (n1 >= 0 && n1 < i1 && (flags[n1] & FLAG_FALLING) !== 0 && compOf[n1] === 0) { compOf[n1] = id + 1; stack[sp++] = n1; }
      if (n2 >= i0 && (flags[n2] & FLAG_FALLING) !== 0 && compOf[n2] === 0) { compOf[n2] = id + 1; stack[sp++] = n2; }
      if (n3 < i1 && (flags[n3] & FLAG_FALLING) !== 0 && compOf[n3] === 0) { compOf[n3] = id + 1; stack[sp++] = n3; }
    }
  }
  if (comps === 0) {
    g.fallLo = 0;
    g.fallHi = -1;
    return 0;
  }
  // 2) A block can fall if nothing but itself (or another falling block that also
  //    falls) is directly below it. Resolve dependencies bottom-up by iterating.
  for (let k = 0; k < comps; k++) compFalls[k] = 1;
  for (let i = i0; i < i1; i++) {
    const id = compOf[i] - 1;
    if (id < 0) continue;
    if (i >= w * (h - 1)) { compFalls[id] = 0; continue; }
    const below = i + w;
    if (color[below] !== EMPTY && (flags[below] & FLAG_FALLING) === 0) compFalls[id] = 0;
  }
  for (let changed = true; changed; ) {
    changed = false;
    for (let i = i0; i < i1; i++) {
      const id = compOf[i] - 1;
      if (id < 0 || compFalls[id] === 0) continue;
      const below = i + w;
      if (below >= i1) continue;
      const other = compOf[below] - 1;
      if (other >= 0 && other !== id && compFalls[other] === 0) {
        compFalls[id] = 0; // resting on a block that has landed
        changed = true;
      }
    }
  }
  // 3) Landed blocks become loose sand; falling blocks move down one row.
  let moved = 0;
  let lo = h;
  let hi = -1;
  for (let i = i1 - 1; i >= i0; i--) {
    const id = compOf[i] - 1;
    if (id < 0) continue;
    if (compFalls[id] === 0) {
      flags[i] &= ~FLAG_FALLING;
      continue;
    }
    move(g, i, i + w);
    moved++;
    const row = ((i + w) - ((i + w) % w)) / w;
    if (row < lo) lo = row;
    if (row > hi) hi = row;
  }
  if (moved === 0) {
    g.fallLo = 0;
    g.fallHi = -1;
  } else {
    g.fallLo = lo;
    g.fallHi = hi;
  }
  return moved;
}

/** Run steps until settled or maxSteps reached. Returns true if settled. */
export function settle(g: SandGrid, rng: Rng, maxSteps = 10000, repose: number = SAND_REPOSE): boolean {
  for (let n = 0; n < maxSteps; n++) if (step(g, rng, repose) === 0) return true;
  return false;
}
