// Small shared economy widgets: gold badge, coin / booster icons, reward text, quick toast.
// Colours come from CSS variables (styles/economy.css) so the Art agent's palette applies.
import { BOOSTER_IDS, type BoosterId, type Reward } from '../game/economy';
import { fmt, strings } from '../i18n';
import type { App } from './app';
import { h } from './dom';

const SVG_NS = 'http://www.w3.org/2000/svg';

function svg(viewBox: string, paths: string, cls: string): SVGSVGElement {
  const el = document.createElementNS(SVG_NS, 'svg');
  el.setAttribute('viewBox', viewBox);
  el.setAttribute('aria-hidden', 'true');
  el.setAttribute('class', cls);
  el.innerHTML = paths;
  return el;
}

/** Gold coin (fill = currentColor via .coin). */
export function coinIcon(): SVGSVGElement {
  return svg('0 0 24 24', '<circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6.5" class="coin-inner"/>', 'coin');
}

const BOOSTER_PATHS: Record<BoosterId, string> = {
  // Two circular arrows.
  shuffle:
    '<path d="M4 12a8 8 0 0 1 13.7-5.6L20 4v7h-7l2.9-2.9A5 5 0 0 0 7 12z"/><path d="M20 12a8 8 0 0 1-13.7 5.6L4 20v-7h7l-2.9 2.9A5 5 0 0 0 17 12z"/>',
  // Ladle.
  scoop: '<path d="M14 2h2.5v10.5h-2.5z"/><path d="M4 12h16a8 8 0 0 1-16 0z"/>',
  // Sieve: ring with mesh.
  sieve:
    '<circle cx="11" cy="11" r="8" fill="none" stroke="currentColor" stroke-width="2.5"/><path d="M6 9h10M5.5 13h11M9 5v12M13 5v12" stroke="currentColor" stroke-width="1.3"/><path d="M17 17l5 5-1.5 1.5-5-5z"/>',
};

export function boosterIcon(id: BoosterId): SVGSVGElement {
  return svg('0 0 24 24', BOOSTER_PATHS[id], `booster-icon booster-icon-${id}`);
}

/**
 * Live gold balance. Follows Economy changes while attached to the document.
 * @param onTap e.g. open the shop (GDD §15: "+" → Mağaza)
 */
export function goldBadge(app: App, onTap?: () => void): HTMLElement {
  const s = strings().economy;
  const value = h('b', { class: 'gold-value', 'data-testid': 'gold-value' });
  const el = onTap
    ? h('button', { class: 'gold-badge', type: 'button', 'data-testid': 'gold-badge', onclick: onTap }, coinIcon(), value, h('span', { class: 'gold-plus', text: '+' }))
    : h('div', { class: 'gold-badge', 'data-testid': 'gold-badge' }, coinIcon(), value);
  let shown = -1;
  const paint = () => {
    const g = app.meta.economy.gold;
    if (g === shown) return;
    const up = shown >= 0 && g > shown;
    shown = g;
    value.textContent = g.toLocaleString('tr-TR');
    el.setAttribute('aria-label', fmt(s.goldAria, { n: g }) + (onTap ? ` — ${s.toShop}` : ''));
    if (up) {
      el.classList.remove('bump');
      void el.offsetWidth;
      el.classList.add('bump');
    }
  };
  paint();
  let seen = false;
  const off = app.meta.economy.events.on(() => {
    if (el.isConnected) seen = true;
    else if (seen) return off(); // detached for good: stop listening
    paint();
  });
  return el;
}

/** "+40 altın, +1 Kepçe" */
export function rewardText(r: Reward): string {
  const s = strings();
  const parts: string[] = [];
  if (r.gold > 0) parts.push(fmt(s.economy.rewardGold, { n: r.gold }));
  for (const id of BOOSTER_IDS) {
    const n = r.boosters[id];
    if (n) parts.push(fmt(s.economy.rewardBooster, { n, name: s.boosters.names[id] }));
  }
  return parts.join(', ');
}

/** Short message above everything (shop / meta screens without a play toast). */
export function flash(text: string, ms = 1400): void {
  const el = h('div', { class: 'econ-flash', role: 'status', 'data-testid': 'econ-flash', text });
  document.body.append(el);
  window.setTimeout(() => el.remove(), ms);
}
