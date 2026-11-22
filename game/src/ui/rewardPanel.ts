// Result-card economy pieces (mounted by ui/result.ts):
// - rewardPanelEl: gold earned (+ region chest) and "2 katına çıkar ▶" on a first win (GDD §11.1),
//   endless run gold.
// - leaveResult: level-end bookkeeping + interstitial on result → map / next level (GDD §11.2).
import { CHEST_BOOSTERS, CHEST_GOLD } from '../game/economy';
import type { SessionEndInfo } from '../game/meta';
import { fmt, strings } from '../i18n';
import type { App } from './app';
import { h } from './dom';
import { coinIcon, flash, goldBadge } from './econWidgets';

export function rewardPanelEl(app: App, info: SessionEndInfo | undefined): HTMLElement | null {
  if (!info) return null;
  const s = strings().reward;
  const r = info.reward;
  const gold = r ? r.levelGold : info.endlessGold;
  if (!r && gold <= 0) return null;
  const amount = h('b', { class: 'reward-amount', 'data-testid': 'reward-gold', text: fmt(s.gold, { n: gold }) });
  const kids: (HTMLElement | null)[] = [h('div', { class: 'reward-line' }, coinIcon(), amount)];
  // First gold ever: say what it is for (once).
  if (gold > 0 && !app.save.hasSeenIntro('goldTip')) {
    app.save.markIntroSeen('goldTip');
    kids.push(h('p', { class: 'gold-tip', 'data-testid': 'gold-tip', text: strings().goldInfo.firstGoldTip }));
  }
  if (r?.chest)
    kids.push(
      h(
        'div',
        { class: 'reward-chest', 'data-testid': 'reward-chest' },
        h('b', { text: s.chest }),
        h('small', { text: fmt(s.chestContents, { gold: CHEST_GOLD, scoop: CHEST_BOOSTERS.scoop ?? 0, sieve: CHEST_BOOSTERS.sieve ?? 0 }) }),
      ),
    );
  if (r?.firstWin && r.levelGold > 0 && !info.doubled && app.meta.ads.canShowRewarded('double_win')) {
    const btn: HTMLButtonElement = h('button', {
      class: 'btn reward-double',
      type: 'button',
      'data-testid': 'reward-double',
      text: s.double,
      onclick: async () => {
        btn.disabled = true;
        const got = await app.meta.doubleWin(info);
        if (got > 0) {
          amount.textContent = fmt(s.gold, { n: r.levelGold + got });
          app.audio.play('coin');
          flash(s.doubled);
          btn.remove();
        } else btn.disabled = false;
      },
    });
    kids.push(btn);
  }
  kids.push(goldBadge(app));
  return h('div', { class: 'reward-panel', 'data-testid': 'reward-panel' }, ...kids.filter((k): k is HTMLElement => k !== null));
}

/**
 * Leave a level result card. Counts the level end once; `toMap` (map / next level) may show
 * an interstitial first (never on retry). Navigation always happens, ad or not.
 */
export function leaveResult(app: App, info: SessionEndInfo | undefined, toMap: boolean, go: () => void): void {
  if (!info || info.endless) return go();
  if (leaving.has(info)) return;
  leaving.add(info);
  app.meta.ads.noteLevelEnd();
  if (!toMap) return go();
  void app.meta.ads
    .maybeShowInterstitial(info.adContext)
    .catch(() => false)
    .then(() => go());
}

const leaving = new WeakSet<SessionEndInfo>();
