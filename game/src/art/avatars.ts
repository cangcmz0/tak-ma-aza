// Customer portraits for order cards (GDD §3.3): Ayşe Teyze, Mehmet Amca, Aşçı Selim,
// Gezgin Anna. Flat vector busts in a 64×64 box; the round crop comes from CSS (.avatar).
import { svgEl } from './svg';

const PORTRAITS: Record<string, { bg: string; art: string }> = {
  ayse: {
    bg: '#8e3b2a',
    art: `
      <path d="M10 64 C12 48 22 44 32 44 C42 44 52 48 54 64Z" fill="#5f7f34"/>
      <path d="M14 34 C12 14 22 8 32 8 C42 8 52 14 50 34 C50 44 42 50 32 50 C22 50 14 44 14 34Z" fill="#d8543c"/>
      <ellipse cx="32" cy="31" rx="12" ry="13.5" fill="#f1c7a0"/>
      <path d="M19 27 C20 16 26 13 32 13 C38 13 44 16 45 27 C41 20.5 37 19.5 32 19.5 C27 19.5 23 20.5 19 27Z" fill="#d8543c"/>
      <g fill="#ffe0c8" opacity=".75"><circle cx="24" cy="18" r="1.2"/><circle cx="32" cy="15" r="1.2"/><circle cx="40" cy="18" r="1.2"/><circle cx="18" cy="38" r="1.2"/><circle cx="46" cy="38" r="1.2"/><circle cx="28" cy="10.5" r="1"/><circle cx="36" cy="10.5" r="1"/></g>
      <path d="M27 45 L32 49 L37 45 L34 55 L30 55 Z" fill="#b8402c"/>
      <circle cx="26.8" cy="31" r="4.2" fill="rgba(255,255,255,.18)" stroke="#6b4426" stroke-width="1.3"/>
      <circle cx="37.2" cy="31" r="4.2" fill="rgba(255,255,255,.18)" stroke="#6b4426" stroke-width="1.3"/>
      <path d="M31 31 h2" stroke="#6b4426" stroke-width="1.3"/>
      <circle cx="26.8" cy="31.4" r="1.4" fill="#3b2414"/><circle cx="37.2" cy="31.4" r="1.4" fill="#3b2414"/>
      <circle cx="23" cy="37" r="2.4" fill="#ef8c78" opacity=".6"/><circle cx="41" cy="37" r="2.4" fill="#ef8c78" opacity=".6"/>
      <path d="M28 38.5 q4 3.2 8 0" fill="none" stroke="#8a3a24" stroke-width="1.5" stroke-linecap="round"/>`,
  },
  mehmet: {
    bg: '#34508a',
    art: `
      <path d="M8 64 C10 48 22 45 32 45 C42 45 54 48 56 64Z" fill="#5a3b28"/>
      <path d="M26 45 L32 52 L38 45Z" fill="#f2ead8"/>
      <circle cx="19" cy="32" r="3.5" fill="#d9a77e"/><circle cx="45" cy="32" r="3.5" fill="#d9a77e"/>
      <ellipse cx="32" cy="31" rx="13" ry="14" fill="#e3b58c"/>
      <path d="M19 30 C18 24 20 22 22 22 L22 32Z M45 30 C46 24 44 22 42 22 L42 32Z" fill="#cfcac2"/>
      <path d="M17 24 C17 13 25 10 33 10 C42 10 48 14 48 22 L50 24 C46 26.5 21 26.5 17 24Z" fill="#4a3a2e"/>
      <path d="M15 25 Q32 30 51 23 L51 25.5 Q32 33 15 27.5Z" fill="#2f241c"/>
      <path d="M24 29 h5 M35 29 h5" stroke="#bdb6aa" stroke-width="2" stroke-linecap="round"/>
      <circle cx="26.5" cy="32" r="1.4" fill="#2b1a10"/><circle cx="37.5" cy="32" r="1.4" fill="#2b1a10"/>
      <ellipse cx="32" cy="35" rx="2.8" ry="2.2" fill="#d39a72"/>
      <path d="M22 39.5 C25 35 29.5 36 32 38 C34.5 36 39 35 42 39.5 C38.5 42 34.5 41 32 40 C29.5 41 25.5 42 22 39.5Z" fill="#e4e0d8"/>`,
  },
  selim: {
    bg: '#2f6d48',
    art: `
      <path d="M8 64 C10 49 22 45 32 45 C42 45 54 49 56 64Z" fill="#f4efe6"/>
      <circle cx="29" cy="56" r="1.2" fill="#c9bfae"/><circle cx="35" cy="56" r="1.2" fill="#c9bfae"/><circle cx="29" cy="61" r="1.2" fill="#c9bfae"/><circle cx="35" cy="61" r="1.2" fill="#c9bfae"/>
      <path d="M25 45 L32 52.5 L39 45Z" fill="#e0432f"/>
      <ellipse cx="32" cy="34" rx="12" ry="13" fill="#d9a074"/>
      <path d="M20 31 C20 23 44 23 44 31 C42 27 22 27 20 31Z" fill="#2a1a12"/>
      <circle cx="24" cy="13" r="7" fill="#fffaf0"/><circle cx="32" cy="10" r="8.2" fill="#fffaf0"/><circle cx="40" cy="13" r="7" fill="#fffaf0"/>
      <rect x="20" y="16" width="24" height="9" rx="2" fill="#fffaf0"/>
      <path d="M21 22.5 h22" stroke="#e3dccd" stroke-width="1.4"/>
      <path d="M25 31 h4.5 M34.5 31 h4.5" stroke="#2a1a12" stroke-width="1.8" stroke-linecap="round"/>
      <circle cx="27" cy="34" r="1.4" fill="#2b1a10"/><circle cx="37" cy="34" r="1.4" fill="#2b1a10"/>
      <path d="M27 40 q5 4 10 0" fill="none" stroke="#7a3a1a" stroke-width="1.6" stroke-linecap="round"/>`,
  },
  anna: {
    bg: '#b07a14',
    art: `
      <path d="M9 64 C11 49 22 45 32 45 C42 45 53 49 55 64Z" fill="#2f8c8c"/>
      <path d="M21 50 L25 64" stroke="#7a4021" stroke-width="3.2" stroke-linecap="round"/>
      <path d="M17 36 C15 22 22 15 32 15 C42 15 49 22 47 36 C47 44 44 48 44 48 L20 48 C20 48 17 44 17 36Z" fill="#f0c75e"/>
      <circle cx="46.5" cy="45" r="3" fill="#e0b04a"/><circle cx="47.2" cy="50" r="2.6" fill="#e0b04a"/><circle cx="47.6" cy="54.6" r="2.2" fill="#e0b04a"/>
      <ellipse cx="32" cy="33" rx="11.5" ry="12.5" fill="#f6d3b8"/>
      <path d="M20 30 C22 21 42 21 44 30 C38 26.5 30 25.5 20 30Z" fill="#f0c75e"/>
      <ellipse cx="32" cy="21" rx="22" ry="5" fill="#d9ad5b"/>
      <path d="M21 21 C21 10 43 10 43 21Z" fill="#e8c272"/>
      <path d="M21.3 17.5 h21.4 v3.2 h-21.4z" fill="#e0432f"/>
      <circle cx="27.5" cy="33" r="1.4" fill="#2b4a6a"/><circle cx="36.5" cy="33" r="1.4" fill="#2b4a6a"/>
      <g fill="#d9946a"><circle cx="25" cy="37" r=".7"/><circle cx="27" cy="38" r=".7"/><circle cx="37" cy="38" r=".7"/><circle cx="39" cy="37" r=".7"/></g>
      <path d="M28 40 q4 3.4 8 0" fill="none" stroke="#9a4a3a" stroke-width="1.5" stroke-linecap="round"/>`,
  },
};

export const CUSTOMER_IDS = Object.keys(PORTRAITS);

/** Round customer portrait (span.avatar > svg). Unknown ids fall back to Ayşe Teyze. */
export function customerAvatar(id: string, cls = ''): HTMLSpanElement {
  const p = PORTRAITS[id] ?? PORTRAITS.ayse;
  const wrap = document.createElement('span');
  wrap.className = `avatar${cls ? ` ${cls}` : ''}`;
  wrap.setAttribute('aria-hidden', 'true');
  wrap.style.setProperty('--avatar-bg', p.bg);
  wrap.append(svgEl(`<svg viewBox="0 0 64 64">${p.art}</svg>`));
  return wrap;
}
