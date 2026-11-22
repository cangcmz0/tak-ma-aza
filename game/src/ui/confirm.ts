// Small yes/no confirmation overlay (GDD §15): restart / leave a level, exit the app.
// "Vazgeç" (and back) only closes the dialog; "yes" closes it and runs the action.
import { strings } from '../i18n';
import type { App, Scene } from './app';
import { h } from './dom';

export interface ConfirmOptions {
  title: string;
  body?: string;
  yes: string;
  no?: string;
  onYes: () => void;
  /** Extra data-testid suffix (e.g. "restart" → confirm-restart). */
  id?: string;
}

export class ConfirmScene implements Scene {
  readonly el: HTMLElement;
  readonly overlay = true;
  private done = false;

  constructor(
    private readonly app: App,
    o: ConfirmOptions,
  ) {
    const tap = (fn: () => void) => () => {
      if (this.done) return;
      this.done = true;
      app.audio.play('ui_tap');
      fn();
    };
    this.el = h(
      'section',
      {
        class: 'scene overlay confirm-overlay',
        role: 'alertdialog',
        'aria-modal': 'true',
        'aria-label': o.title,
        'data-testid': o.id ? `confirm-${o.id}` : 'confirm',
      },
      h(
        'div',
        { class: 'card confirm-card' },
        h('h2', { text: o.title }),
        o.body ? h('p', { class: 'muted', text: o.body }) : null,
        h('button', {
          class: 'btn btn-primary',
          type: 'button',
          'data-testid': 'confirm-yes',
          text: o.yes,
          onclick: tap(() => {
            this.app.scenes.pop();
            o.onYes();
          }),
        }),
        h('button', {
          class: 'btn btn-ghost',
          type: 'button',
          'data-testid': 'confirm-no',
          text: o.no ?? strings().confirm.no,
          onclick: tap(() => this.app.scenes.pop()),
        }),
      ),
    );
  }

  back(): void {
    if (this.done) return;
    this.done = true;
    this.app.scenes.pop();
  }
}
