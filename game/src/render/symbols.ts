// Colour-blind symbols per spice (GDD §3.2): shown on tray pouches and order chips,
// never on the board grains. One path set (24×24 box, even-odd fill) shared by canvas
// (Path2D) and inline SVG so both always match.
import { JOKER } from '../engine/grid';

export const SYMBOL_PATHS: Record<number, string> = {
  // 1 Pul Biber ▲
  1: 'M12 3.2 L21.2 19.6 H2.8 Z',
  // 2 Zerdeçal ●
  2: 'M3.8 12 a8.2 8.2 0 1 0 16.4 0 a8.2 8.2 0 1 0 -16.4 0 Z',
  // 3 Nane: leaf with a cut midrib
  3: 'M12 2.4 C18.6 7 19 15.4 12 21.6 C5 15.4 5.4 7 12 2.4 Z M11.25 8 H12.75 V19 H11.25 Z',
  // 4 Sumak ◆
  4: 'M12 2.2 L20.8 12 L12 21.8 L3.2 12 Z',
  // 5 Çivit ■
  5: 'M4.6 4.6 H19.4 V19.4 H4.6 Z',
  // 6 Tarçın ✚
  6: 'M9 3.2 H15 V9 H20.8 V15 H15 V20.8 H9 V15 H3.2 V9 H9 Z',
  // Joker ★
  [JOKER]: 'M12 2.2 L14.7 8.8 L21.8 9.3 L16.4 13.9 L18.1 20.9 L12 17.1 L5.9 20.9 L7.6 13.9 L2.2 9.3 L9.3 8.8 Z',
};

const cache = new Map<number, Path2D>();

/** Draw the symbol for colour `id` centred at (cx, cy) with half-size r. */
export function drawSymbol(c: CanvasRenderingContext2D, id: number, cx: number, cy: number, r: number, fill: string): void {
  const d = SYMBOL_PATHS[id];
  if (!d || typeof Path2D === 'undefined') return;
  let p = cache.get(id);
  if (!p) {
    p = new Path2D(d);
    cache.set(id, p);
  }
  c.save();
  c.translate(cx - r, cy - r);
  c.scale(r / 12, r / 12);
  c.fillStyle = fill;
  c.fill(p, 'evenodd');
  c.restore();
}

/** Inline SVG markup for a symbol (uses currentColor). */
export function symbolSvg(id: number, cls = 'sym'): string {
  const d = SYMBOL_PATHS[id];
  if (!d) return '';
  return `<svg class="${cls}" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" fill-rule="evenodd" d="${d}"/></svg>`;
}
