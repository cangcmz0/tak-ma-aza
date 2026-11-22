// "Nasıl oynanır?" card: the whole rule in three looping mini demos that read without text
// (1) drag a pouch onto the board, (2) it falls and piles up like sand, (3) the same colour
// touching BOTH walls pops. Shown once before level 1 and from the pause menu any time.
import { zerde } from '../art/zerde';
import { svgEl } from '../art/svg';
import { strings } from '../i18n';
import type { App, Scene } from './app';
import { h } from './dom';

/** Save key (stored with the mechanic intro flags). */
export const HOWTO_SEEN = 'howto';

const Y = '#f4b526';
const YL = '#ffd261';
const R = '#e0432f';
const G = '#5dae4b';
const BOARD = '#2a1e17';

const HAND = `<path d="M8 3 C8 1 11 1 11 3 V12 L11.5 8 C11.5 6 14.5 6 14.5 8 V12.5 L15 9.5 C15 7.5 18 7.5 18 9.5 V14 L18.5 11.5 C18.5 9.5 21.5 9.5 21.5 11.5 V18 C21.5 23.5 18 26.5 13.5 26.5 H11.5 C7.5 26.5 5.5 24 3.5 20.5 L1 15.5 C0 13.5 2.5 12 4 13.5 L8 17.5 Z" fill="#fff8ec" stroke="#3b2414" stroke-width="1.4" stroke-linejoin="round"/>`;

function pouch(x: number, y: number, s: number, c: string): string {
  return `<rect x="${x}" y="${y}" width="${s * 2}" height="${s * 2}" rx="${s * 0.35}" fill="${c}" stroke="#3b1a08" stroke-width="1.6"/>
    <path d="M${x + s * 0.7} ${y + 1} l${s * 0.3} ${s * 0.35} l${s * 0.3} -${s * 0.35}" fill="none" stroke="#7a5a32" stroke-width="1.6" stroke-linecap="round"/>`;
}

const DEMO_DRAG = `<svg class="howto-demo demo-drag" viewBox="0 0 120 92" aria-hidden="true">
  <rect x="8" y="2" width="104" height="58" rx="3" fill="${BOARD}" stroke="#c8773f" stroke-width="2.5"/>
  <rect x="2" y="2" width="4" height="58" fill="${YL}" opacity=".5"/><rect x="114" y="2" width="4" height="58" fill="${YL}" opacity=".5"/>
  <rect x="10" y="50" width="100" height="8" fill="${R}" opacity=".9"/>
  <rect x="34" y="63" width="52" height="28" rx="4" fill="#3b2a1f" stroke="#f3b53f" stroke-width="2"/>
  <g class="dd-piece">${pouch(49, 66, 11, Y)}</g>
  <g class="dd-hand" transform="translate(62 80)">${HAND}</g>
</svg>`;

const DEMO_FLOW = `<svg class="howto-demo demo-flow" viewBox="0 0 120 92" aria-hidden="true">
  <rect x="8" y="2" width="104" height="86" rx="3" fill="${BOARD}" stroke="#c8773f" stroke-width="2.5"/>
  <g class="df-block">${pouch(48, 6, 12, G)}</g>
  <g class="df-pile">
    <path d="M18 86 L34 74 L46 66 L60 60 L74 66 L86 74 L102 86 Z" fill="${G}" stroke="#2f6a25" stroke-width="1.5"/>
    <g fill="#86cc73"><rect x="44" y="70" width="3" height="3"/><rect x="58" y="64" width="3" height="3"/><rect x="70" y="72" width="3" height="3"/><rect x="34" y="78" width="3" height="3"/><rect x="82" y="80" width="3" height="3"/></g>
  </g>
  <g class="df-grains" fill="${G}"><rect x="52" y="52" width="4" height="4"/><rect x="64" y="50" width="4" height="4"/><rect x="58" y="46" width="4" height="4"/></g>
</svg>`;

