// Ekranlar arası akış: menü → gece tanıtımı → oyun → sonuç.
import { Sfx } from './audio';
import { STORY_NIGHTS, TOOLS, ZONE_INFO, complaintsFor, newThingsFor, nightConfig } from './data';
import { Ecg } from './ecg';
import { Game, GameState, clockText, summarize } from './game';
import { Play } from './play';
import { loadSave, unlockedUpTo, writeSave } from './save';
import { RULES } from './triage';

const $ = (id: string) => document.getElementById(id) as HTMLElement;

const sfx = new Sfx();
const save = loadSave();
sfx.enabled = save.sound;
let currentNight = 1;
let helpFrom: 'menu' | 'pause' = 'menu';
let lastResult: { night: number; text: string } | null = null;

const play = new Play(sfx, { onEnd: showResult, onPauseRequest: pauseGame });

const OVERLAYS = ['ov-intro', 'ov-pause', 'ov-help', 'ov-result'];
const hideOverlays = () => OVERLAYS.forEach((id) => ($(id).hidden = true));
const show = (screen: 'menu' | 'play') => {
  $('menu').hidden = screen !== 'menu';
  $('play').hidden = screen !== 'play';
};

document.addEventListener('pointerdown', () => sfx.unlock(), { capture: true });

// ---------- Menü ----------

const menuEcg = new Ecg($('menu-ecg') as HTMLCanvasElement, '#57ff98', 120);
let menuRaf = 0;
let menuLast = 0;
function menuLoop(now: number) {
  const dt = Math.min(0.1, (now - menuLast) / 1000);
  menuLast = now;
  menuEcg.step(dt);
  menuRaf = requestAnimationFrame(menuLoop);
}

function showMenu() {
  play.stop();
  play.game = null;
  play.closeSheet();
  hideOverlays();
  show('menu');
  renderNights();
  renderSound();
  menuEcg.resize();
  cancelAnimationFrame(menuRaf);
  menuLast = performance.now();
  menuRaf = requestAnimationFrame(menuLoop);
}

function renderNights() {
  const top = unlockedUpTo(save);
  const count = Math.max(STORY_NIGHTS, Math.min(top, 99));
  const list = $('night-list');
  list.innerHTML = '';
  for (let n = 1; n <= count; n++) {
    const cfg = nightConfig(n);
    const stars = save.stars[n] ?? 0;
    const locked = n > top;
    const li = document.createElement('li');
    const best = save.best[n] ? ` · en iyi ${save.best[n]}` : '';
    li.innerHTML =
      `<button type="button" class="night" data-n="${n}"${locked ? ' disabled' : ''}>` +
      `<span class="night-no">${n}</span>` +
      `<span class="night-body"><b>${cfg.title}</b><small>${locked ? 'Önceki geceyi bitirince açılır' : cfg.blurb + best}</small></span>` +
      `<span class="night-stars" aria-label="${stars} yıldız">${'★'.repeat(stars)}${'☆'.repeat(3 - stars)}</span>` +
      `</button>`;
    list.appendChild(li);
  }
}

$('night-list').addEventListener('click', (e) => {
  const b = (e.target as HTMLElement).closest('button.night') as HTMLButtonElement | null;
  if (!b || b.disabled) return;
  sfx.tap();
  showIntro(Number(b.dataset.n));
});

function renderSound() {
  const b = $('btn-sound');
  b.textContent = save.sound ? 'Ses açık' : 'Ses kapalı';
  b.setAttribute('aria-pressed', String(save.sound));
}

$('btn-sound').addEventListener('click', () => {
  save.sound = !save.sound;
  sfx.enabled = save.sound;
  writeSave(save);
  renderSound();
  sfx.tap();
});

// ---------- Gece tanıtımı ----------

