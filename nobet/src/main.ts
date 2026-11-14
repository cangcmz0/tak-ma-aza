// Ekranlar arası akış: menü → gece tanıtımı → oyun → sonuç.
import { Sfx } from './audio';
import { COMPLAINTS, NightCfg, STORY_NIGHTS, TOOLS, ZONE_INFO, complaintsFor, dailyConfig, newThingsFor, nightConfig } from './data';
import { dayKey, dayLabel, daySeed } from './daily';
import { Ecg } from './ecg';
import { Game, GameState, clockText, outcomeGrid, summarize } from './game';
import { Play } from './play';
import { liveStreak, loadSave, rankOf, recordDaily, totalStars, unlockedUpTo, writeSave } from './save';
import { RULES } from './triage';

const $ = (id: string) => document.getElementById(id) as HTMLElement;

type Mode = { kind: 'night'; n: number } | { kind: 'daily'; key: string };

const sfx = new Sfx();
const save = loadSave();
sfx.enabled = save.sound;
let mode: Mode = { kind: 'night', n: 1 };
let helpFrom: 'menu' | 'pause' = 'menu';
let shareText = '';

const play = new Play(sfx, { onEnd: showResult, onPauseRequest: pauseGame });

const OVERLAYS = ['ov-intro', 'ov-pause', 'ov-help', 'ov-result'];
const hideOverlays = () => OVERLAYS.forEach((id) => ($(id).hidden = true));
const show = (screen: 'menu' | 'play') => {
  $('menu').hidden = screen !== 'menu';
  $('play').hidden = screen !== 'play';
};
const starText = (n: number) => `${'★'.repeat(n)}${'☆'.repeat(3 - n)}`;
const txmap = (list = COMPLAINTS) =>
  `<div class="txmap">${list.map((c) => `<div class="tx"><span>${c.emoji} ${c.title}</span><span>${TOOLS[c.tool].emoji}</span></div>`).join('')}</div>`;
const dailyUnlocked = () => (save.stars[1] ?? 0) > 0;

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
  renderRank();
  renderDaily();
  renderNights();
  renderSound();
  menuEcg.resize();
  cancelAnimationFrame(menuRaf);
  menuLast = performance.now();
  menuRaf = requestAnimationFrame(menuLoop);
}

function renderRank() {
  const total = totalStars(save);
  const r = rankOf(total);
  $('rank').innerHTML =
    `<b>${r.title} Dr.</b> · ${total} yıldız` + (r.next ? ` · ${r.next.title} için ${r.next.min - total} yıldız daha` : '');
}

function renderDaily() {
  const key = dayKey();
  const cfg = dailyConfig(key, daySeed(key));
  const rec = save.daily[key];
  const streak = liveStreak(save, key);
  const card = $('daily-card') as HTMLButtonElement;
  card.disabled = !dailyUnlocked();
  card.classList.toggle('played', !!rec);
  $('daily-date').textContent = dayLabel(key);
  $('daily-title').textContent = cfg.title;
  $('daily-streak').textContent = streak ? `🔥 ${streak} gün` : '';
  $('daily-sub').textContent = !dailyUnlocked()
    ? 'İlk nöbeti bitirince açılır'
    : rec
      ? `Bugün: ${rec.score} puan ${starText(rec.stars)} · yarın yeni hastalar`
      : 'Herkese aynı hastalar. İlk denemen kayda geçer.';
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
      `<span class="night-stars" aria-label="${stars} yıldız">${starText(stars)}</span>` +
      `</button>`;
    list.appendChild(li);
  }
}

$('night-list').addEventListener('click', (e) => {
  const b = (e.target as HTMLElement).closest('button.night') as HTMLButtonElement | null;
  if (!b || b.disabled) return;
  sfx.tap();
  showIntro({ kind: 'night', n: Number(b.dataset.n) });
});