function pathRow(): string {
  let s = '';
  for (let k = 0; k < 9; k++) s += `<rect x="${24 + k * 20}" y="66" width="20" height="20" fill="${k % 2 ? Y : '#eaa91c'}"/>`;
  return s;
}

const DEMO_PATH = `<svg class="howto-demo demo-path" viewBox="0 0 288 112" aria-hidden="true">
  <rect x="20" y="16" width="248" height="74" rx="3" fill="${BOARD}" stroke="#c8773f" stroke-width="3"/>
  <rect class="dp-wall" x="12" y="16" width="8" height="74" rx="2" fill="${YL}"/>
  <rect class="dp-wall" x="268" y="16" width="8" height="74" rx="2" fill="${YL}"/>
  <text x="16" y="108" text-anchor="middle" class="dp-label">SOL</text>
  <text x="272" y="108" text-anchor="middle" class="dp-label">SAĞ</text>
  <rect x="24" y="50" width="240" height="16" fill="${R}" opacity=".85"/>
  <g class="dp-row">${pathRow()}<g class="dp-drop">
    <rect x="204" y="66" width="20" height="20" fill="${Y}"/><rect x="224" y="66" width="20" height="20" fill="#eaa91c"/><rect x="244" y="66" width="20" height="20" fill="${Y}"/>
  </g></g>
  <rect class="dp-flash" x="24" y="64" width="240" height="24" fill="#fff4d6"/>
  <g class="dp-arrow">
    <path d="M30 40 H258" stroke="#fff4d6" stroke-width="5" stroke-linecap="round"/>
    <path d="M22 40 l12 -9 v18 Z M266 40 l-12 -9 v18 Z" fill="#fff4d6"/>
  </g>
  <g class="dp-burst" fill="${YL}">
    <rect x="70" y="58" width="6" height="6"/><rect x="120" y="50" width="7" height="7"/><rect x="170" y="56" width="6" height="6"/><rect x="220" y="52" width="7" height="7"/>
    <rect x="95" y="70" width="5" height="5"/><rect x="145" y="64" width="5" height="5"/><rect x="200" y="68" width="5" height="5"/><rect x="45" y="66" width="5" height="5"/>
  </g>
  <text class="dp-pop" x="144" y="10" text-anchor="middle">PUF!</text>
</svg>`;

export class HowToScene implements Scene {
  readonly el: HTMLElement;
  readonly overlay = true;

  constructor(
    private readonly app: App,
    private readonly onClose?: () => void,
  ) {
    const s = strings().howTo;
    const step = (n: number, demo: string, text: string, cls = '') =>
      h('li', { class: `howto-step ${cls}` }, svgEl(demo), h('p', {}, h('b', { class: 'howto-num', text: String(n) }), h('span', { text })));
    this.el = h(
      'section',
      { class: 'scene overlay', role: 'dialog', 'aria-modal': 'true', 'aria-label': s.title, 'data-testid': 'howto' },
      h(
        'div',
        { class: 'card slip howto-card' },
        h('div', { class: 'howto-head' }, zerde('happy', 'howto-zerde'), h('h2', { text: s.title })),
        h(
          'ol',
          { class: 'howto-steps' },
          step(1, DEMO_DRAG, s.step1),
          step(2, DEMO_FLOW, s.step2),
          step(3, DEMO_PATH, s.step3, 'howto-key'),
        ),
        h('p', { class: 'howto-sub', text: s.step3sub }),
        h('button', {
          class: 'btn btn-primary',
          type: 'button',
          'data-testid': 'howto-close',
          text: s.go,
          onclick: () => {
            app.audio.play('ui_tap');
            this.close();
          },
        }),
      ),
    );
  }

  private close(): void {
    this.app.save.markIntroSeen(HOWTO_SEEN);
    this.app.scenes.pop();
    this.onClose?.();
  }

  back(): void {
    this.close();
  }
}
