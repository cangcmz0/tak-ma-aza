// Single source of truth for colours. The Art agent replaces values here.
import { STONE } from '../engine/grid';

export interface SandColor {
  /** Three grain shades: base, light, dark. */
  shades: [string, string, string];
}

export interface Theme {
  name: string;
  /** Board background (empty cell). */
  boardBg: string;
  /** Stone / obstacle shades. */
  stone: [string, string, string];
  /** Sand colours by colour id. */
  sand: Record<number, SandColor>;
  /** Flash colour for grains about to clear. */
  flash: string;
  /** Tint mixed into bomb grains. */
  bomb: string;
  ghostOk: string;
  ghostBad: string;
  columnHint: string;
  /** CSS custom properties applied to :root (UI chrome). */
  css: Record<string, string>;
}

export const defaultTheme: Theme = {
  name: 'Baharat Çarşısı (placeholder)',
  boardBg: '#1b1839',
  stone: ['#5d5873', '#6e6985', '#4c4862'],
  sand: {
    1: { shades: ['#e8553f', '#f27a5f', '#c9412e'] }, // pul biber
    2: { shades: ['#4fb874', '#6fcf8f', '#3a9a5c'] }, // nane
    3: { shades: ['#f2c230', '#f7d65e', '#d9a816'] }, // zerdeçal
    4: { shades: ['#9b3d63', '#b4587d', '#7f2c4f'] }, // sumak
    5: { shades: ['#8f7bea', '#a998f2', '#7562d2'] }, // lavanta
    6: { shades: ['#6b5a4a', '#857261', '#54453a'] }, // karabiber
  },
  flash: '#ffffff',
  bomb: '#1a1a1a',
  ghostOk: 'rgba(255,255,255,0.55)',
  ghostBad: 'rgba(255,80,80,0.55)',
  columnHint: 'rgba(255,255,255,0.06)',
  css: {
    '--bg': '#14112b',
    '--panel': '#221e45',
    '--panel-2': '#2b2656',
    '--line': '#36316e',
    '--fg': '#f3f0ff',
    '--muted': '#a8a2d6',
    '--accent': '#ffb547',
    '--on-accent': '#2a1a00',
    '--danger': '#ff6b6b',
    '--star': '#ffd166',
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

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

/** Pack RGB as little-endian RGBA uint32 for ImageData Uint32 views. */
function pack([r, g, b]: [number, number, number], a = 255): number {
  return ((a << 24) | (b << 16) | (g << 8) | r) >>> 0;
}

function mix(a: [number, number, number], b: [number, number, number], t: number): [number, number, number] {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t].map(Math.round) as [number, number, number];
}

export interface PackedPalette {
  /** index = color * 4 + shade (shade 3 unused). */
  grain: Uint32Array;
  /** Same layout, bomb-tinted variants. */
  bomb: Uint32Array;
  bg: number;
  flash: number;
}

let paletteCache: PackedPalette | null = null;

/** Lookup tables for the board renderer (rebuilt when the theme changes). */
export function packedPalette(): PackedPalette {
  if (paletteCache) return paletteCache;
  const t = active;
  const grain = new Uint32Array(256 * 4);
  const bomb = new Uint32Array(256 * 4);
  const bombRgb = hexToRgb(t.bomb);
  const fill = (id: number, shades: [string, string, string]) => {
    for (let s = 0; s < 3; s++) {
      const rgb = hexToRgb(shades[s]);
      grain[id * 4 + s] = pack(rgb);
      bomb[id * 4 + s] = pack(mix(rgb, bombRgb, 0.55));
    }
  };
  // Fallback grey for undefined colour ids.
  for (let id = 1; id < 256; id++) fill(id, ['#999999', '#aaaaaa', '#888888']);
  for (const [id, c] of Object.entries(t.sand)) fill(Number(id), c.shades);
  fill(STONE, t.stone);
  paletteCache = { grain, bomb, bg: pack(hexToRgb(t.boardBg)), flash: pack(hexToRgb(t.flash)) };
  return paletteCache;
}

/** CSS colour for a sand colour id (tray previews, HUD swatches). */
export function sandCss(id: number, shade = 0): string {
  return active.sand[id]?.shades[shade] ?? '#999999';
}
