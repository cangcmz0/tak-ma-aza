// Single source of truth for colours ("Baharat Çarşısı" art direction, GDD §3).
// Canvas code reads the Theme object; DOM/CSS reads the CSS custom properties in `css`
// (applied to :root at boot). Any new UI component should use these tokens, never raw hex.
import { JOKER, SACK, STONE } from '../engine/grid';

export interface SandColor {
  /** Three grain shades: base, light, dark (GDD §3.2). */
  shades: [string, string, string];
}

export interface Theme {
  name: string;
  /** Board background (empty cell): dark walnut tray. */
  boardBg: string;
  /** Tray wood: plank tones used for the pre-rendered board background. */
  boardWood: [string, string, string];
  /** Shelf ("Raf") wood shades: base, light (top edge), dark (underside / grain). */
  stone: [string, string, string];
  /** Sand colours by colour id. */
  sand: Record<number, SandColor>;
  /** Flash colour for grains about to clear. */
  flash: string;
  /** Tint mixed into bomb ("Acı Biber") grains. */
  bomb: string;
  /** Ember sparks on bomb grains. */
  bombSpark: string;
  /** Joker ("Karışık Baharat") grains cycle through these colours (GDD §3.2: 0.8 s loop). */
  joker: string[];
  /** Sack ("Çuval") jute shades (base, light thread, dark seam) and the hp knot / twine colour. */
  sack: [string, string, string];
  sackKnot: string;
  /** Twine used for pouch ties, sack stitches and knots. */
  twine: [string, string];
  ghostOk: string;
  ghostBad: string;
  columnHint: string;
  /** CSS custom properties applied to :root (UI chrome). */
  css: Record<string, string>;
}

export const defaultTheme: Theme = {
  name: 'Baharat Çarşısı',
  boardBg: '#2a1e17',
  boardWood: ['#2a1e17', '#30231a', '#241912'],
  stone: ['#7a4e2c', '#a26d40', '#4e2f19'],
  sand: {
    // Ids match GDD §18.1: 1 Pul Biber, 2 Zerdeçal, 3 Nane, 4 Sumak, 5 Çivit, 6 Tarçın (GDD §3.2 hexes).
    1: { shades: ['#e0432f', '#f2705c', '#b83322'] }, // pul biber
    2: { shades: ['#f4b526', '#ffd261', '#d09310'] }, // zerdeçal
    3: { shades: ['#5dae4b', '#86cc73', '#43893a'] }, // nane
    4: { shades: ['#a8449a', '#c868b8', '#7a2c6e'] }, // sumak (a touch brighter than GDD for contrast on walnut)
    5: { shades: ['#3d6fd8', '#6e95ec', '#2b53aa'] }, // çivit
    6: { shades: ['#c27a3e', '#dda066', '#97592a'] }, // tarçın
  },
  flash: '#fff4d6',
  bomb: '#3a0800',
  bombSpark: '#ffe066',
  joker: ['#f2705c', '#ffd261', '#86cc73', '#6e95ec', '#c868b8', '#fff4d6'],
  sack: ['#c9a66b', '#dcbd86', '#8e6c3c'],
  sackKnot: '#5a3b1c',
  twine: ['#d8bb84', '#7a5a32'],
  ghostOk: 'rgba(255, 240, 210, 0.7)',
  ghostBad: 'rgba(255, 90, 60, 0.6)',
  columnHint: 'rgba(255, 214, 150, 0.07)',
  css: {
    // Night bazaar backdrop
    '--bg': '#1a120e',
    '--bg-sky': '#2a1b33',
    '--bg-sky-2': '#4a2337',
    '--bg-horizon': '#7a3a22',
    '--bg-deep': '#0f0a08',
    // Wooden surfaces (panels, cards, buttons)
    '--panel': '#2e1f17',
    '--panel-2': '#3b2a1f',
    '--panel-3': '#4b3527',
    '--line': '#614331',
    '--line-soft': 'rgba(240, 196, 130, 0.16)',
    '--wood': '#6b4426',
    '--wood-hi': '#8a5a36',
    '--wood-lo': '#3f2716',
    // Metal accents
    '--copper': '#c8773f',
    '--copper-hi': '#eeac72',
    '--copper-lo': '#7a4021',
    '--brass': '#d9a845',
    // Text
    '--fg': '#fbf0dc',
    '--muted': '#c9ad8d',
    '--faint': '#8c7360',
    // Primary action: saffron gold
    '--accent': '#f3b53f',
    '--accent-hi': '#ffd77a',
    '--accent-lo': '#b97818',
    '--on-accent': '#2b1705',
    // Paper (order slips, signs)
    '--parchment': '#f4e4c3',
    '--parchment-2': '#e8d0a3',
    '--parchment-ink': '#3b2414',
    '--parchment-muted': '#8a6a4a',
    '--jute': '#c9a66b',
    // State colours
    '--danger': '#ff5b3d',
    '--danger-glow': 'rgba(255, 72, 40, 0.45)',
    '--success': '#9ed36a',
    '--star': '#ffc94a',
    '--star-empty': '#4b3527',
    // Spice colours (HUD swatches, map regions); keep in sync with `sand` above
    '--spice-1': '#e0432f',
    '--spice-2': '#f4b526',
    '--spice-3': '#5dae4b',
    '--spice-4': '#a8449a',
    '--spice-5': '#3d6fd8',
    '--spice-6': '#c27a3e',
    // Shadows / depth (hard "stamped" shadow for chunky UI, soft for floating cards)
    '--shadow-hard': '0 3px 0 rgba(0, 0, 0, 0.38)',
    '--shadow-soft': '0 10px 28px rgba(0, 0, 0, 0.5)',
  },
};

