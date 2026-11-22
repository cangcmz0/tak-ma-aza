// Backdrops and the logo: night bazaar skyline (domes, minarets, lit shop arches with
// spice mounds, hanging copper lamps) and the "Kum Akışı" wordmark. All inline SVG.
import { svgEl } from './svg';

const SPICES = ['#e0432f', '#f4b526', '#5dae4b', '#a8449a', '#3d6fd8', '#c27a3e'];

function arcade(): string {
  let s = '';
  const n = 6;
  const w = 400 / n;
  for (let k = 0; k < n; k++) {
    const x = k * w + 8;
    const aw = w - 16;
    const r = aw / 2;
    // Lit arch opening.
    s += `<path d="M${x} 320 V${282} a${r} ${r} 0 0 1 ${aw} 0 V320 Z" fill="#6e3518"/>`;
    s += `<path d="M${x + 4} 320 V${284} a${r - 4} ${r - 4} 0 0 1 ${aw - 8} 0 V320 Z" fill="#b8672c" opacity=".55"/>`;
    // Spice mounds on the counter.
    const c1 = SPICES[k % SPICES.length];
    const c2 = SPICES[(k + 2) % SPICES.length];
    const c3 = SPICES[(k + 4) % SPICES.length];
    s += `<rect x="${x + 2}" y="306" width="${aw - 4}" height="14" fill="#2a170c"/>`;
    s += `<path d="M${x + 5} 307 q7 -14 14 0 Z" fill="${c1}"/><path d="M${x + r - 6} 307 q7 -16 14 0 Z" fill="${c2}"/><path d="M${x + aw - 19} 307 q7 -13 14 0 Z" fill="${c3}"/>`;
    // Scalloped awning on every other shop.
    if (k % 2 === 0) {
      let aws = '';
      const seg = aw / 5;
      for (let j = 0; j < 5; j++) aws += `<path d="M${x + j * seg} 262 h${seg} v5 a${seg / 2} ${seg / 2.4} 0 0 1 -${seg} 0 Z" fill="${j % 2 ? '#e9d3a8' : '#a8442f'}"/>`;
      s += aws;
    }
    // Lamp between arches.
    if (k > 0) {
      const lx = k * w;
      s += `<path d="M${lx} 250 V262" stroke="#3a2416" stroke-width="1.2"/>`;
      s += `<circle cx="${lx}" cy="268" r="22" fill="#f3b53f" opacity=".07"/><circle cx="${lx}" cy="268" r="12" fill="#f3b53f" opacity=".14"/>`;
      s += `<path d="M${lx - 4} 263 h8 l2 4 l-2 6 h-8 l-2 -6 Z" fill="#e8b84a" stroke="#7a4021" stroke-width="1"/>`;
    }
  }
  return s;
}

const SKYLINE = `
<svg class="skyline" viewBox="0 0 400 320" preserveAspectRatio="xMidYMax slice" aria-hidden="true">
  <g fill="#2b1626">
    <rect x="38" y="150" width="6" height="110"/><path d="M38 150 L41 128 L44 150 Z"/><rect x="35.5" y="178" width="11" height="3"/>
    <rect x="356" y="160" width="6" height="100"/><path d="M356 160 L359 138 L362 160 Z"/><rect x="353.5" y="186" width="11" height="3"/>
  </g>
  <g fill="#22111d">
    <rect x="95" y="112" width="9" height="140"/><path d="M95 112 L99.5 80 L104 112 Z"/><rect x="91" y="150" width="17" height="4"/><rect x="92" y="190" width="15" height="3"/>
    <rect x="296" y="112" width="9" height="140"/><path d="M296 112 L300.5 80 L305 112 Z"/><rect x="292" y="150" width="17" height="4"/><rect x="293" y="190" width="15" height="3"/>
    <path d="M138 206 C138 148 262 148 262 206 Z"/><rect x="150" y="200" width="100" height="40"/>
    <path d="M199 150 V132" stroke="#22111d" stroke-width="2.4"/><path d="M196 130 a4 4 0 1 0 6 -3 a3 3 0 1 1 -6 3 Z"/>
    <path d="M108 222 C108 192 162 192 162 222 Z"/><path d="M238 222 C238 192 292 192 292 222 Z"/>
    <path d="M60 236 C60 214 98 214 98 236 Z"/><path d="M302 236 C302 214 340 214 340 236 Z"/>
    <rect x="0" y="230" width="400" height="90"/>
  </g>
  <g fill="#140c0a">
    <rect x="0" y="250" width="400" height="70"/>
    <path d="M18 250 a14 11 0 0 1 28 0 Z M118 250 a14 11 0 0 1 28 0 Z M188 250 a14 11 0 0 1 28 0 Z M254 250 a14 11 0 0 1 28 0 Z M354 250 a14 11 0 0 1 28 0 Z"/>
  </g>
  ${arcade()}
</svg>`;

