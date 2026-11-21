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
export const DANGER_ROWS = 8;
/** Help rule (GDD §4.2): after this many consecutive losses the next attempt gets help. */
export const HELP_LOSS_STREAK = 3;
/** Help rule: colour-bag weight of goal colours during a helped attempt. */
export const HELP_COLOR_WEIGHT = 1.5;
/** The dragged piece is drawn this many CSS px (≈dp) above the finger (GDD §4.4). */
export const DRAG_LIFT_PX = 64;
/** Endless mode unlocks when this level is won (GDD §6). */
export const ENDLESS_UNLOCK_LEVEL = 8;
