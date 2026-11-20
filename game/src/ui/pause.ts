import { strings } from '../i18n';
import type { App, Scene } from './app';
import { h } from './dom';
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
        { class: 'card' },
        h('h2', { text: s.title }),
        h('button', { class: 'btn btn-primary', type: 'button', 'data-testid': 'pause-resume', text: s.resume, onclick: tap(() => this.back()) }),
        h('button', {
          class: 'btn',
          type: 'button',
          'data-testid': 'pause-restart',
          text: s.restart,
          onclick: tap(() => app.scenes.replace(new PlayScene(app, restartMode))),
        }),
        h('button', {
          class: 'btn btn-ghost',
          type: 'button',
          'data-testid': 'pause-exit',
          text: endless ? s.menu : s.levels,
          onclick: tap(() => app.scenes.replace(endless ? new MenuScene(app) : new LevelSelectScene(app))),
        }),
      ),
    );
  }

  back(): void {
    this.app.scenes.pop();
  }
}
