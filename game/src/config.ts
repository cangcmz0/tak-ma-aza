// Global tunables. Gameplay agents may tweak these; keep them plain constants.

/** Board width in sand grains. */
export const GRID_W = 48;
/** Board height in sand grains. */
export const GRID_H = 80;
/** One tetromino block = BLOCK×BLOCK grains. GRID_W and GRID_H must be multiples of it. */
export const BLOCK = 4;

/** Fixed simulation ticks per second (decoupled from display refresh rate). */
export const SIM_TICK_HZ = 60;
/** Sand physics passes per tick. Higher = faster falling sand. */
export const SIM_STEPS_PER_TICK = 3;
/** Max ticks processed per frame (avoids spiral of death after a long pause). */
export const MAX_TICKS_PER_FRAME = 5;

/** How long matched paths blink before they disappear (in ticks). */
export const CLEAR_FLASH_TICKS = 23; // ~380 ms
/** Points per cleared grain; multiplied by the chain level. */
export const SCORE_PER_GRAIN = 1;

/** Number of pieces offered at once. */
export const TRAY_SIZE = 3;

/** Bomb blast radius in grains. */
export const BOMB_RADIUS = 8;

/** Shade variants per colour (cosmetic grain texture). */
export const SHADES = 3;