function showIntro(n: number) {
  currentNight = n;
  const cfg = nightConfig(n);
  const fresh = newThingsFor(n);
  $('in-kicker').textContent = `${n}. gece · 23:00`;
  $('in-title').textContent = cfg.title;
  $('in-blurb').textContent = cfg.blurb;
  const list = n === 1 ? complaintsFor(1) : fresh.complaints;
  $('in-new').innerHTML = list.length
    ? `<p class="card-sub">${n === 1 ? 'Bu gece gelenler' : 'Yeni şikâyetler'}</p>` +
      list
        .map((c) => `<div class="in-row"><span>${c.emoji} ${c.title}</span><span>${TOOLS[c.tool].emoji} ${TOOLS[c.tool].name}</span></div>`)
        .join('')
    : '';
  const hintText = ['İpucu yok: eşikleri ezbere bilmen gerek', 'Bulgular renkli, öneri yok', 'Bulgular renkli, doğru alan ve tedavi gösterilir'][cfg.hints];
  const facts = [
    `Yatak: ${ZONE_INFO.red.name} ${cfg.beds.red}, ${ZONE_INFO.yellow.name} ${cfg.beds.yellow}, ${ZONE_INFO.green.name} ${cfg.beds.green}`,
    cfg.ambulance ? '112 ambulansları gelecek' : 'Ambulans yok',
    hintText,
    `Nöbet ${Math.round(cfg.duration / 60 * 10) / 10} dakika sürer`,
  ];
  if (fresh.tools.length && n > 1) facts.unshift(`Yeni tedavi: ${fresh.tools.map((t) => `${TOOLS[t].emoji} ${TOOLS[t].name}`).join(', ')}`);
  $('in-facts').innerHTML = facts.map((f) => `<li>${f}</li>`).join('');
  hideOverlays();
  $('ov-intro').hidden = false;
}

$('in-back').addEventListener('click', () => {
  $('ov-intro').hidden = true;
});
$('in-go').addEventListener('click', () => startNight(currentNight));

function startNight(n: number, state?: GameState) {
  hideOverlays();
  cancelAnimationFrame(menuRaf);
  show('play');
  const g = state ? new Game(state) : new Game(n);
  currentNight = g.s.night;
  play.start(g);
  if (state) pauseGame();
}

// ---------- Mola ----------

function pauseGame() {
  if (!play.game || play.game.s.over) return;
  play.setPaused(true);
  $('ov-pause').hidden = false;
}

function resumeGame() {
  $('ov-pause').hidden = true;
  play.setPaused(false);
}

$('pa-resume').addEventListener('click', resumeGame);
$('pa-help').addEventListener('click', () => showHelp('pause'));
$('pa-quit').addEventListener('click', showMenu);
document.addEventListener('visibilitychange', () => {
  if (document.hidden && play.game && !play.paused && !play.game.s.over) pauseGame();
});

// ---------- Triaj kartı ----------

function showHelp(from: 'menu' | 'pause') {
  helpFrom = from;
  $('help-rules').innerHTML =
    '<thead><tr><th>Bulgu</th><th class="h-green">Normal</th><th class="h-yellow">Sarı</th><th class="h-red">Kırmızı</th></tr></thead><tbody>' +
    RULES.map((r) => `<tr><th>${r.label}</th><td>${r.normal}</td><td>${r.yellow}</td><td>${r.red}</td></tr>`).join('') +
    '</tbody>';
  const upTo = from === 'pause' ? currentNight : Math.max(1, unlockedUpTo(save));
  $('help-tx').innerHTML = complaintsFor(upTo)
    .map((c) => `<div class="tx"><span>${c.emoji} ${c.title}</span><span>${TOOLS[c.tool].emoji}</span></div>`)
    .join('');
  $('ov-pause').hidden = true;
  $('ov-help').hidden = false;
}

$('btn-help').addEventListener('click', () => showHelp('menu'));
$('help-close').addEventListener('click', () => {
  $('ov-help').hidden = true;
  if (helpFrom === 'pause') $('ov-pause').hidden = false;
});

// ---------- Sonuç ----------