export function skyline(): SVGSVGElement {
  return svgEl(SKYLINE);
}

/** Crescent moon + a few big stars (small grains of light). */
export function moon(): SVGSVGElement {
  return svgEl(`<svg class="moon" viewBox="0 0 40 40" aria-hidden="true">
    <circle cx="20" cy="20" r="18" fill="#ffe7b0" opacity=".08"/>
    <path d="M24 6 A14 14 0 1 0 34 26 A11 11 0 1 1 24 6 Z" fill="#ffe7b0"/>
  </svg>`);
}

/**
 * Wordmark: chunky gold letters with a dark outline and a copper extrusion, and a tipped
 * spice pouch pouring grains onto the K. textLength keeps the layout identical whatever
 * system font renders it (no font files are bundled: offline WebView).
 */
export function logo(text: string): SVGSVGElement {
  const t = text.replace(/[<>&"]/g, '');
  const grains = [
    [44, 26, '#e0432f'],
    [47, 33, '#f4b526'],
    [43, 39, '#e0432f'],
    [48, 44, '#5dae4b'],
    [45, 50, '#f4b526'],
  ]
    .map(([x, y, c]) => `<rect class="logo-grain" x="${x}" y="${y}" width="3.4" height="3.4" rx=".6" fill="${c}"/>`)
    .join('');
  const txt = (extra: string) =>
    `<text x="166" y="96" text-anchor="middle" textLength="276" lengthAdjust="spacingAndGlyphs" class="logo-text" ${extra}>${t}</text>`;
  return svgEl(`<svg class="logo" viewBox="0 0 320 124" role="img" aria-label="${t}">
    <defs>
      <linearGradient id="logo-gold" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#fff0b8"/><stop offset=".45" stop-color="#ffc94a"/><stop offset="1" stop-color="#e08a1e"/>
      </linearGradient>
    </defs>
    ${txt('fill="#5a2610" stroke="#5a2610" stroke-width="15" stroke-linejoin="round" transform="translate(0 7)"')}
    ${txt('fill="#2b1306" stroke="#2b1306" stroke-width="13" stroke-linejoin="round"')}
    ${txt('fill="url(#logo-gold)"')}
    ${txt('fill="none" stroke="#fff6d8" stroke-width="1" opacity=".55"')}
    <g transform="rotate(-38 40 18)">
      <path d="M30 10 C24 16 25 30 38 30 C51 30 52 16 46 10 Z" fill="#c9a66b" stroke="#3f2716" stroke-width="2"/>
      <path d="M31 10 C32 5 35 3 38 3 C41 3 44 5 45 10 Z" fill="#e0432f" stroke="#3f2716" stroke-width="1.6"/>
      <path d="M29.5 10.5 Q38 13.5 46.5 10.5" fill="none" stroke="#7a5a32" stroke-width="2.4" stroke-linecap="round"/>
    </g>
    ${grains}
  </svg>`);
}
