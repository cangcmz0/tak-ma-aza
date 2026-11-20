import { fmt, strings } from '../i18n';
import { LEVELS } from '../levels/levels';
import type { App, Scene } from './app';
import { h, starText } from './dom';
import { MenuScene } from './menu';
import { PlayScene } from './play';

export class LevelSelectScene implements Scene {
  readonly el: HTMLElement;

  constructor(private readonly app: App) {
    const s = strings();
    const ids = LEVELS.map((l) => l.id);
    const unlockAll = app.debug && new URLSearchParams(location.search).has('unlockAll');
    const grid = h('div', { class: 'level-grid' });
    for (const lvl of LEVELS) {
      const prog = app.save.level(lvl.id);
      const unlocked = unlockAll || app.save.isUnlocked(lvl.id, ids);
      const stars = prog?.stars ?? 0;
      grid.append(
        h(
          'button',
          {
            class: `level-btn${unlocked ? '' : ' locked'}${prog?.completed ? ' done' : ''}`,
            type: 'button',
            disabled: !unlocked,
            'data-testid': `level-${lvl.id}`,
            'aria-label': unlocked ? fmt(s.levelSelect.levelAria, { n: lvl.id, stars }) : `${lvl.id} – ${s.levelSelect.locked}`,
            onclick: () => {
              app.audio.play('ui_tap');
              app.scenes.replace(new PlayScene(app, lvl.id));
            },
          },
          h('span', { class: 'level-num', text: String(lvl.id) }),
          h('span', { class: 'level-stars', text: unlocked ? starText(stars) : '🔒' }),
        ),
      );
    }
    this.el = h(
      'section',
      { class: 'scene level-select' },
      h(
        'header',
        { class: 'topbar' },
        h('button', { class: 'btn btn-icon', type: 'button', 'aria-label': s.levelSelect.back, text: '‹', onclick: () => this.back() }),
        h('h2', { text: s.levelSelect.title }),
        h('span', { class: 'topbar-spacer' }),
      ),
      grid,
    );
  }

  back(): void {
    this.app.audio.play('ui_tap');
    this.app.scenes.replace(new MenuScene(this.app));
  }
}