function showResult(g: Game) {
  const s = g.s;
  const sum = summarize(s);
  const n = s.night;
  if (sum.stars > (save.stars[n] ?? 0)) save.stars[n] = sum.stars;
  if (s.score > (save.best[n] ?? 0)) save.best[n] = s.score;
  writeSave(save);
  if (sum.result === 'done') sfx.morning();
  else sfx.fail();

  const done = sum.result === 'done';
  $('rs-kicker').textContent = done ? `${n}. gece · 08:00 · Nöbet devri` : `${n}. gece · ${clockText(s.t, s.duration)} · Başhekimin odası`;
  $('rs-title').textContent = done ? (sum.stars === 3 ? 'Kusursuz nöbet' : 'Sabah oldu') : 'Başhekim seni odasına çağırdı';
  $('rs-stars').innerHTML = [0, 1, 2].map((i) => `<span class="${i < sum.stars ? 'on' : ''}">★</span>`).join('');
  $('rs-score').textContent = String(s.score);
  const st = s.stats;
  const rows: [string, string][] = [
    ['Gelen hasta', String(st.arrivals + st.diverted)],
    ['Taburcu ve yatış', String(st.discharged)],
    ['Doğru triaj', st.triaged ? `%${Math.round(sum.accuracy * 100)}` : '—'],
    ['Kod Mavi', st.codes ? `${st.codesSaved}/${st.codes} kurtarıldı` : 'yok'],
    ['Yoğun bakıma sevk', String(st.transferred)],
    ['CİMER şikâyeti', String(st.complaints)],
  ];
  if (st.diverted) rows.push(['Salon dolu, geri çevrilen', String(st.diverted)]);
  if (done && s.handover) rows.push(['Sabah ekibine devredilen', String(s.handover)]);
  $('rs-stats').innerHTML = rows.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('');
  $('rs-criteria').innerHTML = sum.criteria.map((c) => `<li class="${c.ok ? 'ok' : ''}">${c.label}</li>`).join('');

  const next = $('rs-next') as HTMLButtonElement;
  next.hidden = sum.stars < 1;
  next.textContent = `${n + 1}. geceye geç`;
  const share = $('rs-share') as HTMLTextAreaElement;
  share.hidden = true;
  $('rs-copy').textContent = 'Sonucu kopyala';
  lastResult = {
    night: n,
    text: [
      `🏥 NÖBET · ${n}. gece ${'★'.repeat(sum.stars)}${'☆'.repeat(3 - sum.stars)}`,
      `👥 ${st.arrivals + st.diverted} hasta · ✅ ${st.discharged} taburcu`,
      `🎯 %${Math.round(sum.accuracy * 100)} doğru triaj · ❤️ Kod Mavi ${st.codesSaved}/${st.codes}`,
      `😤 ${st.complaints} şikâyet · 🚑 ${st.transferred} sevk · ${s.score} puan`,
    ].join('\n'),
  };
  $('ov-result').hidden = false;
}

$('rs-next').addEventListener('click', () => showIntro(currentNight + 1));
$('rs-retry').addEventListener('click', () => startNight(currentNight));
$('rs-menu').addEventListener('click', showMenu);
$('rs-copy').addEventListener('click', () => {
  if (!lastResult) return;
  const text = lastResult.text;
  const fallback = () => {
    const ta = $('rs-share') as HTMLTextAreaElement;
    ta.value = text;
    ta.hidden = false;
    ta.focus();
    ta.select();
    $('rs-copy').textContent = 'Metni seçip kopyala';
  };
  try {
    navigator.clipboard
      .writeText(text)
      .then(() => ($('rs-copy').textContent = 'Kopyalandı'))
      .catch(fallback);
  } catch {
    fallback();
  }
});

// ---------- Açılış ----------

interface HotApi {
  snapshot?: (fn: () => unknown) => void;
  ready?: (fn: (data: unknown) => void) => void;
  data?: unknown;
}
const hot = (window as unknown as { claude?: { hot?: HotApi } }).claude?.hot;

function boot(data: unknown) {
  const d = (data ?? {}) as { game?: GameState | null };
  if (d.game && d.game.v === 1 && !d.game.over) startNight(d.game.night, d.game);
  else showMenu();
}

try {
  hot?.snapshot?.(() => ({ game: play.game && !play.game.s.over ? play.game.serialize() : null }));
} catch {
  /* güncelleme kancası yok */
}
if (hot?.ready) hot.ready(boot);
else boot(hot?.data ?? {});
