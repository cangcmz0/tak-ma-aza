// Development stand-ins for the ad SDK and the store sheet. They sit above every scene
// (appended to <body>), like a native ad / billing sheet would.
import type { FakeAdPresenter } from '../platform/ads';
import type { FakePurchasePresenter } from '../platform/iap';
import { strings } from '../i18n';
import { h } from './dom';

/** "Reklam (deneme)" layer with a progress bar; resolves true when it ran for `ms`. */
export const presentFakeAd: FakeAdPresenter = (kind, ms) =>
  new Promise<boolean>((resolve) => {
    const s = strings().ads;
    const bar = h('i', { class: 'fake-ad-bar' });
    let done = false;
    const finish = (ok: boolean) => {
      if (done) return;
      done = true;
      window.clearTimeout(timer);
      layer.remove();
      resolve(ok);
    };
    const layer = h(
      'div',
      { class: 'fake-ad', role: 'dialog', 'aria-modal': 'true', 'aria-label': s.fakeTitle, 'data-testid': `fake-ad-${kind}` },
      h(
        'div',
        { class: 'fake-ad-box' },
        h('b', { class: 'fake-ad-title', text: s.fakeTitle }),
        h('p', { class: 'muted', text: kind === 'rewarded' ? s.fakeRewarded : s.fakeInterstitial }),
        h('div', { class: 'fake-ad-track' }, bar),
        kind === 'rewarded' ? h('button', { class: 'btn btn-ghost fake-ad-skip', type: 'button', text: s.skip, onclick: () => finish(false) }) : null,
      ),
    );
    bar.style.animationDuration = `${ms}ms`;
    document.body.append(layer);
    const timer = window.setTimeout(() => finish(true), ms);
  });

/** Fake store sheet: product, price and a clear "no real payment" note. */
export const presentFakePurchase: FakePurchasePresenter = (product) =>
  new Promise<boolean>((resolve) => {
    const s = strings();
    const name =
      product.id === 'remove_ads' ? s.shop.removeAds : product.id === 'gold_small' ? s.shop.goldSmall : product.id === 'gold_large' ? s.shop.goldLarge : product.id;
    const finish = (ok: boolean) => {
      layer.remove();
      resolve(ok);
    };
    const layer = h(
      'div',
      { class: 'fake-ad', role: 'dialog', 'aria-modal': 'true', 'aria-label': s.ads.purchaseTitle, 'data-testid': 'fake-purchase' },
      h(
        'div',
        { class: 'fake-ad-box' },
        h('b', { class: 'fake-ad-title', text: s.ads.purchaseTitle }),
        h('p', { class: 'fake-note', text: s.ads.purchaseNote }),
        h('p', { class: 'fake-product', text: `${name} — ${product.price}` }),
        h('button', { class: 'btn btn-primary', type: 'button', 'data-testid': 'fake-purchase-ok', text: s.ads.purchaseConfirm, onclick: () => finish(true) }),
        h('button', { class: 'btn btn-ghost', type: 'button', 'data-testid': 'fake-purchase-cancel', text: s.ads.purchaseCancel, onclick: () => finish(false) }),
      ),
    );
    document.body.append(layer);
  });
