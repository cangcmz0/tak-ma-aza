import { ENDLESS_UNLOCK_LEVEL } from '../config';
import { fmt, strings } from '../i18n';
import { getLevel, LEVELS } from '../levels/levels';
import type { App, Scene } from './app';
import { h } from './dom';
import { LevelSelectScene } from './levelSelect';
import { PlayScene } from './play';

/** Endless mode opens after winning level ENDLESS_UNLOCK_LEVEL (or if that level does not exist). */
export function isEndlessUnlocked(app: App): boolean {
  if (app.debug && new URLSearchParams(location.search).has('unlockAll')) return true;
  return !getLevel(ENDLESS_UNLOCK_LEVEL) || !!app.save.level(ENDLESS_UNLOCK_LEVEL)?.completed;
}

export class MenuScene implements Scene {
  readonly el: HTMLElement;

  constructor(app: App) {
    const s = strings();
    const ids = LEVELS.map((l) => l.id);
    const current = app.save.currentLevel(ids);
    const endlessOpen = isEndlessUnlocked(app);
    const toggle = (key: 'sound' | 'haptics', label: string) => {
      const btn = h('button', { class: 'btn btn-ghost', type: 'button' });
      const paint = () => {
        const on = app.save.settings[key];
        btn.textContent = `${label}: ${on ? s.menu.on : s.menu.off}`;
        btn.setAttribute('aria-pressed', String(on));
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
      h('div', { class: 'menu-title' }, h('h1', { text: s.appName }), h('p', { class: 'tagline', text: s.tagline })),
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
          s.menu.play,
          current !== undefined ? h('small', { text: fmt(s.menu.continueLevel, { n: current }) }) : null,
        ),
        h('button', {
          class: 'btn',
          type: 'button',
          'data-testid': 'menu-levels',
          text: s.menu.levels,
          onclick: () => {
            app.audio.unlock();
            app.audio.play('ui_tap');
            app.scenes.replace(new LevelSelectScene(app));
          },
        }),
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
          s.menu.endless,
          h('small', {
            text: endlessOpen ? fmt(s.menu.endlessBest, { n: app.save.endlessBest }) : fmt(s.menu.endlessLocked, { n: ENDLESS_UNLOCK_LEVEL }),
          }),
        ),
        h('div', { class: 'menu-toggles' }, toggle('sound', s.menu.sound), toggle('haptics', s.menu.haptics)),
      ),
      h('p', { class: 'version', text: fmt(s.menu.version, { v: app.version }) }),
    );
  }
}
