// Shop (GDD §15 "Mağaza"): Remove Ads, 2 gold packs, free gold (rewarded, 3/day),
// boosters for gold, restore purchases. Overlay scene: opens over the menu or the game.
import { BOOSTER_IDS, BOOSTERS, FREE_GOLD_AD } from '../game/economy';
import { fmt, strings } from '../i18n';
import { REWARDED_DAILY_LIMITS } from '../platform/ads';
import { PRODUCTS, type ProductId } from '../platform/iap';
import type { App, Scene } from './app';
import { h } from './dom';
import { boosterIcon, coinIcon, flash, goldBadge } from './econWidgets';

export class ShopScene implements Scene {
  readonly el: HTMLElement;
  readonly overlay = true;
  private readonly body: HTMLElement;
  private offEconomy: (() => void) | null = null;
  private busy = false;

  constructor(private readonly app: App) {
    const s = strings();
    this.body = h('div', { class: 'shop-body' });
    this.el = h(
      'section',
      { class: 'scene overlay econ-overlay', role: 'dialog', 'aria-modal': 'true', 'aria-label': s.shop.title, 'data-testid': 'shop' },
      h(
        'div',
        { class: 'card shop-card' },
        h(
          'header',
          { class: 'shop-head' },
          h('h2', { text: s.shop.title }),
          goldBadge(app),
          h('button', { class: 'btn btn-icon btn-ghost', type: 'button', 'aria-label': s.economy.close, 'data-testid': 'shop-close', text: '✕', onclick: () => this.close() }),
        ),
        app.meta.iap.fake ? h('p', { class: 'fake-note', 'data-testid': 'shop-fake-note', text: s.shop.fakeNote }) : null,
        this.body,
      ),
    );
    this.render();
  }

  enter(): void {
    this.offEconomy = this.app.meta.economy.events.on(() => this.render());
  }

  exit(): void {
    this.offEconomy?.();
  }

  back(): void {
    this.close();
  }

  private close(): void {
    this.app.audio.play('ui_tap');
    this.app.scenes.pop();
  }

  private render(): void {
    const s = strings();
    const { economy, ads, iap } = this.app.meta;
    const rows: HTMLElement[] = [];

    for (const p of PRODUCTS) {
      const owned = !p.consumable && economy.owns(p.id);
      const title = p.id === 'remove_ads' ? s.shop.removeAds : p.id === 'gold_small' ? s.shop.goldSmall : s.shop.goldLarge;
      const desc = p.noAds ? fmt(s.shop.removeAdsDesc, { n: p.gold }) : fmt(s.shop.goldAmount, { n: p.gold.toLocaleString('tr-TR') });
      rows.push(
        h(
          'div',
          { class: `shop-row${p.noAds ? ' shop-row-hero' : ''}` },
          h('span', { class: 'shop-ico' }, coinIcon()),
          h(
            'div',
            { class: 'shop-text' },
            h('b', { text: title }),
            h('small', { text: desc }),
            p.id === 'gold_large' ? h('span', { class: 'badge', text: s.shop.bonus }) : null,
          ),
          h('button', {
            class: 'btn btn-primary shop-buy',
            type: 'button',
            'data-testid': `shop-buy-${p.id}`,
            disabled: owned,
            text: owned ? s.shop.owned : iap.price(p.id),
            onclick: () => void this.buy(p.id),
          }),
        ),
      );
    }

    const left = ads.rewardedLeft('free_gold');
    const max = REWARDED_DAILY_LIMITS.free_gold;
    rows.push(
      h(
        'div',
        { class: 'shop-row' },
        h('span', { class: 'shop-ico' }, coinIcon()),
        h('div', { class: 'shop-text' }, h('b', { text: s.shop.freeGold }), h('small', { text: fmt(s.shop.freeGoldDesc, { n: FREE_GOLD_AD }) })),
        h('button', {
          class: 'btn shop-buy',
          type: 'button',
          'data-testid': 'shop-free-gold',
          disabled: !ads.canShowRewarded('free_gold'),
          text: left > 0 ? fmt(s.shop.freeLeft, { n: Math.min(left, max), max }) : s.shop.freeNone,
          onclick: () => void this.freeGold(),
        }),
      ),
    );

    rows.push(h('h3', { class: 'shop-sub', text: s.shop.boostersTitle }));
    for (const id of BOOSTER_IDS) {
      const b = BOOSTERS[id];
      rows.push(
        h(
          'div',
          { class: 'shop-row' },
          h('span', { class: 'shop-ico' }, boosterIcon(id)),
          h('div', { class: 'shop-text' }, h('b', { text: s.boosters.names[id] }), h('small', { text: fmt(s.shop.have, { n: economy.count(id) }) })),
          h(
            'button',
            {
              class: 'btn shop-buy shop-buy-gold',
              type: 'button',
              'data-testid': `shop-booster-${id}`,
              disabled: !economy.canAfford(b.price),
              onclick: () => {
                if (economy.buyBooster(id)) {
                  this.app.audio.play('coin');
                  flash(fmt(s.shop.gotBooster, { name: s.boosters.names[id] }));
                }
              },
            },
            coinIcon(),
            h('span', { text: String(b.price) }),
          ),
        ),
      );
    }
    rows.push(h('button', { class: 'btn btn-ghost shop-restore', type: 'button', 'data-testid': 'shop-restore', text: s.shop.restore, onclick: () => void this.restore() }));
    this.body.replaceChildren(...rows);
  }

  private async buy(id: ProductId): Promise<void> {
    if (this.busy) return;
    this.busy = true;
    this.app.audio.play('ui_tap');
    try {
      const res = await this.app.meta.buy(id);
      if (!res.ok) return;
      const s = strings().shop;
      this.app.audio.play('coin');
      flash(id === 'remove_ads' ? `${s.thanksNoAds} ${fmt(s.thanks, { n: res.gold })}` : fmt(s.thanks, { n: res.gold }), 1800);
    } finally {
      this.busy = false;
      this.render();
    }
  }

  private async freeGold(): Promise<void> {
    if (this.busy) return;
    this.busy = true;
    try {
      if (await this.app.meta.ads.showRewarded('free_gold')) {
        this.app.meta.economy.earn(FREE_GOLD_AD, 'ad_free_gold');
        this.app.audio.play('coin');
        flash(fmt(strings().economy.rewardGold, { n: FREE_GOLD_AD }));
      }
    } finally {
      this.busy = false;
      this.render();
    }
  }

  private async restore(): Promise<void> {
    const s = strings().shop;
    const ids = await this.app.meta.restore();
    flash(ids.length ? fmt(s.restored, { n: ids.length }) : s.restoredNone);
    this.render();
  }
}
