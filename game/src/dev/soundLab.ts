// Developer sound lab (sound-lab.html, dev server only — not part of the production build):
// a button per synthesised sound, loop toggles, haptics, and simulated game events
// routed through fx/feedback.ts exactly like the game does.
import { SOUND_NAMES, type SoundName } from '../audio/audio';
import { WebAudioService } from '../audio/webAudio';
import { feedbackFor } from '../fx/feedback';
import { DeviceHaptics, type HapticType } from '../fx/haptics';
import type { SessionEvent } from '../game/session';

const INFO: Record<SoundName, string> = {
  ui_tap: 'Kare 1 kHz, 20 ms, −20 dB',
  pick: 'Sine 520→820 Hz blip + kumaş hışırtısı',
  rotate: 'Kare 600 Hz, 30 ms, −18 dB',
  drop: '"Puf": beyaz gürültü LP 900 Hz + "şıh" BP 4.2→1.8 kHz',
  blocked: 'Kare 150→110 Hz, 120 ms',
  clear: 'Üçgen arpej C5–E5–G5, zincir başına +2 yarım ton',
  chain: 'clear ile aynı (zincir ≥2)',
  chainWord: 'Bir oktav üstte sine parıltı, 2 nota',
  double: 'İki arpej, 30 ms kaydırmalı',
  goal: 'Sine 880 + 1320 Hz, 90 ms',
  star: 'Çan (1.–3. harmonik), E5 / G5 / C6',
  win: 'Hicaz D–E♭–F♯–G–A, Karplus-Strong telli',
  lose: 'Hicaz inen A–G–F♯, yavaş, −6 dB',
  bomb: 'Sine 120→40 Hz + LP 600 Hz gürültü patlaması',
  danger: 'İki alçak "küt" (≈60 Hz), 150 ms ara',
  sneeze: 'Zerde: "ha… ha… HAPŞU!"',
  joker: '3 rastgele sine blip 2–4 kHz',
  sackHit: 'Sine 90 Hz + LP 400 Hz gürültü',
  sackBreak: 'sackHit + HP 3 kHz "cırt"',
  coin: 'Sine 1.3 kHz → 1.9 kHz, 50 ms',
  booster: 'BP gürültü sweep 400 Hz → 3 kHz "vuuş"',
};

const HAPTICS: HapticType[] = ['selection', 'light', 'medium', 'heavy', 'success', 'warning', 'error'];

function el<K extends keyof HTMLElementTagNameMap>(tag: K, props: Partial<HTMLElementTagNameMap[K]> = {}, ...kids: (Node | string)[]) {
  const e = Object.assign(document.createElement(tag), props);
  e.append(...kids);
  return e;
}

const audio = new WebAudioService();
const haptics = new DeviceHaptics();
const root = document.getElementById('lab')!;
const status = el('div', { id: 'status' });
const log = el('div', { id: 'log' });
let chain = 1;
let starIndex = 0;

function note(msg: string): void {
  log.textContent = `${new Date().toLocaleTimeString()}  ${msg}\n${log.textContent ?? ''}`.slice(0, 4000);
}

function refresh(): void {
  status.textContent = `AudioContext: ${audio.contextState} · ses ${audio.isEnabled ? 'açık' : 'kapalı'} · seviye ${Math.round(audio.currentVolume * 100)}% · akış ${audio.flow.toFixed(2)} · tehlike ${audio.dangerOn ? 'açık' : 'kapalı'} · titreşim: ${haptics.backend}`;
}

function play(name: SoundName): void {
  audio.unlock();
  const ok = audio.play(name, { chain, index: starIndex });
  note(`${name}${ok ? '' : '  (çalınmadı: kapalı / kilitli / cooldown-polifoni sınırı)'}`);
  refresh();
}

function button(title: string, sub: string, onClick: (b: HTMLButtonElement) => void): HTMLButtonElement {
  const b = el('button', { type: 'button' }, el('b', { textContent: title }), el('small', { textContent: sub }));
  b.addEventListener('click', () => onClick(b));
  return b;
}

// --- controls ---
const enabled = el('input', { type: 'checkbox', checked: true });
enabled.addEventListener('change', () => {
  audio.setEnabled(enabled.checked);
  haptics.setEnabled(enabled.checked);
  refresh();
});
const volume = el('input', { type: 'range', min: '0', max: '1', step: '0.05', value: '1' });
volume.addEventListener('input', () => {
  audio.setVolume(Number(volume.value));
  refresh();
});
const chainIn = el('input', { type: 'range', min: '1', max: '10', step: '1', value: '1' });
const chainOut = el('span', { textContent: '×1' });
chainIn.addEventListener('input', () => {
  chain = Number(chainIn.value);
  chainOut.textContent = `×${chain}`;
});
const starIn = el('select');
['E5 (1. yıldız)', 'G5 (2. yıldız)', 'C6 (3. yıldız)'].forEach((t, i) => starIn.append(el('option', { value: String(i), textContent: t })));
starIn.addEventListener('change', () => (starIndex = Number(starIn.value)));