let active: Theme = defaultTheme;

export function theme(): Theme {
  return active;
}

export function setTheme(t: Theme): void {
  active = t;
  applyCssVars(t);
  paletteCache = null;
}

export function applyCssVars(t: Theme = active): void {
  if (typeof document === 'undefined') return;
  const s = document.documentElement.style;
  for (const [k, v] of Object.entries(t.css)) s.setProperty(k, v);
}

export type Rgb = [number, number, number];

export function hexToRgb(hex: string): Rgb {
  const h = hex.replace('#', '');
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

/** Pack RGB as little-endian RGBA uint32 for ImageData Uint32 views. */
function pack([r, g, b]: Rgb, a = 255): number {
  return ((a << 24) | (b << 16) | (g << 8) | r) >>> 0;
}

export function mixRgb(a: Rgb, b: Rgb, t: number): Rgb {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t].map(Math.round) as Rgb;
}

/** Hex colour mixed towards another (0 = a, 1 = b). */
export function mixHex(a: string, b: string, t: number): string {
  const [r, g, bl] = mixRgb(hexToRgb(a), hexToRgb(b), t);
  return `#${((1 << 24) | (r << 16) | (g << 8) | bl).toString(16).slice(1)}`;
}

/**
 * Sub-grain pixel variants. Each grain is drawn as SUB×SUB pixels in the board's ImageData
 * (see boardRenderer): a soft highlight, a shaded corner, a lit "surface" row where the grain
 * faces empty space and a dark seam where it touches a different colour (keeps colour regions
 * readable — the whole puzzle is about seeing connected regions).
 */
export const V_BASE = 0;
export const V_HI = 1;
export const V_LO = 2;
export const V_RIM = 3;
export const V_EDGE = 4;
export const VARIANTS = 8;

export interface PackedPalette {
  /** index = ((color * 4 + shade) * VARIANTS + variant). */
  grain: Uint32Array;
  /** Same layout, bomb-tinted variants. */
  bomb: Uint32Array;
  /** Joker cycle colours (index = phase). */
  joker: Uint32Array;
  bg: number;
  flash: number;
  flashLo: number;
  spark: number;
  /** Shelf wood: [base, light, dark, seam]. */
  wood: Uint32Array;
  /** Jute: [weave A, weave B, seam, stitch]. */
  jute: Uint32Array;
}

