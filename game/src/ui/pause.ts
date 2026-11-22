import { icon } from '../art/icons';
import { zerde } from '../art/zerde';
import { feedbackToggles } from '../fx/settingsToggle';
import { strings } from '../i18n';
import type { App, Scene } from './app';
import { ConfirmScene } from './confirm';
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
    const c = strings().confirm;
    // An abandoned level attempt still counts, so the next try deals a new sequence (QA-004).
    const abandon = () => {
      if (mode.kind === 'level') app.save.recordAbandon(mode.id);
    };
    // Restart / leave lose the attempt's progress: ask first (GDD §15, QA-003).
    const restart = () =>
      app.scenes.push(
        new ConfirmScene(app, {
          id: 'restart',
          title: c.restartTitle,
          body: c.progressLost,
          yes: c.restartYes,
          onYes: () => {
            abandon();
            app.scenes.replace(new PlayScene(app, restartMode));
          },
        }),
      );
    const leave = () =>
      app.scenes.push(
        new ConfirmScene(app, {
          id: 'leave',
          title: endless ? c.leaveEndlessTitle : c.leaveTitle,
          body: c.progressLost,
          yes: c.leaveYes,
          onYes: () => {
            abandon();
            app.scenes.replace(endless ? new MenuScene(app) : new LevelSelectScene(app));
          },
        }),
      );
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
            onclick: tap(restart),
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
            onclick: tap(leave),
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
