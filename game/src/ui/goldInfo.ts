// "Altın ne işe yarar?" — opened by tapping any gold badge. One short card: what gold buys
// (the three boosters with a one-line effect and price, continuing after a loss) and how
// it is earned (level wins, daily reward, ads, region chests). A button leads to the shop.
import { BOOSTER_IDS, BOOSTERS, CHEST_GOLD, CONTINUE_PIECES, CONTINUE_PRICES, FIRST_WIN_GOLD, FREE_GOLD_AD } from '../game/economy';
import { fmt, strings } from '../i18n';
import type { App, Scene } from './app';
import { h } from './dom';
import { boosterIcon, coinIcon } from './econWidgets';
import { ShopScene } from './shop';

export class GoldInfoScene implements Scene {
  readonly el: HTMLElement;
  readonly overlay = true;

  constructor(private readonly app: App) {
    const s = strings();
    const g = s.goldInfo;
    const price = (n: number) => h('span', { class: 'gi-price' }, coinIcon(), h('b', { text: String(n) }));
    const boosters = h('ul', { class: 'gi-list' });
    for (const id of BOOSTER_IDS)
      boosters.append(
        h('li', {}, h('span', { class: 'gi-ico' }, boosterIcon(id)), h('span', { class: 'gi-text' }, h('b', { text: s.boosters.names[id] }), h('small', { text: s.boosters.desc[id] })), price(BOOSTERS[id].price)),
      );
    const earn = h(
      'ul',
      { class: 'gi-earn' },
      h('li', { text: fmt(g.earnWin, { a: FIRST_WIN_GOLD[1], b: FIRST_WIN_GOLD[3] }) }),
      h('li', { text: g.earnDaily }),
      h('li', { text: fmt(g.earnAd, { n: FREE_GOLD_AD }) }),
      h('li', { text: fmt(g.earnChest, { n: CHEST_GOLD }) }),
    );
    this.el = h(
      'section',
      { class: 'scene overlay', role: 'dialog', 'aria-modal': 'true', 'aria-label': g.title, 'data-testid': 'gold-info' },
      h(
        'div',
        { class: 'card gold-info' },
        h('div', { class: 'gi-head' }, h('span', { class: 'gi-coin' }, coinIcon()), h('h2', { text: g.title })),
        h('h3', { class: 'gi-sub', text: g.spendTitle }),
        h('p', { class: 'gi-lead', text: g.boosters }),
        boosters,
        h('p', { class: 'gi-row' }, h('span', { text: fmt(g.continue, { n: CONTINUE_PIECES, gold: CONTINUE_PRICES[0] }) })),
        h('h3', { class: 'gi-sub', text: g.earnTitle }),
        earn,
        h(
          'div',
          { class: 'gi-actions' },
          h('button', {
            class: 'btn',
            type: 'button',
            'data-testid': 'gold-info-shop',
            text: g.shop,
            onclick: () => {
              app.audio.play('ui_tap');
              app.scenes.pop();
              app.scenes.push(new ShopScene(app));
            },
          }),
          h('button', { class: 'btn btn-primary', type: 'button', 'data-testid': 'gold-info-ok', text: g.ok, onclick: () => this.back() }),
        ),
      ),
    );
  }

  back(): void {
    this.app.audio.play('ui_tap');
    this.app.scenes.pop();
  }
}
