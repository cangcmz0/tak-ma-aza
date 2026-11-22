// Gameplay HUD (GDD §15 "Oyun"): pause, the customer's order card (avatar + order lines
// with symbol chips and gram progress), the pouch-shaped pieces counter and a score bar
// with the three star marks. DOM only; updated from PlayScene.updateHud() through update().
import { customerAvatar } from '../art/avatars';
import { icon, POUCH_SVG } from '../art/icons';
import { zerde } from '../art/zerde';
import { iconEl } from '../art/svg';
import { goalDone, type Goal } from '../game/goals';
import type { Session } from '../game/session';
import { fmt, strings } from '../i18n';
import { symbolSvg } from '../render/symbols';
import { sandCss } from '../render/theme';
import { h } from './dom';
import { goalColor, goalLabel, goalShortLabel } from './goalText';

export interface GoalEl {
  root: HTMLElement;
  value: HTMLElement;
  /** Fly-in target for grains (the symbol chip). */
  chip: HTMLElement;
  bar: HTMLElement;
}

/** Chip in front of an order line: spice colour + symbol, or a generic icon. */
export function goalChip(g: Goal): HTMLElement {
  const color = goalColor(g);
  const chip = h('span', { class: 'goal-chip', 'aria-hidden': 'true' });
  if (color !== undefined) {
    chip.classList.add('spice');
    chip.style.setProperty('--chip', sandCss(color));
    chip.style.setProperty('--chip-lo', sandCss(color, 2));
    // Colour paths show the wall-to-wall arrow on the spice colour; grain goals its symbol.
    if (g.def.type === 'clear_paths') chip.append(icon('path'));
    else chip.innerHTML = symbolSvg(color);
  } else if (g.def.type === 'score') chip.append(icon('star'));
  else if (g.def.type === 'clear_obstacles') chip.append(icon('sack'));
  else chip.append(icon('path'));
  if (g.def.type === 'clear_paths' && color !== undefined) chip.classList.add('path');
  return chip;
}

export class PlayHud {
  readonly header: HTMLElement;
  readonly scoreBar: HTMLElement;
  readonly scoreEl: HTMLElement;
  readonly piecesEl: HTMLElement;
  /** The counter block (tutorial points at it). */
  readonly piecesStat: HTMLElement;
  readonly goalEls: GoalEl[] = [];
  readonly orderCard: HTMLElement;
  private readonly fill: HTMLElement;
  private readonly marks: HTMLElement[] = [];
  private readonly thresholds: number[];
  private cache = { score: -1, pieces: -1 };
  private goalCache: number[] = [];

  constructor(
    private readonly session: Session,
    onPause: () => void,
  ) {
    const s = strings().hud;
    const level = session.level;
    const endless = session.endless;

    this.scoreEl = h('b', { class: 'score-value', 'data-testid': 'hud-score', text: '0' });
    this.piecesEl = h('b', { class: 'pieces-value', 'data-testid': 'hud-pieces' });
    const pouch = iconEl(POUCH_SVG, 'pieces-pouch');
    this.piecesStat = h(
      'div',
      { class: `hud-pieces${endless ? ' best' : ''}`, 'aria-label': endless ? s.best : s.pieces },
      endless ? icon('star', 'ico pieces-star') : pouch,
      this.piecesEl,
      h('small', { text: endless ? s.best : s.pieces }),
    );

    const goals = h('ul', { class: 'goals', 'aria-label': s.goals });
    for (const goal of session.goals.goals) {
      const value = h('span', { class: 'goal-value' });
      const chip = goalChip(goal);
      const bar = h('i', { class: 'goal-bar', 'aria-hidden': 'true' });
      const root = h('li', { class: 'goal', 'aria-label': goalLabel(goal) }, bar, chip, h('span', { class: 'goal-label', text: goalShortLabel(goal) }), value);
      const c = goalColor(goal);
      if (c !== undefined) root.style.setProperty('--goal-tint', sandCss(c));
      this.goalEls.push({ root, value, chip, bar });
      goals.append(root);
    }
    if (endless) goals.append(h('li', { class: 'goal goal-endless' }, h('span', { class: 'goal-label', text: s.endlessSub })));

    const caption = endless ? s.endlessTitle : `${fmt(s.level, { n: level.id })} · ${level.name}`;
    const face = endless ? h('span', { class: 'avatar avatar-zerde', 'aria-hidden': 'true' }, zerde('idle')) : customerAvatar(level.customer);
    this.orderCard = h(
      'div',
      { class: `order-card goals-${Math.min(3, session.goals.goals.length || 1)}`, 'data-testid': 'order-card' },
      face,
      h('div', { class: 'order-body' }, h('small', { class: 'order-caption', text: caption }), goals),
    );

    this.header = h(
      'header',
      { class: 'hud' },
      h('button', { class: 'btn hud-pause', type: 'button', 'aria-label': s.pause, 'data-testid': 'pause', onclick: onPause }, icon('pause')),
      this.orderCard,
      this.piecesStat,
    );

    // Score bar: fill towards the 3-star threshold, marks at 1/2/3 stars.
    this.thresholds = endless ? [] : [...level.stars];
    this.fill = h('i', { class: 'scorebar-fill' });
    const track = h('div', { class: 'scorebar-track', 'aria-hidden': 'true' }, this.fill);
    const top = this.thresholds[2] || 1;
    for (const t of this.thresholds) {
      const m = h('span', { class: 'scorebar-mark', style: `left:${Math.min(100, (t / top) * 100)}%` }, icon('star'));
      this.marks.push(m);
      track.append(m);
    }
    this.scoreBar = h('div', { class: `scorebar${endless ? ' endless' : ''}` }, track, h('div', { class: 'score-box' }, this.scoreEl, h('small', { text: s.score })));
  }

  /** @returns true when an order line changed. */
  update(bestEndless: number): boolean {
    const s = this.session;
    if (s.score !== this.cache.score) {
      this.cache.score = s.score;
      this.scoreEl.textContent = s.score.toLocaleString('tr-TR');
      const top = s.endless ? Math.max(1, bestEndless, s.score) : this.thresholds[2] || 1;
      this.fill.style.transform = `scaleX(${Math.min(1, s.score / top)})`;
      this.thresholds.forEach((t, i) => this.marks[i].classList.toggle('lit', i === 0 ? s.goals.allDone() : s.score >= t));
    }
    const pieceStat = s.endless ? Math.max(bestEndless, s.score) : s.piecesLeft;
    if (pieceStat !== this.cache.pieces) {
      this.cache.pieces = pieceStat;
      this.piecesEl.textContent = Number.isFinite(pieceStat) ? pieceStat.toLocaleString('tr-TR') : strings().hud.unlimited;
      this.piecesStat.classList.toggle('low', !s.endless && Number.isFinite(pieceStat) && pieceStat <= 3);
    }
    let changed = false;
    for (let i = 0; i < s.goals.goals.length; i++) {
      const g = s.goals.goals[i];
      if (this.goalCache[i] === g.current) continue;
      this.goalCache[i] = g.current;
      changed = true;
      const el = this.goalEls[i];
      const done = goalDone(g);
      const unit = g.def.type === 'clear_color_grains' ? ' g' : '';
      el.value.textContent = done ? '' : `${Math.min(g.current, g.target).toLocaleString('tr-TR')}/${g.target.toLocaleString('tr-TR')}${unit}`;
      if (done && !el.value.firstChild) el.value.append(icon('check'));
      el.bar.style.transform = `scaleX(${Math.min(1, g.current / Math.max(1, g.target))})`;
      el.root.classList.toggle('done', done);
    }
    return changed;
  }
}
