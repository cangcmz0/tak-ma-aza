// Zerde, the bazaar cat (GDD §3.3): an original orange tabby drawn as one inline SVG.
// All faces live in the same SVG; `data-pose` picks one through CSS (see .zerde rules in
// main.css), so a pose change is an attribute flip, not a rebuild. Idle blink, tail sway,
// win hop and the pepper sneeze are CSS animations (disabled under prefers-reduced-motion).
import { svgEl } from './svg';

export type ZerdePose = 'idle' | 'happy' | 'surprised' | 'sneeze' | 'sad';

const FUR = '#f0a040';
const FUR_DK = '#c9661c';
const CREAM = '#ffe3b6';
const PINK = '#f7b2a6';
const INK = '#2b1a10';
const LINE = '#5a2e17';

const MARKUP = `
<svg class="zerde" viewBox="0 0 200 212" role="img" aria-label="Zerde">
  <g class="z-tail">
    <path d="M132 186 C176 190 194 150 172 120" fill="none" stroke="${FUR}" stroke-width="17" stroke-linecap="round"/>
    <path d="M132 186 C176 190 194 150 172 120" fill="none" stroke="${FUR_DK}" stroke-width="17" stroke-linecap="butt" stroke-dasharray="7 13" opacity=".7"/>
  </g>
  <g class="z-body">
    <path d="M56 204 C48 162 64 126 100 126 C136 126 152 162 144 204 Z" fill="${FUR}"/>
    <path d="M62 160 q10 -5 16 3 M60 176 q10 -5 15 3 M138 160 q-10 -5 -16 3 M140 176 q-10 -5 -15 3" fill="none" stroke="${FUR_DK}" stroke-width="4" stroke-linecap="round"/>
    <ellipse cx="100" cy="176" rx="27" ry="27" fill="${CREAM}"/>
    <ellipse cx="80" cy="203" rx="16" ry="9" fill="${CREAM}"/>
    <ellipse cx="120" cy="203" rx="16" ry="9" fill="${CREAM}"/>
    <path d="M76 199 v6 M84 199 v6 M116 199 v6 M124 199 v6" stroke="#e2b98a" stroke-width="1.6" stroke-linecap="round"/>
    <path d="M70 128 Q100 144 130 128" fill="none" stroke="#7a5a32" stroke-width="3.2" stroke-linecap="round"/>
    <path d="M89 141 Q85 161 100 162 Q115 161 111 141 Q100 136 89 141 Z" fill="#8a5a36"/>
    <path d="M92 146 q8 3 16 0" fill="none" stroke="#6b4426" stroke-width="1.6"/>
    <circle cx="100" cy="138" r="4.6" fill="#e0432f"/>
    <circle cx="97" cy="136.5" r="1.4" fill="#f2705c"/>
    <path d="M93 140 L100 143 L107 140" fill="none" stroke="#d8bb84" stroke-width="2.4" stroke-linecap="round"/>
  </g>
  <g class="z-head">
    <g class="z-ear z-ear-l">
      <path d="M54 62 L46 14 L90 44 Z" fill="${FUR}"/>
      <path d="M58 54 L54 28 L78 46 Z" fill="${PINK}"/>
    </g>
    <g class="z-ear z-ear-r">
      <path d="M146 62 L154 14 L110 44 Z" fill="${FUR}"/>
      <path d="M142 54 L146 28 L122 46 Z" fill="${PINK}"/>
    </g>
    <ellipse cx="100" cy="88" rx="59" ry="50" fill="${FUR}"/>
    <path d="M42 92 l-9 7 l11 1 Z M158 92 l9 7 l-11 1 Z" fill="${FUR}"/>
    <path d="M100 40 v15 M86 43 q3 8 -1 14 M114 43 q-3 8 1 14 M43 82 h12 M45 93 h9 M157 82 h-12 M155 93 h-9" fill="none" stroke="${FUR_DK}" stroke-width="5" stroke-linecap="round"/>
    <ellipse cx="100" cy="109" rx="23" ry="15" fill="${CREAM}"/>
    <ellipse cx="69" cy="106" rx="8" ry="5" fill="#f48a7a" opacity=".55"/>
    <ellipse cx="131" cy="106" rx="8" ry="5" fill="#f48a7a" opacity=".55"/>
    <g class="f f-idle">
      <g class="z-blink">
        <ellipse cx="78" cy="88" rx="8.5" ry="10.5" fill="${INK}"/>
        <ellipse cx="122" cy="88" rx="8.5" ry="10.5" fill="${INK}"/>
        <circle cx="81" cy="84" r="3.2" fill="#fff"/><circle cx="125" cy="84" r="3.2" fill="#fff"/>
        <circle cx="76" cy="92" r="1.3" fill="#fff"/><circle cx="120" cy="92" r="1.3" fill="#fff"/>
      </g>
      <path d="M100 106 v3 M90 109 q5 6 10 0 q5 6 10 0" fill="none" stroke="${LINE}" stroke-width="2.4" stroke-linecap="round"/>
    </g>
    <g class="f f-happy">
      <path d="M69 91 q9 -12 18 0 M113 91 q9 -12 18 0" fill="none" stroke="${INK}" stroke-width="4.2" stroke-linecap="round"/>
      <path d="M89 109 q11 14 22 0 Z" fill="#7a2a1a"/>
      <path d="M95 114 q5 5 10 0 q-5 -3 -10 0 Z" fill="#f0786a"/>
    </g>
    <g class="f f-surprised">
      <circle cx="78" cy="88" r="10.5" fill="${INK}"/><circle cx="122" cy="88" r="10.5" fill="${INK}"/>
      <circle cx="82" cy="84" r="4" fill="#fff"/><circle cx="126" cy="84" r="4" fill="#fff"/>
      <path d="M68 70 q9 -6 18 -1 M114 69 q9 -5 18 1" fill="none" stroke="${FUR_DK}" stroke-width="3.4" stroke-linecap="round"/>
      <ellipse cx="100" cy="116" rx="4.6" ry="5.6" fill="${LINE}"/>
    </g>
    <g class="f f-sneeze">
      <path d="M69 81 l13 7 l-13 7 M131 81 l-13 7 l13 7" fill="none" stroke="${INK}" stroke-width="4.2" stroke-linecap="round" stroke-linejoin="round"/>
      <ellipse cx="100" cy="116" rx="10" ry="7.5" fill="#7a2a1a"/>
      <path d="M66 70 l14 6 M134 70 l-14 6" stroke="${FUR_DK}" stroke-width="3.4" stroke-linecap="round"/>
    </g>
    <g class="f f-sad">
      <ellipse cx="78" cy="91" rx="8" ry="7" fill="${INK}"/><ellipse cx="122" cy="91" rx="8" ry="7" fill="${INK}"/>
      <path d="M68 84 h20 v-8 h-20 Z M112 84 h20 v-8 h-20 Z" fill="${FUR}"/>
      <circle cx="80" cy="90" r="2" fill="#fff"/><circle cx="124" cy="90" r="2" fill="#fff"/>
      <path d="M67 80 l18 -4 M133 80 l-18 -4" stroke="${FUR_DK}" stroke-width="3.4" stroke-linecap="round"/>
      <path d="M92 118 q8 -6 16 0" fill="none" stroke="${LINE}" stroke-width="2.4" stroke-linecap="round"/>
    </g>
    <path d="M95 101 h10 l-5 5.5 Z" fill="#e7837a"/>
    <path d="M74 108 L44 102 M74 112 L42 114 M75 116 L47 125 M126 108 L156 102 M126 112 L158 114 M125 116 L153 125" stroke="#fff3df" stroke-width="1.6" stroke-linecap="round" opacity=".85"/>
  </g>
  <g class="f f-sneeze z-puff">
    <circle cx="152" cy="126" r="15" fill="#e0432f" opacity=".42"/>
    <circle cx="170" cy="112" r="11" fill="#f2705c" opacity=".38"/>
    <circle cx="166" cy="138" r="10" fill="#b83322" opacity=".35"/>
    <circle cx="184" cy="126" r="7" fill="#e0432f" opacity=".3"/>
    <circle cx="140" cy="118" r="2.4" fill="#b83322"/><circle cx="178" cy="100" r="2" fill="#e0432f"/>
    <circle cx="188" cy="140" r="2.2" fill="#b83322"/><circle cx="158" cy="150" r="1.8" fill="#e0432f"/>
  </g>
</svg>`;

export function zerde(pose: ZerdePose = 'idle', cls = ''): SVGSVGElement {
  const el = svgEl(MARKUP);
  el.dataset.pose = pose;
  if (cls) el.classList.add(...cls.split(' ').filter(Boolean));
  return el;
}

export function setZerdePose(el: SVGSVGElement, pose: ZerdePose): void {
  el.dataset.pose = pose;
}
