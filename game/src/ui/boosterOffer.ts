// "Booster bitti" offer (GDD §11.1 / §15): buy one for gold, watch an ad for one (3/day),
// or go to the shop. Shown when a booster with count 0 is tapped.
import { BOOSTERS, type BoosterId } from '../game/economy';
import { fmt, strings } from '../i18n';
import type { App, Scene } from './app';
import { h } from './dom';
import { boosterIcon, coinIcon, goldBadge } from './econWidgets';
import { ShopScene } from './shop';

export class BoosterOfferScene implements Scene {
  readonly el: HTMLElement;
  readonly overlay = true;
  private busy = false;
  private readonly actions: HTMLElement;
  private offEconomy: (() => void) | null = null;

  /** @param onGot called (after this overlay closed) when the player now has one */
  constructor(
    private readonly app: App,
    private readonly id: BoosterId,
    private readonly onGot: () => void,
  ) {
    const s = strings();
    const name = s.boosters.names[id];
    this.actions = h('div', { class: 'offer-actions' });
    this.el = h(
      'section',
      { class: 'scene overlay econ-overlay', role: 'dialog', 'aria-modal': 'true', 'aria-label': fmt(s.boosters.offerTitle, { name }), 'data-testid': 'booster-offer' },
      h(
        'div',
        { class: 'card offer-card' },
        h('span', { class: 'offer-ico' }, boosterIcon(id)),
        h('h2', { text: fmt(s.boosters.offerTitle, { name }) }),
        h('p', { class: 'muted', text: s.boosters.desc[id] }),
        goldBadge(app),
        this.actions,
      ),
    );
    this.render();
  }

  enter(): void {
    // Refresh after a visit to the shop (overlay above this one).
    this.offEconomy = this.app.meta.economy.events.on(() => this.render());
  }

  exit(): void {
    this.offEconomy?.();
  }

  back(): void {
    this.app.scenes.pop();
  }

  private render(): void {
    const s = strings();
    const { economy, ads } = this.app.meta;
    const price = BOOSTERS[this.id].price;
    const afford = economy.canAfford(price);
    const adLeft = ads.rewardedLeft('booster');
    const items: (HTMLElement | null)[] = [
      h(
        'button',
        { class: 'btn btn-primary offer-buy', type: 'button', 'data-testid': 'offer-buy', disabled: !afford, onclick: () => this.buy() },
        coinIcon(),
        h('span', { text: afford ? fmt(s.boosters.buyFor, { n: price }) : `${fmt(s.boosters.buyFor, { n: price })} · ${s.economy.notEnough}` }),
      ),
      adLeft > 0
        ? h(
            'button',
            { class: 'btn offer-ad', type: 'button', 'data-testid': 'offer-ad', onclick: () => void this.watch() },
            h('span', { text: s.boosters.watchForOne }),
            h('small', { text: fmt(s.boosters.adsLeft, { n: adLeft }) }),
          )
        : null,
      h('button', {
        class: afford ? 'btn btn-ghost' : 'btn',
        type: 'button',
        'data-testid': 'offer-shop',
        text: s.boosters.toShop,
        onclick: () => {
          this.app.audio.play('ui_tap');
          this.app.scenes.push(new ShopScene(this.app));
        },
      }),
      h('button', { class: 'btn btn-ghost', type: 'button', 'data-testid': 'offer-cancel', text: s.boosters.cancel, onclick: () => this.back() }),
    ];
    this.actions.replaceChildren(...items.filter((x): x is HTMLElement => x !== null));
  }

  private done(): void {
    if (this.app.scenes.top === this) this.app.scenes.pop();
    this.onGot();
  }

  private buy(): void {
    if (this.busy) return;
    if (this.app.meta.economy.buyBooster(this.id)) {
      this.app.audio.play('coin');
      this.done();
    }
  }

  private async watch(): Promise<void> {
    if (this.busy) return;
    this.busy = true;
    try {
      if (await this.app.meta.ads.showRewarded('booster')) {
        this.app.meta.economy.addBooster(this.id, 1, 'ad_booster');
        this.done();
      }
    } finally {
      this.busy = false;
    }
  }
}
