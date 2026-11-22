import { icon } from '../art/icons';
import { zerde } from '../art/zerde';
import { feedbackToggles } from '../fx/settingsToggle';
import { strings } from '../i18n';
import type { App, Scene } from './app';
import { h } from './dom';
import { HowToScene } from './howTo';
import { LevelSelectScene } from './levelSelect';
import { MenuScene } from './menu';
import { PlayScene, type PlayMode } from './play';

export class PauseScene implements Scene {
  readonly el: HTMLElement;
  readonly overlay = true;

  constructor(
    private readonly app: App,
    mode: PlayMode,
  ) {
    const s = strings().pause;
    const tap = (fn: () => void) => () => {
      app.audio.play('ui_tap');
      fn();
    };
    const restartMode: PlayMode = mode.kind === 'level' ? { kind: 'level', id: mode.id, intro: false } : mode;
    const endless = mode.kind === 'endless';
    this.el = h(
      'section',
      { class: 'scene overlay', role: 'dialog', 'aria-modal': 'true', 'aria-label': s.title },
      h(
        'div',
        { class: 'card sign pause-card' },
        h('i', { class: 'sign-rope', 'aria-hidden': 'true' }),
        zerde('idle', 'card-zerde'),
        h('h2', { text: s.title }),
        h('button', { class: 'btn btn-primary', type: 'button', 'data-testid': 'pause-resume', onclick: tap(() => this.back()) }, icon('play'), h('span', { text: s.resume })),
        h(
          'button',
          {
            class: 'btn',
            type: 'button',
            'data-testid': 'pause-restart',
            onclick: tap(() => app.scenes.replace(new PlayScene(app, restartMode))),
          },
          icon('retry'),
          h('span', { text: s.restart }),
        ),
        h(
          'button',
          {
            class: 'btn btn-ghost',
            type: 'button',
            'data-testid': 'pause-exit',
            onclick: tap(() => app.scenes.replace(endless ? new MenuScene(app) : new LevelSelectScene(app))),
          },
          icon(endless ? 'home' : 'map'),
          h('span', { text: endless ? s.menu : s.levels }),
        ),
        h(
          'button',
          { class: 'btn btn-ghost howto-btn', type: 'button', 'data-testid': 'pause-howto', onclick: tap(() => app.scenes.push(new HowToScene(app))) },
          h('span', { class: 'howto-q', 'aria-hidden': 'true', text: '?' }),
          h('span', { text: strings().howTo.button }),
        ),
        feedbackToggles(app),
      ),
    );
  }

  back(): void {
    this.app.scenes.pop();
  }
}
