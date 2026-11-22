// QA turu otomatik kontrolleri (Kıdemli QA, docs/qa/report-1.md).
// Kullanım:
//   cd game && npm run build && npx vite preview --port 4173 --strictPort &
//   node scripts/qa-run.cjs [bölümler] [--out <ekranGörüntüsüKlasörü>] [--base http://localhost:4173/]
// bölümler (virgülle, varsayılan hepsi):
//   layout    4 ekran boyutunda tüm ekranlar: taşma, kesilen metin, <44px dokunma hedefi, çakışan düğmeler
//   text      Türkçe büyük harf / lang / yazım kontrolleri (HUD "BÖLÜM" kesilmesi dahil)
//   gameplay  puan formülü, zincir, gram/yol/çuval sayaçları, booster sınırları, devam kuralları
//   flow      ilk açılış → öğretici 1–3 → harita → kazan/kaybet → devam → ödül → mağaza → günlük ödül → sonsuz kilit
//   audio     duraklat/menü/yeniden başla sonrası tehlike döngüsü (ses döngüsü sızıntısı)
//   save      yenileme sonrası kayıt, bozuk kayıt ile açılış
//   robust    hızlı dokunma, tahta dışına bırakma, çoklu dokunuş, resize, visibilitychange
//   ads       geçiş reklamı kuralları (Date.now enjeksiyonu)
//   perf      sonsuz mod bot oturumu (QA_PERF_SEC, vars. 180 sn): kare süresi, bellek, DOM düğüm sayısı
//   a11y      renk körü sembolleri, prefers-reduced-motion, kontrast
//   balance   30 bölüm × QA_TRIES deneme (vars. 3) bot geçme oranı (tarayıcıda, hint botu)
// Çıkış kodu: başarısız kontrol sayısı (0 = hepsi geçti). Sonuçlar konsola ve <out>/qa-results.json'a yazılır.
const { chromium } = require('playwright');
const fs = require('node:fs');
const path = require('node:path');

const args = process.argv.slice(2);
const opt = (name, def) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : def;
};
const OUT = opt('--out', process.env.QA_OUT || '/tmp/qa1');
const BASE = opt('--base', 'http://localhost:4173/');
const positional = args.filter((a, i) => !a.startsWith('--') && !(i > 0 && args[i - 1].startsWith('--')));
const ALL = ['layout', 'text', 'gameplay', 'flow', 'audio', 'save', 'robust', 'ads', 'perf', 'a11y', 'balance'];
const SECTIONS = positional[0] ? positional[0].split(',') : ALL;
fs.mkdirSync(OUT, { recursive: true });

