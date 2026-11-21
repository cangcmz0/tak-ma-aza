// Level select as a bazaar street map (GDD §9.1): a cobbled road snakes up from the
// bottom (level 1) past shop-sign nodes; every 10 levels an arch marks a new region
// (Biber Sokağı, Sumak Hanı, Zerdeçal Çarşısı …) with its own spice tint and awnings.
// Completed nodes show their stars, the current node pulses with Zerde sitting beside
// it, region finals are big nodes with a chest.
import { CHEST_SVG, icon } from '../art/icons';
import { svgEl, iconEl } from '../art/svg';
import { zerde } from '../art/zerde';
import { fmt, strings } from '../i18n';
import { LEVELS } from '../levels/levels';
import type { App, Scene } from './app';
import { h } from './dom';
import { MenuScene } from './menu';
import { PlayScene } from './play';

const STEP = 104;
const GATE = 150;
const PAD_TOP = 90;
const PAD_BOTTOM = 40;
const PER_REGION = 10;
/** Region tint (spice of the region name) and awning stripe colours. */
const REGION_TINT = ['#e0432f', '#a8449a', '#f4b526', '#3d6fd8', '#c27a3e'];

function nodeX(i: number): number {
  // Percent of the street width; a gentle snake.
  return 50 + Math.sin(i * 0.82 + 0.4) * 27;
}

export class LevelSelectScene implements Scene {
  readonly el: HTMLElement;
  private readonly scroller: HTMLElement;
  private focusY = 0;