let paletteCache: PackedPalette | null = null;

const WHITE: Rgb = [255, 248, 230];
const BLACK: Rgb = [20, 10, 6];

/** Lookup tables for the board renderer (rebuilt when the theme changes). */
export function packedPalette(): PackedPalette {
  if (paletteCache) return paletteCache;
  const t = active;
  const grain = new Uint32Array(256 * 4 * VARIANTS);
  const bomb = new Uint32Array(256 * 4 * VARIANTS);
  const bombRgb = hexToRgb(t.bomb);
  const fill = (id: number, shades: [string, string, string]) => {
    const base = hexToRgb(shades[0]);
    const light = hexToRgb(shades[1]);
    const dark = hexToRgb(shades[2]);
    // Grain-to-grain shade variation is kept subtle so colour regions read as one mass.
    const tones: Rgb[] = [base, mixRgb(base, light, 0.38), mixRgb(base, dark, 0.38)];
    for (let s = 0; s < 3; s++) {
      const b = tones[s];
      const v: Rgb[] = [];
      v[V_BASE] = b;
      v[V_HI] = mixRgb(b, light, 0.7);
      v[V_LO] = mixRgb(b, dark, 0.75);
      v[V_RIM] = mixRgb(mixRgb(b, light, 0.9), WHITE, 0.18);
      v[V_EDGE] = mixRgb(dark, BLACK, 0.45);
      for (let k = 0; k < VARIANTS; k++) {
        const c = v[k] ?? b;
        grain[(id * 4 + s) * VARIANTS + k] = pack(c);
        bomb[(id * 4 + s) * VARIANTS + k] = pack(mixRgb(c, bombRgb, k === V_EDGE ? 0.2 : 0.4));
      }
    }
  };
  // Fallback grey for undefined colour ids.
  for (let id = 1; id < 256; id++) fill(id, ['#999999', '#aaaaaa', '#888888']);
  for (const [id, c] of Object.entries(t.sand)) fill(Number(id), c.shades);
  fill(STONE, t.stone);
  fill(SACK, t.sack);
  fill(JOKER, [t.joker[0], t.joker[1], t.joker[2]]);
  const joker = new Uint32Array(t.joker.map((c) => pack(hexToRgb(c))));
  const w0 = hexToRgb(t.stone[0]);
  const wood = new Uint32Array([pack(w0), pack(hexToRgb(t.stone[1])), pack(hexToRgb(t.stone[2])), pack(mixRgb(hexToRgb(t.stone[2]), BLACK, 0.4))]);
  const j0 = hexToRgb(t.sack[0]);
  const jute = new Uint32Array([pack(j0), pack(mixRgb(j0, hexToRgb(t.sack[1]), 0.8)), pack(hexToRgb(t.sack[2])), pack(hexToRgb(t.twine[0]))]);
  const fl = hexToRgb(t.flash);
  paletteCache = {
    grain,
    bomb,
    joker,
    bg: pack(hexToRgb(t.boardBg), 0),
    flash: pack(fl),
    flashLo: pack(mixRgb(fl, [255, 196, 120], 0.45)),
    spark: pack(hexToRgb(t.bombSpark)),
    wood,
    jute,
  };
  return paletteCache;
}

/** CSS colour for a sand colour id (tray previews, HUD swatches). Joker uses its cycle colours. */
export function sandCss(id: number, shade = 0): string {
  if (id === JOKER) return active.joker[shade % active.joker.length];
  return active.sand[id]?.shades[shade] ?? '#999999';
}

/** Joker cycle phase for a timestamp (ms): one full loop every 0.8 s (GDD §3.2). */
export function jokerPhase(nowMs: number): number {
  const n = active.joker.length;
  return Math.floor((nowMs / 800) * n) % n;
}

/** Whether the player asked the OS for less motion (screen shake, big pops are skipped). */
export function reducedMotion(): boolean {
  return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
}
