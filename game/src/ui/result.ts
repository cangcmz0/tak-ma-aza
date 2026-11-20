import type { Session } from '../game/session';
import { fmt, strings } from '../i18n';
import { nextLevelId } from '../levels/levels';
import type { App, Scene } from './app';
import { h, starText } from './dom';
import { LevelSelectScene } from './levelSelect';
import { MenuScene } from './menu';
import { PlayScene, type PlayMode } from './play';

export interface ResultOptions {
  mode: PlayMode;
  /** Endless: the run set a new high score. */
  newBest?: boolean;
}

export class ResultScene implements Scene {
  readonly el: HTMLElement;
  readonly overlay = true;
  private readonly endless: boolean;

  constructor(
    private readonly app: App,
    session: Session,
    opts: ResultOptions = { mode: { kind: 'level', id: session.level.id } },
  ) {
    this.endless = opts.mode.kind === 'endless';
    const tap = (fn: () => void) => () => {
      app.audio.play('ui_tap');
      fn();
    };
    this.el = this.endless ? this.endlessCard(session, !!opts.newBest, tap) : this.levelCard(session, tap);
  }

  private levelCard(session: Session, tap: (fn: () => void) => () => void): HTMLElement {
    const app = this.app;
    const s = strings().result;
    const won = session.state === 'won';
    const id = session.level.id;
    const next = nextLevelId(id);
    const best = app.save.level(id)?.best ?? session.score;
    const reason = session.loseReason === 'no_space' ? s.noSpace : session.loseReason === 'out_of_pieces' ? s.outOfPieces : '';
    return h(
      'section',
      { class: 'scene overlay', role: 'dialog', 'aria-modal': 'true', 'data-testid': won ? 'result-won' : 'result-lost' },
      h(
        'div',
        { class: 'card' },
        h('h2', { text: won ? s.won : s.lost }),
        won ? h('div', { class: 'result-stars', 'aria-label': fmt(s.starsAria, { n: session.stars }), text: starText(session.stars) }) : null,
        !won && reason ? h('p', { class: 'muted', text: reason }) : null,
        h('p', { class: 'result-score', text: fmt(s.score, { n: session.score }) }),
        won && session.endBonus > 0 ? h('p', { class: 'muted', text: fmt(s.bonus, { n: session.endBonus }) }) : null,
        h('p', { class: 'muted', text: fmt(s.best, { n: best }) }),
        won && next !== undefined
          ? h('button', {
              class: 'btn btn-primary',
              type: 'button',
              'data-testid': 'result-next',
              text: s.next,
              onclick: tap(() => app.scenes.replace(new PlayScene(app, { kind: 'level', id: next }))),
            })
          : null,
        won && next === undefined ? h('p', { class: 'muted', text: s.allDone }) : null,
        h('button', {
          class: won ? 'btn' : 'btn btn-primary',
          type: 'button',
          'data-testid': 'result-retry',
          text: s.retry,
          onclick: tap(() => app.scenes.replace(new PlayScene(app, { kind: 'level', id, intro: false }))),
        }),
        h('button', { class: 'btn btn-ghost', type: 'button', text: s.levels, onclick: tap(() => app.scenes.replace(new LevelSelectScene(app))) }),
      ),
    );
  }

  private endlessCard(session: Session, newBest: boolean, tap: (fn: () => void) => () => void): HTMLElement {
    const app = this.app;
    const s = strings();
    return h(
      'section',
      { class: 'scene overlay', role: 'dialog', 'aria-modal': 'true', 'data-testid': 'result-endless' },
      h(
        'div',
        { class: 'card' },
        h('h2', { text: s.endless.over }),
        newBest ? h('p', { class: 'new-best', 'data-testid': 'new-best', text: s.endless.newBest }) : null,
        h('p', { class: 'result-score', text: fmt(s.result.score, { n: session.score }) }),
        h('p', { class: 'muted', text: fmt(s.result.best, { n: app.save.endlessBest }) }),
        h('button', {
          class: 'btn btn-primary',
          type: 'button',
          'data-testid': 'result-retry',
          text: s.endless.again,
          onclick: tap(() => app.scenes.replace(new PlayScene(app, { kind: 'endless' }))),
        }),
        h('button', { class: 'btn btn-ghost', type: 'button', text: s.endless.menu, onclick: tap(() => app.scenes.replace(new MenuScene(app))) }),
      ),
    );
  }

  back(): void {
    this.app.scenes.replace(this.endless ? new MenuScene(this.app) : new LevelSelectScene(this.app));
  }
}
