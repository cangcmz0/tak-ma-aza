// "Kaybettin" → continue offer (GDD §10.1 / §11.1 / §15): "Reklam izle" (1st continue only)
// and "300 altın" (600 for the 2nd); no 3rd. Levels 1–5: the first one is free.
// Mounted inside the lose card (ui/result.ts); `onContinue` resumes the attempt.
import { CONTINUE_PIECES, continueOffer } from '../game/economy';
import type { Session } from '../game/session';
import { fmt, strings } from '../i18n';
import type { App } from './app';
import { h } from './dom';
import { coinIcon, goldBadge } from './econWidgets';
import { ShopScene } from './shop';

/** @returns null when no continue is possible (3rd time, endless). */
export function continueOfferEl(app: App, session: Session, onContinue: () => void): HTMLElement | null {
  if (session.endless) return null;
  const offer = continueOffer(session.continues, session.level.id);
  if (!offer) return null;
  const s = strings().continueOffer;
  const n = CONTINUE_PIECES;
  let busy = false;
  const go = () => {
    app.audio.play('ui_tap');
    onContinue();
  };
  const buttons: HTMLElement[] = [];

  if (offer.free) {
    buttons.push(h('button', { class: 'btn btn-primary', type: 'button', 'data-testid': 'continue-free', text: fmt(s.free, { n }), onclick: () => go() }));
  } else {
    if (offer.ad && app.meta.ads.canShowRewarded('continue')) {
      buttons.push(
        h('button', {
          class: 'btn btn-primary',
          type: 'button',
          'data-testid': 'continue-ad',
          text: fmt(s.ad, { n }),
          onclick: async () => {
            if (busy) return;
            busy = true;
            try {
              if ((await app.meta.ads.showRewarded('continue')) && el.isConnected) go(); // card still open
            } finally {
              busy = false;
            }
          },
        }),
      );
    }
    const goldBtn = h(
      'button',
      {
        class: buttons.length ? 'btn continue-gold' : 'btn btn-primary continue-gold',
        type: 'button',
        'data-testid': 'continue-gold',
        onclick: () => {
          if (busy) return;
          if (app.meta.economy.spend(offer.price, `continue_${offer.index + 1}`)) go();
          else {
            // Not enough gold: the shop is the only "offer" here (GDD §11.3 — no other upsell).
            app.audio.play('ui_tap');
            app.scenes.push(new ShopScene(app));
          }
        },
      },
      coinIcon(),
      h('span', { text: fmt(s.gold, { n, price: offer.price }) }),
    );
    buttons.push(goldBtn);
  }

  const hint = h('small', { class: 'muted continue-hint' });
  const paintHint = () => {
    if (offer.free) hint.textContent = '';
    else hint.textContent = app.meta.economy.canAfford(offer.price) ? '' : s.notEnough;
  };
  paintHint();
  const off = app.meta.economy.events.on(() => (el.isConnected ? paintHint() : off()));

  const el = h(
    'div',
    { class: 'continue-offer', 'data-testid': 'continue-offer' },
    h('b', { class: 'continue-title', text: s.title }),
    h('small', { class: 'muted', text: session.loseReason === 'no_space' ? fmt(s.detailClear, { n }) : fmt(s.detail, { n }) }),
    ...buttons,
    offer.free ? null : goldBadge(app),
    hint,
  );
  return el;
}
