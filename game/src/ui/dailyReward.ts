// Daily reward popup (GDD §12.1 / §15): 7-day strip, today's box glows, "Al" and "2 katı ▶".
import { DAILY_CYCLE, DAILY_REWARDS } from '../game/daily';
import { BOOSTER_IDS } from '../game/economy';
import { fmt, strings } from '../i18n';
import { LEVELS } from '../levels/levels';
import type { App, Scene } from './app';
import { h } from './dom';
import { boosterIcon, coinIcon, flash, rewardText } from './econWidgets';

/**
 * Open the popup when today's reward is waiting. Not before the player finished level 1
 * (first launch goes straight into play, GDD §15). `?debug=1&nodaily` suppresses it.
 */
export function maybeShowDaily(app: App): boolean {
  if (app.debug && new URLSearchParams(location.search).has('nodaily')) return false;
  const first = LEVELS[0]?.id;
  if (first !== undefined && !app.save.level(first)?.completed) return false;
  if (!app.meta.daily.status().available) return false;
  if (app.scenes.top instanceof DailyRewardScene) return false;
  app.scenes.push(new DailyRewardScene(app));
  return true;
}

export class DailyRewardScene implements Scene {
  readonly el: HTMLElement;
  readonly overlay = true;
  private busy = false;
  private readonly claimBtn: HTMLButtonElement;
  private readonly doubleBtn: HTMLButtonElement;

  constructor(private readonly app: App) {
    const s = strings();
    const st = app.meta.daily.status();
    const strip = h('ol', { class: 'daily-strip', 'aria-label': s.daily.title });
    for (let i = 0; i < DAILY_CYCLE; i++) {
      const r = DAILY_REWARDS[i];
      const icons = h('span', { class: 'daily-icons' });
      if (r.gold > 0) icons.append(coinIcon());
      for (const id of BOOSTER_IDS) if (r.boosters[id]) icons.append(boosterIcon(id));
      strip.append(
        h(
          'li',
          { class: `daily-box${i === st.index ? ' today' : ''}${i < st.index ? ' past' : ''}${i === DAILY_CYCLE - 1 ? ' big' : ''}`, 'data-testid': `daily-box-${i}` },
          h('small', { text: fmt(s.daily.day, { n: i + 1 }) }),
          icons,
          h('b', { text: r.gold > 0 ? String(r.gold) : `+${Object.values(r.boosters)[0] ?? 1}` }),
        ),
      );
    }
    this.claimBtn = h('button', { class: 'btn btn-primary', type: 'button', 'data-testid': 'daily-claim', text: s.daily.claim, onclick: () => void this.claim(false) });
    this.doubleBtn = h('button', {
      class: 'btn',
      type: 'button',
      'data-testid': 'daily-double',
      text: s.daily.double,
      disabled: !app.meta.ads.canShowRewarded('daily_double'),
      onclick: () => void this.claim(true),
    });
    this.el = h(
      'section',
      { class: 'scene overlay econ-overlay', role: 'dialog', 'aria-modal': 'true', 'aria-label': s.daily.title, 'data-testid': 'daily' },
      h(
        'div',
        { class: 'card daily-card' },
        h('h2', { text: s.daily.title }),
        h('p', { class: 'daily-streak', 'data-testid': 'daily-streak' }, h('span', { class: 'brazier', 'aria-hidden': 'true' }), fmt(s.daily.streak, { n: st.streak })),
        st.reset ? h('p', { class: 'muted', text: s.daily.reset }) : null,
        strip,
        h('p', { class: 'daily-today', text: rewardText(st.reward) }),
        this.claimBtn,
        this.doubleBtn,
      ),
    );
  }

  /** Back button = take the normal reward (the popup has no "lose it" path). */
  back(): void {
    void this.claim(false);
  }

  private async claim(double: boolean): Promise<void> {
    if (this.busy) return;
    this.busy = true;
    this.claimBtn.disabled = true;
    this.doubleBtn.disabled = true;
    try {
      const got = await this.app.meta.claimDaily(double);
      if (!got) {
        // Ad cancelled: stay open with both choices.
        if (this.app.meta.daily.status().available) {
          this.claimBtn.disabled = false;
          this.doubleBtn.disabled = !this.app.meta.ads.canShowRewarded('daily_double');
          return;
        }
      } else {
        this.app.audio.play('coin');
        flash(`${strings().daily.claimed} ${rewardText(got)}`, 1600);
      }
      if (this.app.scenes.top === this) this.app.scenes.pop();
    } finally {
      this.busy = false;
    }
  }
}