$('daily-card').addEventListener('click', () => {
  if (!dailyUnlocked()) return;
  sfx.tap();
  showIntro({ kind: 'daily', key: dayKey() });
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

const configFor = (m: Mode): NightCfg => (m.kind === 'daily' ? dailyConfig(m.key, daySeed(m.key)) : nightConfig(m.n));

function commonFacts(cfg: NightCfg): string[] {
  const hintText = ['İpucu yok: eşikleri ezbere bilmen gerek', 'Bulgular renkli, öneri yok', 'Bulgular renkli, doğru alan ve tedavi gösterilir'][cfg.hints];
  const extras = [cfg.ambulance ? '112 ambulansları' : '', cfg.relatives ? 'bağıran hasta yakınları (📢 dokun, sakinleştir)' : '']
    .filter(Boolean)
    .join(' ve ');
  return [
    `Yatak: ${ZONE_INFO.red.name} ${cfg.beds.red}, ${ZONE_INFO.yellow.name} ${cfg.beds.yellow}, ${ZONE_INFO.green.name} ${cfg.beds.green}`,
    extras ? `Bu gece ${extras} var` : 'Ambulans yok, sakin bir gece',
    hintText,
    `Nöbet ${Math.round((cfg.duration / 60) * 10) / 10} dakika sürer`,
  ];
}

function showIntro(m: Mode) {
  mode = m;
  const cfg = configFor(m);
  let facts = commonFacts(cfg);
  if (m.kind === 'daily') {
    const rec = save.daily[m.key];
    $('in-kicker').textContent = `Günün Nöbeti · ${dayLabel(m.key)}`;
    $('in-new').innerHTML = `<p class="card-sub">Şikâyet ve tedavi</p>${txmap()}`;
    facts = [
      'Bugün herkese aynı hastalar, aynı sırayla geliyor',
      rec ? `Bugünkü sonucun kayıtlı (${rec.score} puan). Bu deneme antrenman.` : 'İlk denemen kayda geçer ve paylaşılabilir',
      ...facts,
    ];
  } else {
    const n = m.n;
    const fresh = newThingsFor(n);
    $('in-kicker').textContent = `${n}. gece · 23:00`;
    const list = n === 1 ? complaintsFor(1) : fresh.complaints;
    $('in-new').innerHTML = list.length
      ? `<p class="card-sub">${n === 1 ? 'Bu gece gelenler' : 'Yeni şikâyetler'}</p>` +
        list
          .map((c) => `<div class="in-row"><span>${c.emoji} ${c.title}</span><span>${TOOLS[c.tool].emoji} ${TOOLS[c.tool].name}</span></div>`)
          .join('')
      : '';
    if (fresh.tools.length && n > 1) facts.unshift(`Yeni tedavi: ${fresh.tools.map((t) => `${TOOLS[t].emoji} ${TOOLS[t].name}`).join(', ')}`);
    if (cfg.relatives && !nightConfig(n - 1).relatives) facts.unshift('Yeni: bağıran hasta yakını. Jetonda 📢 görünce dokun, sakinleştir.');
  }
  $('in-title').textContent = cfg.title;
  $('in-blurb').textContent = cfg.blurb;
  $('in-facts').innerHTML = facts.map((f) => `<li>${f}</li>`).join('');
  hideOverlays();
  $('ov-intro').hidden = false;
}

$('in-back').addEventListener('click', () => {
  $('ov-intro').hidden = true;
});
$('in-go').addEventListener('click', () => startGame());

function startGame(state?: GameState) {
  hideOverlays();
  cancelAnimationFrame(menuRaf);
  show('play');
  const g = state ? new Game(state) : new Game(mode.kind === 'daily' ? { daily: mode.key } : mode.n);
  mode = g.s.daily ? { kind: 'daily', key: g.s.daily } : { kind: 'night', n: g.s.night };
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
  const pool = from === 'pause' && play.game ? play.game.cfg.pool : Math.max(1, unlockedUpTo(save));
  $('help-tx').innerHTML = txmap(complaintsFor(pool));
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
  const st = s.stats;
  const done = sum.result === 'done';
  const grid = outcomeGrid(s);
  const rankBefore = rankOf(totalStars(save)).title;
  let note = '';

  if (s.daily) {
    const official = recordDaily(save, s.daily, { score: s.score, stars: sum.stars, accuracy: sum.accuracy, grid, fired: !done });
    const rec = save.daily[s.daily];
    if (!official) note = `Antrenman. Bugünkü kayıtlı sonucun: ${rec.score} puan ${starText(rec.stars)}`;
    const streak = liveStreak(save, s.daily);
    shareText = [
      `🏥 NÖBET · Günün Nöbeti ${dayLabel(s.daily)} ${starText(rec.stars)}`,
      rec.grid,
      `${rec.score} puan · 🎯 %${Math.round(rec.accuracy * 100)}${streak > 1 ? ` · 🔥 ${streak} gün` : ''}`,
    ].join('\n');
  } else {
    const n = s.night;
    if (sum.stars > (save.stars[n] ?? 0)) save.stars[n] = sum.stars;
    if (s.score > (save.best[n] ?? 0)) save.best[n] = s.score;
    shareText = [
      `🏥 NÖBET · ${n}. gece ${starText(sum.stars)}`,
      grid,
      `${s.score} puan · 🎯 %${Math.round(sum.accuracy * 100)} · ❤️ Kod Mavi ${st.codesSaved}/${st.codes}`,
    ].join('\n');
  }
  writeSave(save);
  const rankAfter = rankOf(totalStars(save)).title;
  if (rankAfter !== rankBefore) note = `Terfi! Artık ${rankAfter} Dr.`;
  if (done) sfx.morning();
  else sfx.fail();

  const where = s.daily ? `Günün Nöbeti · ${dayLabel(s.daily)}` : `${s.night}. gece`;
  $('rs-kicker').textContent = done ? `${where} · 08:00 · Nöbet devri` : `${where} · ${clockText(s.t, s.duration)} · Başhekimin odası`;
  $('rs-title').textContent = done ? (sum.stars === 3 ? 'Kusursuz nöbet' : 'Sabah oldu') : 'Başhekim seni odasına çağırdı';
  $('rs-stars').innerHTML = [0, 1, 2].map((i) => `<span class="${i < sum.stars ? 'on' : ''}">★</span>`).join('');
  $('rs-score').textContent = String(s.score);
  const noteEl = $('rs-note');
  noteEl.hidden = !note;
  noteEl.textContent = note;
  $('rs-grid').textContent = grid;
  const rows: [string, string][] = [
    ['Gelen hasta', String(st.arrivals + st.diverted)],
    ['Taburcu ve yatış', String(st.discharged)],
    ['Doğru triaj', st.triaged ? `%${Math.round(sum.accuracy * 100)}` : '—'],
    ['En uzun seri', String(st.bestCombo)],
    ['Kod Mavi', st.codes ? `${st.codesSaved}/${st.codes} kurtarıldı` : 'yok'],
    ['Yoğun bakıma sevk', String(st.transferred)],
    ['CİMER şikâyeti', String(st.complaints)],
  ];
  if (st.relCalmed || st.relFights) rows.push(['Hasta yakını', `${st.relCalmed} sakin, ${st.relFights} kavga`]);
  if (st.diverted) rows.push(['Salon dolu, geri çevrilen', String(st.diverted)]);
  if (done && s.handover) rows.push(['Sabah ekibine devredilen', String(s.handover)]);
  $('rs-stats').innerHTML = rows.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('');
  $('rs-criteria').innerHTML = sum.criteria.map((c) => `<li class="${c.ok ? 'ok' : ''}">${c.label}</li>`).join('');

  const next = $('rs-next') as HTMLButtonElement;
  next.hidden = !!s.daily || sum.stars < 1;
  next.textContent = `${s.night + 1}. geceye geç`;
  $('rs-retry').textContent = s.daily ? 'Tekrar oyna (antrenman)' : 'Tekrar dene';
  ($('rs-share') as HTMLTextAreaElement).hidden = true;
  $('rs-copy').textContent = 'Sonucu kopyala';
  $('ov-result').hidden = false;
}

$('rs-next').addEventListener('click', () => {
  if (mode.kind === 'night') showIntro({ kind: 'night', n: mode.n + 1 });
});
$('rs-retry').addEventListener('click', () => startGame());
$('rs-menu').addEventListener('click', showMenu);
$('rs-copy').addEventListener('click', () => {
  if (!shareText) return;
  const text = shareText;
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
  if (d.game && d.game.v === 2 && !d.game.over) startGame(d.game);
  else showMenu();
}

try {
  hot?.snapshot?.(() => ({ game: play.game && !play.game.s.over ? play.game.serialize() : null }));
} catch {
  /* güncelleme kancası yok */
}
if (hot?.ready) hot.ready(boot);
else boot(hot?.data ?? {});