root.append(
  el('h1', { textContent: 'Kum Akışı — Ses Laboratuvarı' }),
  el('p', { className: 'note', textContent: 'Tüm sesler WebAudio ile sentezlenir (dosya yok). Tarifler: src/audio/sounds.ts. İlk tıklama AudioContext’i açar.' }),
  el(
    'div',
    { className: 'controls' },
    el('label', {}, enabled, 'Ses + titreşim açık'),
    el('label', {}, 'Ana ses', volume),
    el('label', {}, 'Zincir', chainIn, chainOut),
    el('label', {}, 'Yıldız', starIn),
  ),
  el('h2', { textContent: 'Tek seferlik sesler' }),
  el('div', { className: 'grid' }, ...SOUND_NAMES.map((n) => button(n, INFO[n], () => play(n)))),
);

// --- loops ---
const flowIn = el('input', { type: 'range', min: '0', max: '1', step: '0.05', value: '1' });
let flowTimer: ReturnType<typeof setInterval> | null = null;
const flowBtn = button('flow (döngü)', 'Pembe gürültü BP 2.5 kHz Q 0.7, −22 dB tavan', (b) => {
  audio.unlock();
  if (flowTimer) {
    clearInterval(flowTimer);
    flowTimer = null;
    audio.setFlow(0);
    b.classList.remove('on');
  } else {
    // Refresh like the game would while grains move (setFlow auto-fades otherwise).
    const tick = () => {
      audio.setFlow(Number(flowIn.value));
      refresh();
    };
    tick();
    flowTimer = setInterval(tick, 500);
    b.classList.add('on');
  }
  refresh();
});
const dangerBtn = button('danger (döngü)', '1,2 sn’de bir iki "küt"', (b) => {
  audio.unlock();
  audio.setDanger(!audio.dangerOn);
  b.classList.toggle('on', audio.dangerOn);
  refresh();
});
root.append(
  el('h2', { textContent: 'Döngüler' }),
  el('div', { className: 'controls' }, el('label', {}, 'Akış seviyesi', flowIn)),
  el('div', { className: 'grid', style: 'margin-top:8px' }, flowBtn, dangerBtn),
);

// --- simulated events through feedback.ts ---
const piece = { kind: 'T', color: 1, rot: 0 } as unknown;
const sims: [string, string, () => SessionEvent[]][] = [
  ['Bırakma', 'placed → drop + akış + light', () => [{ type: 'placed', slot: 0, piece, x: 10 } as SessionEvent]],
  ['Geçersiz bırakma', 'blocked → invalid + warning', () => [{ type: 'blocked', slot: 0, x: 10 }]],
  ['Yol (×1)', 'cleared chain 1', () => [{ type: 'cleared', paths: 1, grains: 120, chain: 1, points: 220 }]],
  ['Zincir ×3 pul biber', 'cleared + chainWord + hapşırık', () => [{ type: 'cleared', paths: 1, grains: 140, chain: 3, points: 900, colors: [1] } as SessionEvent]],
  ['Çifte', 'cleared paths 2', () => [{ type: 'cleared', paths: 2, grains: 260, chain: 2, points: 700 }]],
  ['Acı biber', 'cleared + bombs', () => [{ type: 'cleared', paths: 1, grains: 300, chain: 1, points: 400, bombs: 1 } as SessionEvent]],
  ['Hedef tamam', 'goalComplete', () => [{ type: 'goalComplete', index: 0 }]],
  ['Kazandın (3 yıldız)', 'won → jingle + yıldızlar + success', () => [{ type: 'won', score: 3000, stars: 3, bonus: 300 }]],
  ['Kaybettin', 'lost → yumuşak jingle', () => [{ type: 'lost', reason: 'out_of_pieces', score: 800 }]],
  ['Tehlike aç/kapa', 'danger {on}', () => [{ type: 'danger', on: !audio.dangerOn } as unknown as SessionEvent]],
];
root.append(
  el('h2', { textContent: 'Oyun olayları (fx/feedback.ts üzerinden)' }),
  el(
    'div',
    { className: 'grid' },
    ...sims.map(([t, sub, make]) =>
      button(t, sub, () => {
        audio.unlock();
        for (const e of make()) feedbackFor(e, audio, haptics);
        note(`olay: ${t}`);
        refresh();
      }),
    ),
  ),
  el('h2', { textContent: 'Titreşim' }),
  el(
    'div',
    { className: 'grid' },
    ...HAPTICS.map((t) =>
      button(t, `backend: ${haptics.backend}`, () => {
        haptics.haptic(t);
        note(`haptic: ${t}`);
      }),
    ),
  ),
  el('h2', { textContent: 'Durum' }),
  status,
  log,
);
refresh();
setInterval(refresh, 1000);
(window as unknown as { __lab: unknown }).__lab = { audio, haptics };