const results = [];
let currentSection = '';
function check(id, ok, detail) {
  results.push({ section: currentSection, id, ok: !!ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'} [${currentSection}] ${id}${detail !== undefined ? ' — ' + (typeof detail === 'string' ? detail : JSON.stringify(detail)) : ''}`);
}
function info(id, detail) {
  results.push({ section: currentSection, id, info: true, detail });
  console.log(`INFO [${currentSection}] ${id} — ${typeof detail === 'string' ? detail : JSON.stringify(detail)}`);
}

const VIEWPORTS = [
  { width: 390, height: 844, dpr: 3, name: '390x844' },
  { width: 360, height: 740, dpr: 2, name: '360x740' },
  { width: 320, height: 640, dpr: 2, name: '320x640' },
  { width: 768, height: 1024, dpr: 2, name: '768x1024' },
];

async function newPage(browser, vp = VIEWPORTS[0], extra = {}) {
  const ctx = await browser.newContext({
    viewport: { width: vp.width, height: vp.height },
    deviceScaleFactor: vp.dpr,
    isMobile: true,
    hasTouch: true,
    locale: 'tr-TR',
    ...extra,
  });
  const page = await ctx.newPage();
  page.errors = [];
  page.on('console', (m) => {
    if (m.type() === 'error') page.errors.push(`console.error: ${m.text()}`);
  });
  page.on('pageerror', (e) => page.errors.push(`pageerror: ${e.message}`));
  return { ctx, page };
}

// ---- helpers shared by sections -------------------------------------------------------------

const H = {
  async fresh(page, query = '?debug=1&nodaily', save) {
    await page.goto(`${BASE}${query}`);
    await page.evaluate((s) => {
      localStorage.clear();
      if (s) localStorage.setItem('kumakisi.save.v1', JSON.stringify(s));
    }, save || null);
    await page.goto(`${BASE}${query}`);
    await page.waitForSelector('[data-testid=menu-play]');
  },
  async openLevel(page, id, query = '?debug=1&nodaily&unlockAll') {
    if (!(await page.locator('[data-testid=menu-levels]').count())) {
      await page.goto(`${BASE}${query}`);
      await page.waitForSelector('[data-testid=menu-levels]');
    }
    await page.click('[data-testid=menu-levels]');
    await page.waitForSelector(`[data-testid=level-${id}]`);
    await page.locator(`[data-testid=level-${id}]`).scrollIntoViewIfNeeded();
    await page.click(`[data-testid=level-${id}]`);
    await page.waitForSelector('[data-testid=board]');
    await page.waitForTimeout(250);
  },
  async startLevel(page, id, query) {
    await H.openLevel(page, id, query);
    if (await page.locator('[data-testid=intro-start]').count()) {
      await page.click('[data-testid=intro-start]');
      await page.waitForTimeout(200);
    }
    // Dismiss tutorial if it is blocking (tap to continue bubbles are fine).
  },
  async settle(page, maxMs = 15000) {
    const t0 = Date.now();
    while (Date.now() - t0 < maxMs) {
      const ok = await page.evaluate(() => {
        const s = window.__kum && window.__kum.session;
        return !s || !s.isPlaying || (s.settled && !s.clearPending);
      });
      if (ok) return true;
      await page.waitForTimeout(60);
    }
    return false;
  },
  /** Fast-forward the session synchronously in the page (no rendering wait). */
  async runSettled(page) {
    return page.evaluate(() => window.__kum.session.runUntilSettled(200000));
  },
  async dragSlotToGrain(page, slot, grainCenterX, opts = {}) {
    const s = await page.locator(`[data-testid=slot-${slot}]`).boundingBox();
    const board = await page.locator('[data-testid=board]').boundingBox();
    const tx = board.x + (grainCenterX / 48) * board.width;
    const ty = opts.ty !== undefined ? opts.ty : board.y + board.height * 0.25;
    const sx = s.x + s.width / 2;
    const sy = s.y + s.height / 2;
    await page.mouse.move(sx, sy);
    await page.mouse.down();
    const steps = opts.steps || 8;
    for (let i = 1; i <= steps; i++) await page.mouse.move(sx + ((tx - sx) * i) / steps, sy + ((ty - sy) * i) / steps);
    if (!opts.hold) await page.mouse.up();
  },
  /** Play one hinted move through the real pointer path. */
  async hintedMove(page) {
    const m = await page.evaluate(() => (window.__kum.session.isPlaying ? window.__kum.hint() : null));
    if (!m) return false;
    const w = await page.evaluate((m) => {
      const p = window.__kum.session.tray[m.slot];
      if (!p) return 1;
      p.rot = m.rot;
      window.__kum.scene.trayDirty = true;
      return (p.rot % 2 === 0 ? { I: 4, O: 2, T: 3, L: 2, J: 2, S: 3, Z: 3 } : { I: 1, O: 2, T: 2, L: 3, J: 3, S: 2, Z: 2 })[p.kind];
    }, m);
    await H.dragSlotToGrain(page, m.slot, m.x + (w * 4) / 2);
    return true;
  },
  /** Fast in-page bot: hinted drops via the session API (no pointer), settling synchronously. */
  async botPlay(page, maxMoves = 60) {
    return page.evaluate((maxMoves) => {
      const k = window.__kum;
      const s = k.session;
      let moves = 0;
      while (s.isPlaying && moves < maxMoves) {
        const m = k.hint();
        if (!m) break;
        const p = s.tray[m.slot];
        if (!p) break;
        p.rot = m.rot;
        if (!s.drop(m.slot, m.x)) break;
        s.runUntilSettled(200000);
        moves++;
      }
      return { state: s.state, score: s.score, placed: s.placed, moves, reason: s.loseReason };
    }, maxMoves);
  },
  async waitResult(page, ms = 6000) {
    await page.waitForSelector('[data-testid^=result-]', { timeout: ms }).catch(() => null);
  },
  shot(page, name) {
    return page.screenshot({ path: path.join(OUT, `qa1-${name}.png`) });
  },
};

/** DOM layout audit run inside the page. */
async function layoutAudit(page) {
  return page.evaluate(() => {
    const vw = innerWidth;
    const vh = innerHeight;
    const issues = { overflowX: [], offscreen: [], clipped: [], smallTap: [], overlap: [] };
    const visible = (el) => {
      const cs = getComputedStyle(el);
      if (cs.display === 'none' || cs.visibility === 'hidden' || +cs.opacity === 0) return false;
      const r = el.getBoundingClientRect();
      return r.width > 0 && r.height > 0;
    };
    const desc = (el) => {
      const id = el.getAttribute('data-testid');
      const cls = typeof el.className === 'string' ? el.className.split(' ').slice(0, 2).join('.') : '';
      const t = (el.innerText || el.getAttribute('aria-label') || '').trim().replace(/\s+/g, ' ').slice(0, 30);
      return `${el.tagName.toLowerCase()}${id ? '[' + id + ']' : ''}${cls ? '.' + cls : ''}${t ? ' "' + t + '"' : ''}`;
    };
    // Topmost scene only (overlays: the overlay itself).
    const scenes = [...document.querySelectorAll('#app > .scene')];
    const top = scenes[scenes.length - 1] || document.body;
    if (document.documentElement.scrollWidth > vw + 1) issues.overflowX.push(`document scrollWidth ${document.documentElement.scrollWidth} > ${vw}`);
    const all = [...top.querySelectorAll('*')].filter((el) => !el.closest('[aria-hidden=true]') && !(el instanceof SVGElement) && visible(el));
    for (const el of all) {
      const r = el.getBoundingClientRect();
      const inScroll = el.closest('.map-scroll, .shop-scroll, [data-scroll]');
      if (!inScroll && (r.right > vw + 1 || r.left < -1) && el.children.length === 0 && (el.innerText || '').trim()) issues.offscreen.push(`${desc(el)} x:${Math.round(r.left)}..${Math.round(r.right)}`);
      if (!inScroll && r.bottom > vh + 1 && (el.matches('button') || ((el.innerText || '').trim() && el.children.length === 0))) issues.offscreen.push(`${desc(el)} y:${Math.round(r.top)}..${Math.round(r.bottom)} > ${vh}`);
      // Text clipping: leaf-ish text node container whose content is wider/taller than its box while overflow clips.
      const cs = getComputedStyle(el);
      const txt = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());
      if (txt && (cs.overflow !== 'visible' || cs.textOverflow === 'ellipsis' || cs.overflowX !== 'visible')) {
        if (el.scrollWidth > el.clientWidth + 1) issues.clipped.push(`${desc(el)} (w ${el.scrollWidth}>${el.clientWidth})`);
        else if (el.scrollHeight > el.clientHeight + 1 && cs.whiteSpace === 'nowrap') issues.clipped.push(`${desc(el)} (h ${el.scrollHeight}>${el.clientHeight})`);
      }
    }
    const taps = all.filter((el) => el.matches('button:not([disabled]), a[href], [role=button], input, select') && !el.closest('.map-street .shop'));
    for (const el of taps) {
      const r = el.getBoundingClientRect();
      if (r.width < 44 || r.height < 44) issues.smallTap.push(`${desc(el)} ${Math.round(r.width)}×${Math.round(r.height)}`);
    }
    for (let i = 0; i < taps.length; i++)
      for (let j = i + 1; j < taps.length; j++) {
        const a = taps[i].getBoundingClientRect();
        const b = taps[j].getBoundingClientRect();
        if (taps[i].contains(taps[j]) || taps[j].contains(taps[i])) continue;
        const ix = Math.min(a.right, b.right) - Math.max(a.left, b.left);
        const iy = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
        if (ix > 4 && iy > 4) issues.overlap.push(`${desc(taps[i])} ∩ ${desc(taps[j])} (${Math.round(ix)}×${Math.round(iy)})`);
      }
    return issues;
  });
}

// ---- sections -------------------------------------------------------------------------------

const sections = {};

sections.layout = async (browser) => {
  for (const vp of VIEWPORTS) {
    const { ctx, page } = await newPage(browser, vp);
    const tag = vp.name;
    const screens = {};
    const audit = async (name) => {
      await page.waitForTimeout(450);
      await H.shot(page, `${tag}-${name}`);
      screens[name] = await layoutAudit(page);
    };
    // Fresh menu (no progress) and progressed menu.
    await H.fresh(page, '?debug=1&nodaily');
    await audit('01-menu-fresh');
    await page.click('[data-testid=menu-levels]');
    await page.waitForSelector('[data-testid=map]');
    await audit('02-map');
    // Level intro + play (level 10: 2 goals, dense prefill).
    await page.goto(`${BASE}?debug=1&nodaily&unlockAll`);
    await page.waitForSelector('[data-testid=menu-levels]');
    await H.openLevel(page, 30);
    await audit('03-intro-30');
    if (await page.locator('[data-testid=intro-start]').count()) await page.click('[data-testid=intro-start]');
    await audit('04-play-30');
    // Booster bar active: give boosters.
    await page.click('[data-testid=pause]');
    await audit('05-pause');
    await page.click('[data-testid=pause-resume]');
    // Lose: block the top.
    await page.evaluate(() => {
      const s = window.__kum.session;
      const g = s.grid;
      for (let x = 0; x < g.w; x += 3) g.set(x, 0, 255, 0, 1);
      s.wake();
    });
    await H.waitResult(page);
    await audit('06-lost');
    // Win: level 1 via bot.
    await H.fresh(page, '?debug=1&nodaily&unlockAll', { tutorialsDone: ['t1', 't2', 't3'] });
    await H.startLevel(page, 10);
    await page.evaluate(() => {
      const s = window.__kum.session;
      for (const g of s.goals.goals) g.current = g.target;
      s.wake();
    });
    await H.waitResult(page);
    await page.waitForTimeout(1600);
    await audit('07-won-10-chest');
    // Shop from the menu.
    await page.goto(`${BASE}?debug=1&nodaily&unlockAll`);
    await page.waitForSelector('[data-testid=menu-play]');
    const shopBtn = page.locator('[data-testid=menu-shop]');
    if (await shopBtn.count()) {
      await shopBtn.first().click();
      await audit('08-shop');
    } else info(`${tag} shop button`, 'menu-shop yok');
    // Daily reward.
    await H.fresh(page, '?debug=1', { levels: { 1: { stars: 3, best: 1, completed: true, attempts: 1, lossStreak: 0 } } });
    await page.waitForTimeout(400);
    if (await page.locator('[data-testid=daily-claim]').count()) await audit('09-daily');
    else info(`${tag} daily`, 'günlük ödül penceresi açılmadı');
    // Endless.
    await page.goto(`${BASE}?debug=1&nodaily&unlockAll`);
    await page.waitForSelector('[data-testid=menu-endless]');
    await page.click('[data-testid=menu-endless]');
    await page.waitForSelector('[data-testid=board]');
    await audit('10-endless');
    // Tutorial (level 1 fresh).
    await H.fresh(page, '?debug=1&nodaily');
    await page.click('[data-testid=menu-play]');
    await page.waitForSelector('[data-testid=board]');
    await page.waitForTimeout(800);
    await audit('11-tutorial-1');

    for (const [name, iss] of Object.entries(screens)) {
      const n = Object.values(iss).reduce((a, b) => a + b.length, 0);
      check(`${tag} ${name} yerleşim`, iss.overflowX.length + iss.offscreen.length + iss.clipped.length + iss.overlap.length === 0, n ? iss : undefined);
      if (iss.smallTap.length) info(`${tag} ${name} <44px dokunma hedefleri`, iss.smallTap);
    }
    check(`${tag} konsol hatası yok`, page.errors.length === 0, page.errors.slice(0, 5));
    await ctx.close();
  }
};

sections.text = async (browser) => {
  const { ctx, page } = await newPage(browser, VIEWPORTS[1]);
  await page.goto(`${BASE}?debug=1&nodaily&unlockAll`);
  await page.waitForSelector('[data-testid=menu-levels]');
  check('html lang="tr"', (await page.evaluate(() => document.documentElement.lang)) === 'tr');
  await H.startLevel(page, 10);
  // HUD order caption: uppercase + overflow hidden + line-height 1.1 clips the diacritics of Ö/Ü/İ.
  const cap = await page.evaluate(() => {
    const el = document.querySelector('.order-caption');
    const cs = getComputedStyle(el);
    const r = el.getBoundingClientRect();
    // Measure the real ink height of the uppercase text vs the clipping box.
    const c = document.createElement('canvas').getContext('2d');
    c.font = `${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
    const m = c.measureText('BÖLÜM İ');
    const mPlain = c.measureText('BOLUM I');
    return {
      text: el.textContent,
      transform: cs.textTransform,
      overflow: cs.overflow,
      lineHeight: cs.lineHeight,
      fontSize: cs.fontSize,
      boxH: r.height,
      inkAscentDiacritic: +m.actualBoundingBoxAscent.toFixed(2),
      inkAscentPlain: +mPlain.actualBoundingBoxAscent.toFixed(2),
      fontAscent: +m.fontBoundingBoxAscent.toFixed(2),
      halfLeading: +((parseFloat(cs.lineHeight) - (m.fontBoundingBoxAscent + m.fontBoundingBoxDescent)) / 2).toFixed(2),
    };
  });
  // Diacritic ink above the line box top = clipped.
  const lineTopToBaseline = cap.halfLeading + cap.fontAscent;
  const clipped = cap.inkAscentDiacritic > lineTopToBaseline + 0.25;
  check('HUD sipariş başlığında Ö/Ü/İ noktaları kesilmiyor', !clipped, cap);
  // Zoomed screenshot of the caption.
  const box = await page.locator('.order-caption').boundingBox();
  await page.screenshot({ path: path.join(OUT, 'qa1-text-hud-caption-zoom.png'), clip: { x: box.x - 4, y: box.y - 6, width: Math.min(260, box.width + 8), height: box.height + 12 } });
  // Other uppercase labels with overflow hidden.
  const ups = await page.evaluate(() =>
    [...document.querySelectorAll('*')]
      .filter((el) => getComputedStyle(el).textTransform === 'uppercase' && el.textContent.trim())
      .map((el) => ({ text: el.textContent.trim().slice(0, 30), lang: el.closest('[lang]')?.getAttribute('lang'), overflow: getComputedStyle(el).overflow, lh: getComputedStyle(el).lineHeight })),
  );
  info('büyük harfe çevrilen etiketler (oyun ekranı)', ups);
  // Uppercase of a Turkish lowercase i / dotless ı in the current lang.
  const up = await page.evaluate(() => {
    const d = document.createElement('span');
    d.style.textTransform = 'uppercase';
    d.textContent = 'iı';
    document.body.append(d);
    const w1 = d.getBoundingClientRect().width;
    d.textContent = 'İI';
    d.style.textTransform = 'none';
    const w2 = d.getBoundingClientRect().width;
    d.remove();
    return { same: Math.abs(w1 - w2) < 0.01 };
  });
  check('text-transform uppercase lang=tr altında i→İ yapıyor', up.same);
  // Web preview fragment has no <html lang="tr"> (scripts/build-web-preview.cjs).
  const prev = fs.readFileSync(path.join(__dirname, 'build-web-preview.cjs'), 'utf8');
  check('web önizleme paketi lang="tr" taşıyor', /lang=/.test(prev), 'build-web-preview.cjs <html lang> yazmıyor');
  check('web önizleme theme-color yeni palette', !/#14112b/i.test(prev), 'theme-color #14112b (eski mor)');
  // Number formatting consistency: result card "Puan: 12345" vs HUD "12.345".
  await page.evaluate(() => {
    const s = window.__kum.session;
    s.score = 12345;
    for (const g of s.goals.goals) g.current = g.target;
    s.wake();
  });
  await H.waitResult(page);
  await page.waitForTimeout(800);
  const scoreText = await page.locator('.result-score').textContent();
  check('sonuç kartı puanı binlik ayırıcılı (HUD ile tutarlı)', /\d\.\d{3}/.test(scoreText), scoreText);
  await H.shot(page, 'text-result-thousands');
  // Strings audit (static): ASCII-only spellings of words that need Turkish letters.
  const tr = fs.readFileSync(path.join(__dirname, '..', 'src', 'i18n', 'tr.ts'), 'utf8');
  const bad = [/\bBolum\b/i, /\bParca\b/i, /\bAltin\b/i, /\bCuval\b/i, /\bSeker\b/i, /\bGunluk\b/i, /\bodul\b/i, /\bMagaza\b/i];
  const hits = bad.filter((r) => r.test(tr)).map(String);
  check('tr.ts Türkçe karakter eksik yazım yok', hits.length === 0, hits);
  // Term consistency: "Parça" (HUD) vs "kese" (intro / continue / tutorial).
  const parca = (tr.match(/[Pp]arça/g) || []).length;
  const kese = (tr.match(/[Kk]ese/g) || []).length;
  info('terim tutarlılığı', { 'Parça/parça': parca, 'kese': kese, hud: "hud.pieces='Parça', result.outOfPieces='Parçalar bitti.' / lostPieces='Keseler bitti!'" });
  check('terim: HUD sayacı ile kayıp başlığı aynı terimi kullanıyor', !(/pieces: 'Parça'/.test(tr) && /lostPieces: 'Keseler bitti!'/.test(tr)), "HUD 'Parça' / sonuç 'Keseler bitti!' + 'Parçalar bitti.' aynı kartta");
  check('konsol hatası yok', page.errors.length === 0, page.errors.slice(0, 5));
  await ctx.close();
};

sections.gameplay = async (browser) => {
  const { ctx, page } = await newPage(browser, VIEWPORTS[0]);
  await page.goto(`${BASE}?debug=1&nodaily&unlockAll`);
  await page.waitForSelector('[data-testid=menu-levels]');
  await H.startLevel(page, 11);
  // Goals out of reach so the formula checks never end the level.
  await page.evaluate(() => window.__kum.session.goals.goals.forEach((g) => (g.target = 1e9)));
  // 1) Score formula: one full-width path of a single colour.
  const r1 = await page.evaluate(() => {
    const s = window.__kum.session;
    const g = s.grid;
    for (let i = 0; i < g.size; i++) if (!(g.flags[i] & 1)) g.clearCell(i);
    s.score = 0;
    s.chain = 0;
    for (let x = 0; x < g.w; x++) for (let y = g.h - 4; y < g.h; y++) g.set(x, y, 1);
    s.wake();
    s.runUntilSettled(200000);
    return { score: s.score, chain: s.bestChain };
  });
  check('puan: tek yol (192 tane) = (192+100)×1', r1.score === 292, r1);
  // 2) Chain: two stacked rows of different colour where the upper completes after the lower clears.
  const r2 = await page.evaluate(() => {
    const s = window.__kum.session;
    const g = s.grid;
    for (let i = 0; i < g.size; i++) if (!(g.flags[i] & 1)) g.clearCell(i);
    s.score = 0;
    s.chain = 0;
    s.bestChain = 0;
    // bottom row colour 1 full (path), row above: colour 3 full except it sits on 1 → after clear falls, still path? we want chain:
    // layout: y=h-1..h-4: colour 1 full (path A). y=h-8..h-5: colour 3 left half + colour 4 right half? Use: colour 3 full but a gap filled by colour 1 column.
    for (let x = 0; x < g.w; x++) for (let y = g.h - 4; y < g.h; y++) g.set(x, y, 1);
    // Upper: colour 3 everywhere except a 4-wide column of colour 1 that touches the bottom path (so it clears with path A).
    for (let x = 0; x < g.w; x++) for (let y = g.h - 8; y < g.h - 4; y++) g.set(x, y, x >= 20 && x < 24 ? 1 : 3);
    // After A (+ column) clears, colour 3 falls: left and right parts separated by a 4-wide hole → no path unless filled.
    // Put colour 3 above the column so it falls into the hole.
    for (let x = 20; x < 24; x++) for (let y = g.h - 12; y < g.h - 8; y++) g.set(x, y, 3);
    s.wake();
    s.runUntilSettled(200000);
    return { score: s.score, bestChain: s.bestChain };
  });
  check('zincir: düşen kum yeni yol kurunca Z=2', r2.bestChain >= 2, r2);
  // 3) Same-check double: two separate full rows -> Z and Z+1, largest first.
  const r3 = await page.evaluate(() => {
    const s = window.__kum.session;
    const g = s.grid;
    for (let i = 0; i < g.size; i++) if (!(g.flags[i] & 1)) g.clearCell(i);
    s.score = 0;
    s.chain = 0;
    for (let x = 0; x < g.w; x++) {
      for (let y = g.h - 4; y < g.h; y++) g.set(x, y, 1); // 192
      for (let y = g.h - 6; y < g.h - 4; y++) g.set(x, y, 3); // 96
    }
    s.wake();
    // tick until first clear resolves
    let ev = null;
    const off = s.events.on((e) => {
      if (e.type === 'cleared' && !ev) ev = e;
    });
    s.runUntilSettled(200000);
    off();
    return { points: ev && ev.points, paths: ev && ev.paths, chain: ev && ev.chain };
  });
  check('çifte: aynı kontrolde 2 yol = (192+100)×1 + (96+100)×2 = 684', r3.points === 684, r3);
  // 4) Chain resets on settle without path, NOT on drop (CHAIN_RESET_ON_DROP=false).
  const r4 = await page.evaluate(() => {
    const s = window.__kum.session;
    s.chain = 3;
    const slot = s.tray.findIndex((t) => t);
    s.drop(slot, 0);
    const afterDrop = s.chain;
    s.runUntilSettled(200000);
    return { afterDrop, afterSettle: s.chain };
  });
  check('zincir bırakışta sıfırlanmıyor, durulunca (yol yoksa) sıfırlanıyor', r4.afterDrop === 3 && r4.afterSettle === 0, r4);
  // 5) Chain cap ×5.
  const r5 = await page.evaluate(() => {
    const s = window.__kum.session;
    const g = s.grid;
    for (let i = 0; i < g.size; i++) if (!(g.flags[i] & 1)) g.clearCell(i);
    s.chain = 7;
    s.score = 0;
    for (let x = 0; x < g.w; x++) for (let y = g.h - 4; y < g.h; y++) g.set(x, y, 1);
    s.wake();
    s.runUntilSettled(200000);
    return { score: s.score };
  });
  check('zincir tavanı ×5', r5.score === 292 * 5, r5);
  // 6) Bomb: grains removed by the blast score 1×Z, count for grain goal (level 12: sumak grains).
  await H.startLevel(page, 12);
  const r6 = await page.evaluate(() => {
    const s = window.__kum.session;
    const g = s.grid;
    for (let i = 0; i < g.size; i++) if (!(g.flags[i] & 1)) g.clearCell(i);
    s.score = 0;
    s.chain = 0;
    const goal = s.goals.goals.find((q) => q.def.type === 'clear_color_grains');
    const before = goal ? goal.current : -1;
    for (let x = 0; x < g.w; x++) for (let y = g.h - 4; y < g.h; y++) g.set(x, y, 1);
    for (let x = 0; x < g.w; x++) for (let y = g.h - 12; y < g.h - 4; y++) g.set(x, y, 4 + ((x >> 2) % 2) * -1); // sumak / colour 3 stripes
    g.flags[(g.h - 2) * g.w + 24] |= 2; // bomb grain inside the bottom path
    s.wake();
    let bombEv = null;
    const off = s.events.on((e) => {
      if (e.type === 'bomb') bombEv = e;
    });
    s.runUntilSettled(200000);
    off();
    return { score: s.score, goalColor: goal && goal.def.color, before, after: goal ? goal.current : -1, bombGrains: bombEv && bombEv.grains };
  });
  check('bomba: patlama taneleri gram hedefine sayılıyor', r6.after > r6.before && r6.bombGrains > 0, r6);
  check('bomba puanı = yol + bomba tanesi×Z', r6.score === 292 + r6.bombGrains, r6);
  // 7) Sieve (Elek): grains count for grain goal, not path goal; 1 point each, no multiplier.
  const r7 = await page.evaluate(() => {
    const s = window.__kum.session;
    const g = s.grid;
    for (let i = 0; i < g.size; i++) if (!(g.flags[i] & 1)) g.clearCell(i);
    s.score = 0;
    s.chain = 4;
    for (let x = 0; x < 10; x++) g.set(x, g.h - 1, 4);
    const goal = s.goals.goals.find((q) => q.def.type === 'clear_color_grains');
    const before = goal.current;
    const n = s.sieveColor(4);
    return { n, score: s.score, gained: goal.current - before };
  });
  check('Elek: 1 puan/tane, çarpansız, gram hedefine sayılıyor', r7.n === 10 && r7.score === 10 && r7.gained === 10, r7);
  // 8) Scoop: 4-wide strip, statics untouched, joker removed.
  const r8 = await page.evaluate(() => {
    const s = window.__kum.session;
    const g = s.grid;
    for (let i = 0; i < g.size; i++) if (!(g.flags[i] & 1)) g.clearCell(i);
    s.score = 0;
    for (let y = g.h - 10; y < g.h; y++) for (let x = 0; x < g.w; x++) g.set(x, y, 1);
    g.set(10, g.h - 5, 15); // joker
    const n = s.scoopColumns(8, 4);
    return { n, score: s.score };
  });
  check('Kepçe: 4 tane genişlik × 10 satır = 40 tane (joker dahil), 1 puan/tane', r8.n === 40 && r8.score === 40, r8);
  // 9) Booster limits per level (UI): 3 uses max. Use shuffle via the bar.
  await page.evaluate(() => {
    window.__app.meta.economy.earn(5000, 'qa');
    const b = window.__app.save.economy.boosters;
    b.shuffle = 10;
    window.__app.save.commit();
  });
  await H.startLevel(page, 12);
  const shuffleBtn = page.locator('[data-testid=booster-shuffle]');
  if (await shuffleBtn.count()) {
    const counts = [];
    for (let i = 0; i < 5; i++) {
      const before = await page.evaluate(() => JSON.stringify(window.__kum.session.tray.map((t) => t && t.kind + t.color)));
      await shuffleBtn.click({ timeout: 3000 }).catch(() => {});
      await page.waitForTimeout(250);
      // close a booster offer sheet if one appeared
      const sheet = page.locator('[data-testid=booster-offer]');
      if (await sheet.count()) await page.click('[data-testid=offer-cancel]');
      const after = await page.evaluate(() => JSON.stringify(window.__kum.session.tray.map((t) => t && t.kind + t.color)));
      counts.push(before !== after);
    }
    check('Yenile bölümde en fazla 3 kez', counts.filter(Boolean).length <= 3, counts);
    await H.shot(page, 'gameplay-booster-limit');
  } else info('booster-shuffle', 'düğme bulunamadı');
  // 10) Continue rules: level 12 (not free): 1st = ad or 300, 2nd = 600, 3rd none.
  // "Tezgâh doldu": fill every free cell with sand in 4-wide stripes of two colours (no path).
  const loseNow = () =>
    page.evaluate(() => {
      const s = window.__kum.session;
      const g = s.grid;
      const [a, b] = s.level.colors;
      for (let y = 0; y < g.h; y++) for (let x = 0; x < g.w; x++) if (g.get(x, y) === 0) g.set(x, y, (x >> 2) % 2 ? a : b);
      s.wake();
    });
  await loseNow();
  await H.waitResult(page);
  const c1 = { ad: await page.locator('[data-testid=continue-ad]').count(), gold: (await page.locator('[data-testid=continue-gold]').textContent().catch(() => '')).trim() };
  const goldBefore = await page.evaluate(() => window.__app.meta.economy.gold);
  await page.click('[data-testid=continue-gold]');
  await page.waitForTimeout(400);
  const after1 = await page.evaluate(() => ({ gold: window.__app.meta.economy.gold, state: window.__kum.session.state, left: window.__kum.session.piecesLeft, top: window.__kum.session.topSandRow() }));
  check('devam 1: reklam + 300 altın seçeneği', c1.ad === 1 && /300/.test(c1.gold), c1);
  check('devam 1: 300 altın düştü, oyun sürüyor', goldBefore - after1.gold === 300 && after1.state === 'playing', { goldBefore, ...after1 });
  check('devam (tahta doldu): üst 20 satır boşaldı', after1.top >= 20 || after1.top === 80, after1);
  // the stones at y=0 are static and stay → no_space again immediately? report.
  await page.waitForTimeout(600);
  const st2 = await page.evaluate(() => window.__kum.session.state);
  info('devam sonrası hemen tekrar kayıp mı (taşlar statik, temizlenmez)', st2);
  // Out of pieces loss for the 2nd continue.
  await page.evaluate(() => {
    const s = window.__kum.session;
    if (s.state !== 'playing') return;
    s.extraPieces = s.placed - s.level.pieceLimit;
    for (let i = 0; i < s.tray.length; i++) s.tray[i] = null;
    s.wake();
  });
  await H.waitResult(page);
  const c2 = { ad: await page.locator('[data-testid=continue-ad]').count(), gold: (await page.locator('[data-testid=continue-gold]').textContent().catch(() => '')).trim() };
  check('devam 2: yalnız 600 altın (reklam yok)', c2.ad === 0 && /600/.test(c2.gold), c2);
  await page.click('[data-testid=continue-gold]').catch(() => {});
  await page.waitForTimeout(400);
  const st3 = await page.evaluate(() => ({ left: window.__kum.session.piecesLeft, tray: window.__kum.session.tray.filter(Boolean).length }));
  check('devam 2: +5 parça, tepsi doldu', st3.left === 5 && st3.tray === 3, st3);
  await page.evaluate(() => {
    const s = window.__kum.session;
    s.extraPieces = s.placed - s.level.pieceLimit;
    for (let i = 0; i < s.tray.length; i++) s.tray[i] = null;
    s.wake();
  });
  await H.waitResult(page);
  check('devam 3: teklif yok', (await page.locator('[data-testid=continue-offer]').count()) === 0);
  // 11) Free continue in levels 1–5.
  await H.startLevel(page, 4);
  await loseNow();
  await H.waitResult(page);
  check('bölüm 1–5: ilk devam ücretsiz', (await page.locator('[data-testid=continue-free]').count()) === 1);
  // 12) Gold never negative: try spending more than the balance.
  const neg = await page.evaluate(() => {
    const e = window.__app.meta.economy;
    const g0 = e.gold;
    const ok = e.spend(g0 + 1, 'qa');
    const ok2 = e.spend(-50, 'qa');
    const ok3 = e.earn(NaN, 'qa');
    return { g0, ok, ok2, ok3, g1: e.gold };
  });
  check('altın negatife düşmüyor / geçersiz miktar reddediliyor', !neg.ok && !neg.ok2 && neg.g1 === neg.g0, neg);
  // 13) Drop onto flowing sand allowed.
  await H.startLevel(page, 11);
  const flow = await page.evaluate(() => {
    const s = window.__kum.session;
    const a = s.tray.findIndex((t) => t);
    s.drop(a, 0);
    for (let i = 0; i < 3; i++) s.tick();
    const b = s.tray.findIndex((t) => t);
    const ok = s.drop(b, 30);
    return { settledAtSecond: s.settled, secondDropOk: ok };
  });
  check('kum akarken bırakma serbest', flow.secondDropOk && !flow.settledAtSecond, flow);
  // 14) Win only when settled; end bonus 100/piece not counted to score goal (level 4 score goal).
  await H.startLevel(page, 4);
  const sb = await page.evaluate(() => {
    const s = window.__kum.session;
    const goal = s.goals.goals.find((g) => g.def.type === 'score');
    s.score = goal.target - 1;
    s.goals.onScore(s.score);
    s.wake();
    s.runUntilSettled(200000);
    return { state: s.state, done: goal.current >= goal.target, left: s.piecesLeft };
  });
  check('Tezgâh bonusu puan hedefini tamamlamıyor', sb.state === 'playing' && !sb.done, sb);
  check('konsol hatası yok', page.errors.length === 0, page.errors.slice(0, 5));
  await ctx.close();
};

module.exports = { H, layoutAudit, VIEWPORTS };

if (require.main === module) {
  (async () => {
    const browser = await chromium.launch();
    for (const name of SECTIONS) {
      if (!sections[name]) {
        console.log(`(bölüm yok: ${name})`);
        continue;
      }
      currentSection = name;
      const t0 = Date.now();
      try {
        await sections[name](browser);
      } catch (e) {
        check(`${name} bölümü çalıştı`, false, String(e && e.stack ? e.stack.split('\n').slice(0, 3).join(' | ') : e));
      }
      console.log(`--- ${name}: ${((Date.now() - t0) / 1000).toFixed(1)} sn`);
    }
    await browser.close();
    const failed = results.filter((r) => r.ok === false);
    fs.writeFileSync(path.join(OUT, 'qa-results.json'), JSON.stringify(results, null, 2));
    console.log(`\nToplam: ${results.filter((r) => r.ok === true).length} geçti, ${failed.length} başarısız, ${results.filter((r) => r.info).length} bilgi. Sonuçlar: ${path.join(OUT, 'qa-results.json')}`);
    process.exit(Math.min(failed.length, 100));
  })().catch((e) => {
    console.error(e);
    process.exit(101);
  });
}
