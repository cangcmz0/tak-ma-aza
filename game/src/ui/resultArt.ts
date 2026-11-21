// Visual pieces of the result card (kept apart from result.ts, which the economy flow also
// edits): animated stars, spice confetti, Zerde's reaction and the "almost there" order
// progress shown after a loss (GDD §14.1 / §15).
import { icon } from '../art/icons';
import { zerde } from '../art/zerde';
import { goalDone } from '../game/goals';
import type { Session } from '../game/session';
import { fmt, strings } from '../i18n';
import { reducedMotion, sandCss } from '../render/theme';
import { h } from './dom';
import { goalLabel } from './goalText';
import { goalChip } from './hud';

/** Three stars that stamp in one after another (0.35 s apart, matching the star sound). */
export function resultStars(n: number): HTMLElement {
  const row = h('div', { class: 'result-stars', 'aria-label': fmt(strings().result.starsAria, { n }), 'data-stars': String(n) });
  for (let i = 0; i < 3; i++) {
    const st = h('span', { class: `rstar${i < n ? ' on' : ''}`, style: `--d:${1.0 + i * 0.35}s` }, icon('star', 'ico rstar-base'), i < n ? icon('star', 'ico rstar-fill') : null);
    row.append(st);
  }
  return row;
}

/** Zerde on top of the card: hops when won, ears down when lost. */
export function resultZerde(won: boolean): SVGSVGElement {
  return zerde(won ? 'happy' : 'sad', `card-zerde ${won ? 'hop' : 'sad'}`);
}

/** Falling spice confetti behind the card (CSS only, one-shot). */
export function confetti(colors: readonly number[]): HTMLElement | null {
  if (reducedMotion()) return null;
  const box = h('div', { class: 'confetti', 'aria-hidden': 'true' });
  const cols = colors.length ? colors : [1, 2, 3];
  for (let k = 0; k < 48; k++) {
    const c = sandCss(cols[k % cols.length], k % 3);
    const x = (k * 37) % 100;
    const delay = ((k * 53) % 90) / 100;
    const dur = 1.6 + ((k * 29) % 100) / 100;
    const rot = (k * 47) % 360;
    box.append(h('i', { style: `left:${x}%;background:${c};animation-delay:${delay}s;animation-duration:${dur}s;--r:${rot}deg` }));
  }
  return box;
}

/** After a loss: each order line with its progress ("3/4 yol — az kaldı!"). */
export function orderProgress(session: Session): HTMLElement | null {
  const goals = session.goals.goals;
  if (!goals.length) return null;
  const s = strings().result;
  const list = h('ul', { class: 'result-order', 'aria-label': s.orderProgress });
  let best = 0;
  for (const g of goals) {
    const frac = Math.min(1, g.current / Math.max(1, g.target));
    if (!goalDone(g)) best = Math.max(best, frac);
    const unit = g.def.type === 'clear_color_grains' ? ' g' : '';
    list.append(
      h(
        'li',
        { class: goalDone(g) ? 'done' : '' },
        goalChip(g),
        h('span', { class: 'ro-label', text: goalLabel(g) }),
        h('span', { class: 'ro-value', text: `${Math.min(g.current, g.target)}/${g.target}${unit}` }),
        h('i', { class: 'ro-bar', style: `--p:${frac}` }),
      ),
    );
  }
  return h('div', { class: 'result-order-box' }, list, best >= 0.6 ? h('p', { class: 'almost', text: s.almost }) : null);
}
