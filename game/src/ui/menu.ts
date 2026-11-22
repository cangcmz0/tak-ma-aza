import { icon } from '../art/icons';
import { logo, moon, skyline } from '../art/scenery';
import { zerde } from '../art/zerde';
import { ENDLESS_UNLOCK_LEVEL } from '../config';
import { fmt, strings } from '../i18n';
import { getLevel, LEVELS } from '../levels/levels';
import { exitApp, isNative } from '../platform/native';
import type { App, Scene } from './app';
import { ConfirmScene } from './confirm';
import { h } from './dom';
import { LevelSelectScene } from './levelSelect';
import { menuEntered, menuMetaBar } from './menuMeta';
import { PlayScene } from './play';

/** Endless mode opens after winning level ENDLESS_UNLOCK_LEVEL (or if that level does not exist). */
export function isEndlessUnlocked(app: App): boolean {
  if (app.debug && new URLSearchParams(location.search).has('unlockAll')) return true;
  return !getLevel(ENDLESS_UNLOCK_LEVEL) || !!app.save.level(ENDLESS_UNLOCK_LEVEL)?.completed;
}

/**
 * First scene after boot. First launch (nothing played yet) skips the menu and opens level 1,
 * which shows the "Nasıl oynanır?" card first (GDD §15, QA-007). `?debug=1&nofirst` (or
 * `&unlockAll`) keeps the menu for automated runs.
 */
export function startScene(app: App): Scene {
  const q = new URLSearchParams(location.search);
  const skip = app.debug && (q.has('nofirst') || q.has('unlockAll')); // tester modes keep the menu
  const first = LEVELS[0];
  if (!skip && first && app.save.isFresh) return new PlayScene(app, { kind: 'level', id: first.id });
  return new MenuScene(app);
}

export class MenuScene implements Scene {
  readonly el: HTMLElement;

  constructor(private readonly app: App) {
    const s = strings();
    const ids = LEVELS.map((l) => l.id);
    const current = app.save.currentLevel(ids);
    const endlessOpen = isEndlessUnlocked(app);
    // Round copper icon toggles (sound / haptics); the label stays in aria-label.
    const toggle = (key: 'sound' | 'haptics', label: string) => {
      const btn = h('button', { class: 'btn btn-icon btn-toggle', type: 'button', 'data-testid': `menu-${key}` });
      const paint = () => {
        const on = app.save.settings[key];
        btn.replaceChildren(icon(key === 'sound' ? (on ? 'sound' : 'soundOff') : on ? 'haptics' : 'hapticsOff'));
        btn.setAttribute('aria-label', `${label}: ${on ? s.menu.on : s.menu.off}`);
        btn.setAttribute('aria-pressed', String(on));
        btn.classList.toggle('off', !on);
      };
      btn.addEventListener('click', () => {
        const v = !app.save.settings[key];
        app.save.setSetting(key, v);
        if (key === 'sound') app.audio.setEnabled(v);
        else app.haptics.setEnabled(v);
        app.audio.play('ui_tap');
        paint();
      });
      paint();
      return btn;
    };

    this.el = h(
      'section',
      { class: 'scene menu' },
      h('div', { class: 'menu-backdrop', 'aria-hidden': 'true' }, moon(), skyline()),
      menuMetaBar(app), // economy: gold, streak, shop (ui/menuMeta.ts)
      h(
        'div',
        { class: 'menu-title' },
        h('h1', { class: 'sr-only', text: s.appName }),
        logo(s.appName),
        h('p', { class: 'tagline' }, h('i', { 'aria-hidden': 'true' }), h('span', { text: s.tagline }), h('i', { 'aria-hidden': 'true' })),
      ),
      h('div', { class: 'menu-hero', 'aria-hidden': 'true' }, h('i', { class: 'hero-sack' }), zerde('idle', 'menu-zerde')),
      h(
        'div',
        { class: 'menu-buttons' },
        h(
          'button',
          {
            class: 'btn btn-primary btn-big',
            type: 'button',
            'data-testid': 'menu-play',
            onclick: () => {
              app.audio.unlock();
              app.audio.play('ui_tap');
              if (current !== undefined) app.scenes.replace(new PlayScene(app, current));
            },
          },
          h('span', { class: 'play-label' }, icon('play'), s.menu.play),
          current !== undefined ? h('small', { text: fmt(s.menu.continueLevel, { n: current }) }) : null,
        ),
        h(
          'button',
          {
            class: 'btn btn-levels',
            type: 'button',
            'data-testid': 'menu-levels',
            onclick: () => {
              app.audio.unlock();
              app.audio.play('ui_tap');
              app.scenes.replace(new LevelSelectScene(app));
            },
          },
          icon('map'),
          h('span', { text: s.menu.levels }),
        ),
        h(
          'button',
          {
            class: 'btn btn-big btn-endless',
            type: 'button',
            'data-testid': 'menu-endless',
            disabled: !endlessOpen,
            onclick: () => {
              app.audio.unlock();
              app.audio.play('ui_tap');
              app.scenes.replace(new PlayScene(app, { kind: 'endless' }));
            },
          },
          h('span', { class: 'play-label' }, icon(endlessOpen ? 'sack' : 'lock'), s.menu.endless),
          h('small', {
            text: endlessOpen ? fmt(s.menu.endlessBest, { n: app.save.endlessBest }) : fmt(s.menu.endlessLocked, { n: ENDLESS_UNLOCK_LEVEL }),
          }),
        ),
      ),
      h(
        'footer',
        { class: 'menu-foot' },
        h('div', { class: 'menu-toggles' }, toggle('sound', s.menu.sound), toggle('haptics', s.menu.haptics)),
        h('p', { class: 'version', text: fmt(s.menu.version, { v: app.version }) }),
      ),
    );
  }

  enter(): void {
    menuEntered(this.app); // daily reward popup (ui/dailyReward.ts)
  }

  /**
   * Android back on the main menu: ask "Çıkılsın mı?" before closing the app (GDD §15, QA-006).
   * On the web there is nothing to exit; the dialog is only shown in debug builds (tests).
   */
  back(): void {
    if (this.app.scenes.top !== this) return;
    if (!isNative() && !this.app.debug) return;
    const c = strings().confirm;
    this.app.scenes.push(
      new ConfirmScene(this.app, { id: 'exit', title: c.exitTitle, body: c.exitBody, yes: c.exitYes, onYes: () => void exitApp() }),
    );
  }
}
