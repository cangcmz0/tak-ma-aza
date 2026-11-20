import { strings } from '../i18n';
import type { App, Scene } from './app';
import { h } from './dom';
import { LevelSelectScene } from './levelSelect';
import { PlayScene } from './play';

export class PauseScene implements Scene {
  readonly el: HTMLElement;
  readonly overlay = true;

  constructor(
    private readonly app: App,
    levelId: number,
  ) {
    const s = strings().pause;
    const tap = (fn: () => void) => () => {
      app.audio.play('ui_tap');
      fn();
    };
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
          text: s.restart,
          onclick: tap(() => app.scenes.replace(new PlayScene(app, levelId))),
        }),
        h('button', { class: 'btn btn-ghost', type: 'button', text: s.levels, onclick: tap(() => app.scenes.replace(new LevelSelectScene(app))) }),
      ),
    );
  }

  back(): void {
    this.app.scenes.pop();
  }
}
