import type { SessionEndInfo } from '../game/meta';
import type { Session } from '../game/session';
import { fmt, strings } from '../i18n';
import { nextLevelId } from '../levels/levels';
import type { App, Scene } from './app';
import { continueOfferEl } from './continueOffer';
import { h } from './dom';
import { LevelSelectScene } from './levelSelect';
import { MenuScene } from './menu';
import { PlayScene, type PlayMode } from './play';
import { leaveResult, rewardPanelEl } from './rewardPanel';
import { confetti, orderProgress, resultStars, resultZerde } from './resultArt';

export interface ResultOptions {
  mode: PlayMode;
  /** Endless: the run set a new high score. */
  newBest?: boolean;
  /** Economy: gold paid out + interstitial context (ui/rewardPanel.ts). */
  endInfo?: SessionEndInfo;
  /** Economy: resume the lost attempt after a paid continue (ui/continueOffer.ts). */
  onContinue?: () => void;
}

export class ResultScene implements Scene {
  readonly el: HTMLElement;
  readonly overlay = true;
  private readonly endless: boolean;
  private readonly endInfo: SessionEndInfo | undefined;

  constructor(
    private readonly app: App,
    session: Session,
    opts: ResultOptions = { mode: { kind: 'level', id: session.level.id } },
  ) {
    this.endless = opts.mode.kind === 'endless';
    this.endInfo = opts.endInfo;
    const tap = (fn: () => void) => () => {
      app.audio.play('ui_tap');
      fn();
    };
    this.el = this.endless ? this.endlessCard(session, !!opts.newBest, tap) : this.levelCard(session, tap, opts.onContinue);
  }

  private levelCard(session: Session, tap: (fn: () => void) => () => void, onContinue?: () => void): HTMLElement {
    const app = this.app;
    const s = strings().result;
    const won = session.state === 'won';
    const id = session.level.id;
    const next = nextLevelId(id);
    const best = app.save.level(id)?.best ?? session.score;
    const reason = session.loseReason === 'no_space' ? s.noSpace : session.loseReason === 'out_of_pieces' ? s.outOfPieces : '';
    const offer = !won && onContinue ? continueOfferEl(app, session, onContinue) : null;
    // "Tekrar dene" is the primary action only when nothing else is (won → next level, lost → continue).
    const retryPrimary = !won && !offer?.querySelector('.btn-primary');
    return h(
      'section',
      { class: `scene overlay result-overlay ${won ? 'won' : 'lost'}`, role: 'dialog', 'aria-modal': 'true', 'data-testid': won ? 'result-won' : 'result-lost' },
      won ? confetti(session.level.colors) : null,
      h(
        'div',
        { class: `card result-card ${won ? 'won' : 'lost'}` },
        resultZerde(won),
        h('h2', { class: 'result-title', text: won ? s.won : session.loseReason === 'no_space' ? s.lostSpace : session.loseReason === 'out_of_pieces' ? s.lostPieces : s.lost }),
        won ? resultStars(session.stars) : null,
        // The headline already names the reason; repeat it only when there is no specific headline.
        !won && reason && !session.loseReason ? h('p', { class: 'muted', text: reason }) : null,
        !won ? orderProgress(session) : null,
        h('p', { class: 'result-score' }, fmt(s.score, { n: session.score }), h('small', { class: 'result-best', text: fmt(s.best, { n: best }) })),
        won && session.endBonus > 0 ? h('p', { class: 'muted', text: fmt(s.bonus, { n: session.endBonus }) }) : null,
        won ? rewardPanelEl(app, this.endInfo) : null,
        offer,
        won && next === undefined ? h('p', { class: 'muted', text: s.allDone }) : null,
        // One primary action per card (QA-009): next level when won; on a loss the continue offer
        // is primary when there is one, otherwise "Tekrar dene". Secondary actions share a row.
        h(
          'div',
          { class: 'result-actions' },
          won && next !== undefined
            ? h('button', {
                class: 'btn btn-primary',
                type: 'button',
                'data-testid': 'result-next',
                text: s.next,
                onclick: tap(() => leaveResult(app, this.endInfo, true, () => app.scenes.replace(new PlayScene(app, { kind: 'level', id: next })))),
              })
            : null,
          h(
            'div',
            { class: `result-actions-row${retryPrimary ? ' solo-primary' : ''}` },
            h('button', {
              class: retryPrimary ? 'btn btn-primary' : 'btn',
              type: 'button',
              'data-testid': 'result-retry',
              text: s.retry,
              onclick: tap(() => leaveResult(app, this.endInfo, false, () => app.scenes.replace(new PlayScene(app, { kind: 'level', id, intro: false })))),
            }),
            h('button', {
              class: 'btn btn-ghost',
              type: 'button',
              'data-testid': 'result-levels',
              text: s.levels,
              onclick: tap(() => leaveResult(app, this.endInfo, true, () => app.scenes.replace(new LevelSelectScene(app)))),
            }),
          ),
        ),
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
        { class: 'card result-card' },
        resultZerde(newBest),
        h('h2', { class: 'result-title', text: s.endless.over }),
        newBest ? h('p', { class: 'new-best', 'data-testid': 'new-best', text: s.endless.newBest }) : null,
        h('p', { class: 'result-score' }, fmt(s.result.score, { n: session.score }), h('small', { class: 'result-best', text: fmt(s.result.best, { n: app.save.endlessBest }) })),
        rewardPanelEl(app, this.endInfo),
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
    if (this.endless) this.app.scenes.replace(new MenuScene(this.app));
    else leaveResult(this.app, this.endInfo, true, () => this.app.scenes.replace(new LevelSelectScene(this.app)));
  }
}