  constructor(private readonly app: App) {
    const s = strings();
    const ids = LEVELS.map((l) => l.id);
    const unlockAll = app.debug && new URLSearchParams(location.search).has('unlockAll');
    const current = app.save.currentLevel(ids);
    const n = LEVELS.length;
    const regions = Math.max(1, Math.ceil(n / PER_REGION));
    const height = PAD_TOP + PAD_BOTTOM + (n - 1) * STEP + regions * GATE + 40;
    const yOf = (k: number) => height - PAD_BOTTOM - GATE - k * STEP - Math.floor(k / PER_REGION) * GATE;

    const street = h('div', { class: 'map-street', style: `height:${height}px` });

    // Region bands, facades and gates.
    for (let r = 0; r < regions; r++) {
      const first = r * PER_REGION;
      const last = Math.min(n - 1, first + PER_REGION - 1);
      const bottom = yOf(first) + GATE;
      const top = r === regions - 1 ? 0 : yOf(last) - STEP / 2;
      const tint = REGION_TINT[r % REGION_TINT.length];
      const band = h('div', { class: 'map-region', style: `top:${top}px;height:${bottom - top}px;--region:${tint}` });
      // Shop facades along both edges.
      for (let y = 40, k = 0; y < bottom - top - 120; y += 170, k++) {
        const side = k % 2 ? 'right' : 'left';
        band.append(
          h('div', { class: `shop shop-${side}`, style: `top:${y}px`, 'aria-hidden': 'true' }, h('i', { class: 'shop-awning' }), h('i', { class: 'shop-door' })),
        );
      }
      street.append(band);
      const name = s.levelSelect.regions[r] ?? fmt(s.levelSelect.regionLabel, { n: r + 1 });
      street.append(
        h(
          'div',
          { class: 'region-gate', style: `top:${yOf(first) + 62}px;--region:${tint}`, 'data-testid': `region-${r + 1}` },
          svgEl(`<svg class="gate-arch" viewBox="0 0 390 96" preserveAspectRatio="none" aria-hidden="true">
            <path d="M0 96 V34 H120 C130 8 170 0 195 0 C220 0 260 8 270 34 H390 V96 H350 V50 H282 C276 76 236 70 195 70 C154 70 114 76 108 50 H40 V96 Z" fill="#3f2716"/>
            <path d="M0 34 H120 C130 8 170 0 195 0 C220 0 260 8 270 34 H390" fill="none" stroke="var(--copper)" stroke-width="3"/>
            <path d="M108 50 C114 76 154 70 195 70 C236 70 276 76 282 50" fill="none" stroke="var(--region)" stroke-width="4" opacity=".8"/>
          </svg>`),
          h('div', { class: 'gate-sign' }, h('small', { text: fmt(s.levelSelect.regionLabel, { n: r + 1 }) }), h('b', { text: name })),
        ),
      );
    }

    // Road.
    let d = '';
    for (let k = 0; k < n; k++) {
      const x = nodeX(k);
      const y = yOf(k);
      if (k === 0) d += `M${x} ${y + GATE * 0.6} L${x} ${y}`;
      else {
        const px = nodeX(k - 1);
        const py = yOf(k - 1);
        const my = (py + y) / 2;
        d += ` C${px} ${my} ${x} ${my} ${x} ${y}`;
      }
    }
    if (n) d += ` L${nodeX(n - 1)} ${yOf(n - 1) - 60}`;
    street.insertBefore(
      svgEl(`<svg class="map-road" viewBox="0 0 100 ${height}" preserveAspectRatio="none" aria-hidden="true">
        <path d="${d}" fill="none" stroke="#120b08" stroke-width="34" stroke-linecap="round" vector-effect="non-scaling-stroke"/>
        <path d="${d}" fill="none" stroke="#5b4334" stroke-width="28" stroke-linecap="round" vector-effect="non-scaling-stroke"/>
        <path d="${d}" fill="none" stroke="#7a604c" stroke-width="18" stroke-linecap="round" stroke-dasharray="7 9" vector-effect="non-scaling-stroke"/>
      </svg>`),
      street.querySelector('.region-gate'),
    );

    let totalStars = 0;
    LEVELS.forEach((lvl, k) => {
      const prog = app.save.level(lvl.id);
      const unlocked = unlockAll || app.save.isUnlocked(lvl.id, ids);
      const stars = prog?.stars ?? 0;
      totalStars += stars;
      const boss = (k + 1) % PER_REGION === 0;
      const isCurrent = lvl.id === current;
      const x = nodeX(k);
      const y = yOf(k);
      const tint = REGION_TINT[Math.floor(k / PER_REGION) % REGION_TINT.length];
      const starRow = h('span', { class: 'node-stars', 'aria-hidden': 'true' });
      for (let j = 0; j < 3; j++) starRow.append(icon('star', `ico${j < stars ? ' on' : ''}`));
      const btn = h(
        'button',
        {
          class: `level-btn${unlocked ? '' : ' locked'}${prog?.completed ? ' done' : ''}${boss ? ' boss' : ''}${isCurrent ? ' current' : ''}`,
          type: 'button',
          disabled: !unlocked,
          style: `left:${x}%;top:${y}px;--region:${tint}`,
          'data-testid': `level-${lvl.id}`,
          'aria-label': unlocked ? fmt(s.levelSelect.levelAria, { n: lvl.id, stars }) : `${lvl.id} – ${s.levelSelect.locked}`,
          onclick: () => {
            app.audio.play('ui_tap');
            app.scenes.replace(new PlayScene(app, lvl.id));
          },
        },
        h('span', { class: 'level-num', text: String(lvl.id) }),
        unlocked ? null : icon('lock', 'ico node-lock'),
        prog?.completed ? starRow : null,
        boss ? iconEl(CHEST_SVG, 'node-chest') : null,
      );
      street.append(btn);
      if (isCurrent) {
        this.focusY = y;
        const cat = h('div', { class: `map-zerde ${x > 50 ? 'at-left' : 'at-right'}`, style: `left:${x}%;top:${y}px`, 'aria-hidden': 'true' }, zerde('idle'));
        street.append(cat);
      }
    });

    this.scroller = h('div', { class: 'map-scroll', 'data-testid': 'map' }, street);
    this.el = h(
      'section',
      { class: 'scene level-select' },
      h(
        'header',
        { class: 'topbar' },
        h('button', { class: 'btn btn-icon', type: 'button', 'aria-label': s.levelSelect.back, onclick: () => this.back() }, icon('back')),
        h('h2', { text: s.levelSelect.mapTitle }),
        h('span', { class: 'star-total', 'aria-label': fmt(s.levelSelect.starsAria, { n: totalStars }) }, icon('star'), h('b', { text: String(totalStars) })),
      ),
      this.scroller,
    );
  }

  enter(): void {
    // Centre the current shop (or the start of the street) on screen.
    requestAnimationFrame(() => {
      const hgt = this.scroller.clientHeight;
      this.scroller.scrollTop = this.focusY ? this.focusY - hgt * 0.55 : this.scroller.scrollHeight;
    });
  }

  back(): void {
    this.app.audio.play('ui_tap');
    this.app.scenes.replace(new MenuScene(this.app));
  }
}
