// Global tunables. Gameplay agents may tweak these; keep them plain constants.

// Units:
// - "design grain": the unit of level data, scores and goals (original 48×80 board, 4×4 blocks).
//   1 design grain = 1 point = 1 g in gram goals.
// - "cell": one simulation cell. The board is SUB times finer than design units in each axis,
//   so one design grain = SUB×SUB cells. Engine code (grid, sim, pieces, renderer) works in cells;
//   convert counts with cellsToGrains() and level coordinates with SUB / BLOCK.

/** Subdivision factor: cells per design grain along one axis. */
export const SUB = 2;
/** Board size and block size in design grains (level data units). */
export const DESIGN_W = 48;
export const DESIGN_H = 80;
export const DESIGN_BLOCK = 4;
/** Board width in cells. */
export const GRID_W = DESIGN_W * SUB;
/** Board height in cells. */
export const GRID_H = DESIGN_H * SUB;
/** One tetromino block = BLOCK×BLOCK cells. GRID_W and GRID_H must be multiples of it. */
export const BLOCK = DESIGN_BLOCK * SUB;
/** Cells per design grain (area). */
export const CELLS_PER_GRAIN = SUB * SUB;

/** Convert a cell count to design grains (points / grams). The single place for this rule. */
export function cellsToGrains(cells: number): number {
  return Math.round(cells / CELLS_PER_GRAIN);
}

/** Convert a design-grain length (rows, columns, radius) to cells. */
export function grainLen(n: number): number {
  return n * SUB;
}

/** Fixed simulation ticks per second (decoupled from display refresh rate). */
export const SIM_TICK_HZ = 60;
/**
 * Sand physics passes per tick. Higher = faster falling sand. A grain moves one cell per pass,
 * so this scales with SUB to keep the on-screen fall speed (3 design grains per tick).
 */
export const SIM_STEPS_PER_TICK = 3 * SUB;
/**
 * Sand "angle of repose": a grain slides diagonally only when it can drop at least this
 * many rows on that side. 1 = loose 45° piles (sand runs far); 2 = steeper ~63° piles,
 * so a dropped piece stays close to where it was placed.
 */
export const SAND_REPOSE = 2;
/** Max ticks processed per frame (avoids spiral of death after a long pause). */
export const MAX_TICKS_PER_FRAME = 5;

/** How long matched paths blink before they disappear (in ticks). */
export const CLEAR_FLASH_TICKS = 23; // ~380 ms
/** Points per cleared grain; multiplied by the chain level. */
export const SCORE_PER_GRAIN = 1;

/** Number of pieces offered at once. */
export const TRAY_SIZE = 3;

/** Bomb blast radius in cells (8 design grains). */
export const BOMB_RADIUS = 8 * SUB;

/** Shade variants per colour (cosmetic grain texture). */
export const SHADES = 3;

/** Bonus added to every cleared path before the chain multiplier (GDD §4.7). */
export const PATH_BONUS = 100;
/** Chain multiplier cap (GDD §4.7). */
export const CHAIN_MAX = 5;
/** Bonus per unused piece when a level is won ("Tezgâh Bonusu"); not counted for score goals. */
export const END_BONUS_PER_PIECE = 100;
/**
 * true  = chain resets on every drop (prototype rule).
 * false = chain resets only when the board settles without a path (GDD §4.7; producer approved).
 */
export const CHAIN_RESET_ON_DROP = false;
/** Show a separate rotate button in the tray (GDD §4.3 says tap-to-rotate only). */
export const SHOW_ROTATE_BUTTON = false;
/** Seed offset per attempt for piece/physics streams (GDD §4.2); the board stays the same. */
export const ATTEMPT_SEED_STEP = 7919;

/** Points for breaking a sack (GDD §4.7; no chain multiplier). */
export const SACK_BREAK_POINTS = 200;
/** Danger warning when the highest settled grain is within this many rows of the top (GDD §4.8). */
export const DANGER_ROWS = 8 * SUB; // cells (8 design grain rows = 2 blocks)
/** Help rule (GDD §4.2): after this many consecutive losses the next attempt gets help. */
export const HELP_LOSS_STREAK = 3;
/** Help rule: colour-bag weight of goal colours during a helped attempt. */
export const HELP_COLOR_WEIGHT = 1.5;
/** The dragged piece is drawn this many CSS px (≈dp) above the finger (GDD §4.4). */
export const DRAG_LIFT_PX = 64;
/** Endless mode unlocks when this level is won (GDD §6). */
export const ENDLESS_UNLOCK_LEVEL = 8;
