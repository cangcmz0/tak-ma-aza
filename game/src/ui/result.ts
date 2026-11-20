import type { Session } from '../game/session';
import { fmt, strings } from '../i18n';
import { nextLevelId } from '../levels/levels';
import type { App, Scene } from './app';
import { h, starText } from './dom';
import { LevelSelectScene } from './levelSelect';
import { PlayScene } from './play';

export class ResultScene implements Scene {
  readonly el: HTMLElement;
  readonly overlay = true;

  constructor(
    private readonly app: App,
    session: Session,
  ) {
    const s = strings().result;
    const won = session.state === 'won';
    const id = session.level.id;
    const next = nextLevelId(id);
    const best = app.save.level(id)?.best ?? session.score;
    const tap = (fn: () => void) => () => {
      app.audio.play('ui_tap');
      fn();
    };
    const reason = session.loseReason === 'no_space' ? s.noSpace : session.loseReason === 'out_of_pieces' ? s.outOfPieces : '';
    this.el = h(
      'section',
      { class: 'scene overlay', role: 'dialog', 'aria-modal': 'true', 'data-testid': won ? 'result-won' : 'result-lost' },
      h(
        'div',
        { class: 'card' },
        h('h2', { text: won ? s.won : s.lost }),
        won ? h('div', { class: 'result-stars', 'aria-label': fmt(s.starsAria, { n: session.stars }), text: starText(session.stars) }) : null,
        !won && reason ? h('p', { class: 'muted', text: reason }) : null,
        h('p', { class: 'result-score', text: fmt(s.score, { n: session.score }) }),
        h('p', { class: 'muted', text: fmt(s.best, { n: best }) }),
        won && next !== undefined
          ? h('button', {
              class: 'btn btn-primary',
              type: 'button',
              'data-testid': 'result-next',
              text: s.next,
              onclick: tap(() => app.scenes.replace(new PlayScene(app, next))),
            })
          : null,
        won && next === undefined ? h('p', { class: 'muted', text: s.allDone }) : null,
        h('button', {
          class: won ? 'btn' : 'btn btn-primary',
          type: 'button',
          'data-testid': 'result-retry',
          text: s.retry,
          onclick: tap(() => app.scenes.replace(new PlayScene(app, id))),
        }),
        h('button', { class: 'btn btn-ghost', type: 'button', text: s.levels, onclick: tap(() => app.scenes.replace(new LevelSelectScene(app))) }),
      ),
    );
  }

  back(): void {
    this.app.scenes.replace(new LevelSelectScene(this.app));
  }
}
