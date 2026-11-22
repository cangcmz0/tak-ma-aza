// Main menu economy strip (GDD §15 "Ana Menü"): gold (+ → shop), daily streak, shop button.
// Mounted by ui/menu.ts; also opens the daily reward popup.
import { fmt, strings } from '../i18n';
import type { App } from './app';
import { maybeShowDaily } from './dailyReward';
import { h } from './dom';
import { goldBadge } from './econWidgets';
import { ShopScene } from './shop';

export function menuMetaBar(app: App): HTMLElement {
  const s = strings().economy;
  const openShop = () => {
    app.audio.unlock();
    app.audio.play('ui_tap');
    app.scenes.push(new ShopScene(app));
  };
  const st = app.meta.daily.status();
  const streak = st.reset ? 0 : app.save.daily.streak; // broken streak: hide until today's claim
  return h(
    'div',
    { class: 'menu-meta', 'data-testid': 'menu-meta' },
    goldBadge(app), // tap → "Altın ne işe yarar?" (ui/goldInfo.ts)
    streak > 0
      ? h('span', { class: 'streak-chip', 'aria-label': fmt(s.streakAria, { n: streak }), 'data-testid': 'streak' }, h('span', { class: 'brazier', 'aria-hidden': 'true' }), fmt(s.streak, { n: streak }))
      : null,
    h('button', { class: 'btn menu-shop', type: 'button', 'data-testid': 'menu-shop', text: s.shop, onclick: openShop }),
  );
}

/** Call from the menu's enter(): daily popup on the first visit of the day. */
export function menuEntered(app: App): void {
  maybeShowDaily(app);
}
