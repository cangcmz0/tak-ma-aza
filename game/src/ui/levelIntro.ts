// Pre-level card (GDD §15 "Bölüm Öncesi" + §13 mechanic cards), styled as a parchment
// order slip: level number and name, the customer's portrait and order lines (symbol
// chips), the pouch allowance, hint and unseen "Yeni!" mechanic cards with a 2 s loop.
// Shown as an overlay above the (frozen) play scene; "Başla" closes it.
import { customerAvatar } from '../art/avatars';
import { POUCH_SVG } from '../art/icons';
import { iconEl } from '../art/svg';
import type { Session } from '../game/session';
import { fmt, strings } from '../i18n';
import type { App, Scene } from './app';
import { h } from './dom';
import { goalLabel } from './goalText';
import { goalChip } from './hud';

/** Mechanic intro ids from the level that this player has not seen yet. */
export function unseenIntros(app: App, ids: readonly string[]): string[] {
  const known = strings().mechanics;
  return ids.filter((id) => known[id] && !app.save.hasSeenIntro(id));
}

/** Which looping mini scene a mechanic card plays (CSS: .mech-anim.anim-*). */
const ANIM: Record<string, string> = {
  bomb: 'bomb',
  joker: 'joker',
  sack: 'sack',
  shelf: 'shelf',
  twoColor: 'two',
  newColorSumac: 'spice4',
  newColorIndigo: 'spice5',
  grains: 'grains',
  colorPath: 'path',
  scoreGoal: 'score',
};

function mechAnim(id: string): HTMLElement {
  const kind = ANIM[id] ?? 'fall';
  const el = h('div', { class: `mech-anim anim-${kind}`, 'aria-hidden': 'true' });
  const n = kind === 'path' ? 6 : kind === 'grains' ? 4 : 3;
  for (let k = 0; k < n; k++) el.append(h('i', { style: `--k:${k}` }));
  if (kind === 'sack' || kind === 'shelf' || kind === 'grains' || kind === 'score' || kind === 'bomb') el.append(h('b'));
  return el;
}

export class LevelIntroScene implements Scene {
  readonly el: HTMLElement;
  readonly overlay = true;

  constructor(
    private readonly app: App,
    session: Session,
    private readonly onCancel: () => void,
  ) {
    const s = strings();
    const lvl = session.level;
    const cards = unseenIntros(app, lvl.intro);
    const customer = s.customers[lvl.customer] ?? s.customers.ayse;
    const goals = h('ul', { class: 'intro-goals' });
    for (const g of session.goals.goals) goals.append(h('li', {}, goalChip(g), h('span', { text: goalLabel(g) })));
    const pieces = lvl.pieceLimit === null ? s.intro.unlimited : fmt(s.intro.pieces, { n: lvl.pieceLimit });
    this.el = h(
      'section',
      { class: 'scene overlay', role: 'dialog', 'aria-modal': 'true', 'aria-label': lvl.name, 'data-testid': 'level-intro' },
      h(
        'div',
        { class: 'card intro-card slip' },
        h('div', { class: 'slip-head' }, h('small', { class: 'intro-level', text: fmt(s.intro.level, { n: lvl.id }) }), h('h2', { text: lvl.name })),
        h('div', { class: 'intro-order' }, customerAvatar(lvl.customer, 'avatar-lg'), h('p', { class: 'speech', text: fmt(s.intro.order, { customer }) })),
        goals,
        h('p', { class: 'intro-pieces' }, iconEl(POUCH_SVG, 'pieces-pouch'), h('span', { text: pieces })),
        lvl.hint ? h('p', { class: 'intro-hint', text: lvl.hint }) : null,
        ...cards.map((id) => {
          const m = s.mechanics[id];
          return h(
            'div',
            { class: `mech-card mech-${id}`, 'data-testid': `intro-${id}` },
            mechAnim(id),
            h('div', { class: 'mech-text' }, h('span', { class: 'badge', text: s.intro.newBadge }), h('b', { text: m.title }), h('p', { text: m.text })),
          );
        }),
        h('button', {
          class: 'btn btn-primary',
          type: 'button',
          'data-testid': 'intro-start',
          text: cards.length ? s.intro.gotIt : s.intro.start,
          onclick: () => {
            app.audio.play('ui_tap');
            for (const id of cards) app.save.markIntroSeen(id);
            this.app.scenes.pop();
          },
        }),
      ),
    );
  }

  back(): void {
    this.onCancel();
  }
}
