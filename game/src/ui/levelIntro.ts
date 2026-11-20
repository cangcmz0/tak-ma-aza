// Pre-level card (GDD §15 "Bölüm Öncesi" + §13 mechanic cards): level number and name,
// the customer's order (goal lines), piece allowance, hint and unseen "Yeni!" mechanic cards.
// Shown as an overlay above the (frozen) play scene; "Başla" closes it.
import type { Session } from '../game/session';
import { fmt, strings } from '../i18n';
import { sandCss } from '../render/theme';
import type { App, Scene } from './app';
import { h } from './dom';
import { goalColor, goalLabel } from './goalText';

/** Avatar tint per customer (placeholder until the Art agent draws avatars). */
const CUSTOMER_TINT: Record<string, string> = { ayse: '#e8553f', mehmet: '#4f6fe0', selim: '#4fb874', anna: '#f2c230' };

/** Mechanic intro ids from the level that this player has not seen yet. */
export function unseenIntros(app: App, ids: readonly string[]): string[] {
  const known = strings().mechanics;
  return ids.filter((id) => known[id] && !app.save.hasSeenIntro(id));
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
    for (const g of session.goals.goals) {
      const c = goalColor(g);
      goals.append(
        h('li', {}, c !== undefined ? h('i', { class: 'swatch', style: `background:${sandCss(c)}` }) : h('i', { class: 'swatch swatch-none' }), goalLabel(g)),
      );
    }
    const pieces = lvl.pieceLimit === null ? s.intro.unlimited : fmt(s.intro.pieces, { n: lvl.pieceLimit });
    this.el = h(
      'section',
      { class: 'scene overlay', role: 'dialog', 'aria-modal': 'true', 'aria-label': lvl.name, 'data-testid': 'level-intro' },
      h(
        'div',
        { class: 'card intro-card' },
        h('small', { class: 'intro-level', text: fmt(s.intro.level, { n: lvl.id }) }),
        h('h2', { text: lvl.name }),
        h(
          'div',
          { class: 'intro-order' },
          h('div', { class: 'avatar', style: `background:${CUSTOMER_TINT[lvl.customer] ?? CUSTOMER_TINT.ayse}`, 'aria-hidden': 'true', text: customer.charAt(0) }),
          h('p', { text: fmt(s.intro.order, { customer }) }),
        ),
        goals,
        h('p', { class: 'muted', text: pieces }),
        lvl.hint ? h('p', { class: 'intro-hint', text: lvl.hint }) : null,
        ...cards.map((id) => {
          const m = s.mechanics[id];
          return h(
            'div',
            { class: `mech-card mech-${id}`, 'data-testid': `intro-${id}` },
            h('div', { class: 'mech-anim', 'aria-hidden': 'true' }, h('i'), h('i'), h('i')),
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
