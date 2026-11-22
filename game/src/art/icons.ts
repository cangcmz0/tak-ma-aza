// Hand-drawn UI icons (24×24, inline SVG strings). No emoji / icon fonts: they render
// differently per Android version and break the visual language.
import { SYMBOL_PATHS } from '../render/symbols';
import { JOKER } from '../engine/grid';
import { iconEl } from './svg';

const S = (body: string, vb = '0 0 24 24') => `<svg viewBox="${vb}" aria-hidden="true">${body}</svg>`;

export const ICONS = {
  pause: S('<rect x="6" y="5" width="4.2" height="14" rx="1.4" fill="currentColor"/><rect x="13.8" y="5" width="4.2" height="14" rx="1.4" fill="currentColor"/>'),
  back: S('<path d="M15 4.5 L7.5 12 L15 19.5" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>'),
  play: S('<path d="M8 5 L19 12 L8 19 Z" fill="currentColor" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>'),
  retry: S('<path d="M18.5 12 a6.5 6.5 0 1 1 -2 -4.7" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round"/><path d="M17.5 3.5 V8.2 H12.8" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"/>'),
  map: S('<path d="M3.5 6.5 L9 4.5 L15 6.5 L20.5 4.5 V17.5 L15 19.5 L9 17.5 L3.5 19.5 Z" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linejoin="round"/><path d="M9 4.5 V17.5 M15 6.5 V19.5" stroke="currentColor" stroke-width="2"/>'),
  home: S('<path d="M4 20 V11.5 C4 7 8 4 12 4 C16 4 20 7 20 11.5 V20 Z" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linejoin="round"/><path d="M9.5 20 V15 a2.5 2.5 0 0 1 5 0 V20" fill="none" stroke="currentColor" stroke-width="2.2"/>'),
  sound: S('<path d="M4 9.5 H7.5 L12 5.5 V18.5 L7.5 14.5 H4 Z" fill="currentColor" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><path d="M15.5 9 q2 3 0 6 M18 6.5 q4 5.5 0 11" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/>'),
  soundOff: S('<path d="M4 9.5 H7.5 L12 5.5 V18.5 L7.5 14.5 H4 Z" fill="currentColor" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><path d="M15.5 9.5 L20.5 14.5 M20.5 9.5 L15.5 14.5" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/>'),
  haptics: S('<rect x="8" y="4" width="8" height="16" rx="2" fill="none" stroke="currentColor" stroke-width="2.2"/><path d="M4.5 8.5 v7 M2 10.5 v3 M19.5 8.5 v7 M22 10.5 v3" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>'),
  hapticsOff: S('<rect x="8" y="4" width="8" height="16" rx="2" fill="none" stroke="currentColor" stroke-width="2.2" opacity=".55"/><path d="M4 4 L20 20" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/>'),
  lock: S('<path d="M8 10.5 V8 a4 4 0 0 1 8 0 V10.5" fill="none" stroke="currentColor" stroke-width="2.4"/><rect x="5.5" y="10" width="13" height="10" rx="2.2" fill="currentColor"/>'),
  check: S('<path d="M5 12.5 L10 17.5 L19 7" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"/>'),
  star: S(`<path d="${SYMBOL_PATHS[JOKER]}" fill="currentColor" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/>`),
  /** Wall-to-wall path "|↔|" (the core rule). */
  path: S('<rect x="1.5" y="4" width="2.6" height="16" rx="1" fill="currentColor"/><rect x="19.9" y="4" width="2.6" height="16" rx="1" fill="currentColor"/><path d="M7 12 H17" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/><path d="M5.6 12 L9.4 8.4 V15.6 Z M18.4 12 L14.6 8.4 V15.6 Z" fill="currentColor"/>'),
  coins: S('<ellipse cx="12" cy="16" rx="7.5" ry="3.2" fill="currentColor" opacity=".55"/><ellipse cx="12" cy="12.5" rx="7.5" ry="3.2" fill="currentColor" opacity=".8"/><ellipse cx="12" cy="9" rx="7.5" ry="3.2" fill="currentColor"/>'),
  sack: S('<path d="M6 9 C3.5 14 4 20.5 12 20.5 C20 20.5 20.5 14 18 9 Z" fill="currentColor"/><path d="M7.5 8.5 Q12 10.5 16.5 8.5 L17.5 4.5 L14.5 6 L12 3.5 L9.5 6 L6.5 4.5 Z" fill="currentColor" opacity=".75"/><path d="M7 14 h10 M7.5 17 h9" stroke="rgba(0,0,0,.25)" stroke-width="1.2" stroke-dasharray="1.6 1.4"/>'),
};

export type IconName = keyof typeof ICONS;

export function icon(name: IconName, cls = 'ico'): HTMLSpanElement {
  return iconEl(ICONS[name], cls);
}

/**
 * The spice pouch ("kese") used for the pieces counter and piece allowances: jute body,
 * twine tie and a pinch of spice on top. Colour comes from CSS (--pouch-spice).
 */
export const POUCH_SVG = `<svg class="pouch" viewBox="0 0 40 44" aria-hidden="true">
  <path d="M10 15 C3 23 4 41 20 41 C36 41 37 23 30 15 Z" fill="var(--jute)"/>
  <path d="M10 15 C3 23 4 41 20 41 C36 41 37 23 30 15 Z" fill="none" stroke="var(--wood-lo)" stroke-width="2"/>
  <path d="M11 15 C12 9 16 7 20 7 C24 7 28 9 29 15 Z" fill="var(--pouch-spice, var(--spice-1))"/>
  <path d="M9.5 15.5 Q20 19.5 30.5 15.5" fill="none" stroke="var(--twine, #7a5a32)" stroke-width="2.6" stroke-linecap="round"/>
  <path d="M20 17.5 l-4 5 M20 17.5 l4 5" stroke="var(--twine, #7a5a32)" stroke-width="2" stroke-linecap="round"/>
</svg>`;

/** Treasure chest for region-end nodes (GDD §9.1). */
export const CHEST_SVG = `<svg viewBox="0 0 32 28" aria-hidden="true">
  <path d="M3 12 C3 5 8 3 16 3 C24 3 29 5 29 12 Z" fill="#a8642f" stroke="#4e2f19" stroke-width="1.6"/>
  <rect x="3" y="12" width="26" height="13" rx="1.5" fill="#8a5028" stroke="#4e2f19" stroke-width="1.6"/>
  <path d="M3 16 H29" stroke="#4e2f19" stroke-width="1.4"/>
  <path d="M9 3.6 V25 M23 3.6 V25" stroke="#e8b84a" stroke-width="2.2"/>
  <rect x="13" y="10" width="6" height="7.5" rx="1.2" fill="#e8b84a" stroke="#4e2f19" stroke-width="1.2"/>
  <circle cx="16" cy="13.4" r="1.2" fill="#4e2f19"/>
</svg>`;
