// QA turu otomatik kontrolleri (Kıdemli QA, docs/qa/report-1.md).
// Kullanım:
//   cd game && npm run build && npx vite preview --port 4173 --strictPort &
//   node scripts/qa-run.cjs [bölümler] [--out <ekranGörüntüsüKlasörü>] [--base http://localhost:4173/]
// bölümler (virgülle, varsayılan hepsi):
//   layout    4 ekran boyutunda tüm ekranlar: taşma, kesilen metin, <44px dokunma hedefi, çakışan düğmeler
//   text      Türkçe büyük harf / lang / yazım kontrolleri (HUD "BÖLÜM" kesilmesi dahil)
//   gameplay  puan formülü, zincir, gram/yol/çuval sayaçları, booster sınırları, devam kuralları
//   drop      sürükle-bırak hissi: bırakma yüksekliği, katı blok düşüş, çıkıntı altı, akan kuma bırakma, tahta dışı
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
const ALL = ['layout', 'text', 'gameplay', 'drop', 'flow', 'audio', 'save', 'robust', 'ads', 'perf', 'a11y', 'balance'];
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
  async fresh(page, query = '?debug=1&nohowto&nodaily', save) {
    await page.goto(`${BASE}${query}`);
    await page.evaluate((s) => {
      localStorage.clear();
      if (s) localStorage.setItem('kumakisi.save.v1', JSON.stringify(s));
    }, save || null);
    await page.goto(`${BASE}${query}`);
    await page.waitForSelector('[data-testid=menu-play]');
  },
  async openLevel(page, id, query = '?debug=1&nohowto&nodaily&unlockAll') {
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
    return page.evaluate(() => window.__kum.session.runUntilSettled(400000));
  },
  /** grainCenterX is in design grains (0..48), independent of the grid resolution. */
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
    // Tutorial focus: only the focused slot is usable — ask the hint for that slot alone.
    const m = await page.evaluate(() => {
      const k = window.__kum;
      if (!k.session.isPlaying) return null;
      const f = k.scene.focusSlot;
      if (f === null || f === undefined || !k.session.tray[f]) return k.hint();
      const saved = k.session.tray.slice();
      saved.forEach((p, i) => i !== f && (k.session.tray[i] = null));
      const mv = k.hint();
      saved.forEach((p, i) => (k.session.tray[i] = p));
      return mv;
    });
    if (!m) return false;
    // Centre of the hinted drop in design grains (0..48), whatever the grid resolution.
    const cx = await page.evaluate((m) => {
      const s = window.__kum.session;
      const p = s.tray[m.slot];
      if (!p) return 24;
      p.rot = m.rot;
      window.__kum.scene.trayDirty = true;
      const w = (p.rot % 2 === 0 ? { I: 4, O: 2, T: 3, L: 2, J: 2, S: 3, Z: 3 } : { I: 1, O: 2, T: 2, L: 3, J: 3, S: 2, Z: 2 })[p.kind];
      const block = s.grid.w / 12;
      return ((m.x + (w * block) / 2) / s.grid.w) * 48;
    }, m);
    await H.dragSlotToGrain(page, m.slot, cx);
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
        s.runUntilSettled(400000);
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
    const all = [...top.querySelectorAll('*')].filter((el) => !el.closest('[aria-hidden=true], .sr-only') && !(el instanceof SVGElement) && visible(el));
    const scrollAncestor = (el) => {
      for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
        const o = getComputedStyle(p).overflowY;
        if ((o === 'auto' || o === 'scroll') && p.scrollHeight > p.clientHeight + 1) return p;
      }
      return null;
    };
    issues.belowFold = [];
    for (const el of all) {
      const r = el.getBoundingClientRect();
      const inScroll = el.closest('.map-scroll, .shop-scroll, [data-scroll]');
      if (!inScroll && (r.right > vw + 1 || r.left < -1) && el.children.length === 0 && (el.innerText || '').trim()) issues.offscreen.push(`${desc(el)} x:${Math.round(r.left)}..${Math.round(r.right)}`);
      if (!inScroll && r.bottom > vh + 1 && (el.matches('button') || ((el.innerText || '').trim() && el.children.length === 0))) {
        if (scrollAncestor(el)) issues.belowFold.push(`${desc(el)} y:${Math.round(r.top)} (kaydırınca görünür)`);
        else issues.offscreen.push(`${desc(el)} y:${Math.round(r.top)}..${Math.round(r.bottom)} > ${vh}`);
      }
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
    await H.fresh(page, '?debug=1&nohowto&nodaily');
    await audit('01-menu-fresh');
    await page.click('[data-testid=menu-levels]');
    await page.waitForSelector('[data-testid=map]');
    await audit('02-map');
    // Level intro + play (level 10: 2 goals, dense prefill).
    await page.goto(`${BASE}?debug=1&nohowto&nodaily&unlockAll`);
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
    await H.fresh(page, '?debug=1&nohowto&nodaily&unlockAll', { tutorialsDone: ['t1', 't2', 't3'] });
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
    await page.goto(`${BASE}?debug=1&nohowto&nodaily&unlockAll`);
    await page.waitForSelector('[data-testid=menu-play]');
    const shopBtn = page.locator('[data-testid=menu-shop]');
    if (await shopBtn.count()) {
      await shopBtn.first().click();
      await audit('08-shop');
    } else info(`${tag} shop button`, 'menu-shop yok');
    // Daily reward.
    await H.fresh(page, '?debug=1&nohowto', { levels: { 1: { stars: 3, best: 1, completed: true, attempts: 1, lossStreak: 0 } } });
    await page.waitForTimeout(400);
    if (await page.locator('[data-testid=daily-claim]').count()) await audit('09-daily');
    else info(`${tag} daily`, 'günlük ödül penceresi açılmadı');
    // Endless.
    await page.goto(`${BASE}?debug=1&nohowto&nodaily&unlockAll`);
    await page.waitForSelector('[data-testid=menu-endless]');
    await page.click('[data-testid=menu-endless]');
    await page.waitForSelector('[data-testid=board]');
    await audit('10-endless');
    // Tutorial (level 1 fresh).
    await H.fresh(page, '?debug=1&nohowto&nodaily');
    await page.click('[data-testid=menu-play]');
    await page.waitForSelector('[data-testid=board]');
    await page.waitForTimeout(800);
    await audit('11-tutorial-1');

    for (const [name, iss] of Object.entries(screens)) {
      const n = iss.overflowX.length + iss.offscreen.length + iss.clipped.length + iss.overlap.length;
      check(`${tag} ${name} yerleşim`, iss.overflowX.length + iss.offscreen.length + iss.clipped.length + iss.overlap.length === 0, n ? iss : undefined);
      if (iss.smallTap.length) info(`${tag} ${name} <44px dokunma hedefleri`, iss.smallTap);
      if (iss.belowFold.length) info(`${tag} ${name} ekran altında kalan (kaydırmalı kart) öğeler`, iss.belowFold);
    }
    check(`${tag} konsol hatası yok`, page.errors.length === 0, page.errors.slice(0, 5));
    await ctx.close();
  }
};

sections.text = async (browser) => {
  const { ctx, page } = await newPage(browser, VIEWPORTS[1]);
  await page.goto(`${BASE}?debug=1&nohowto&nodaily&unlockAll`);
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
  const clipped = cap.inkAscentDiacritic > lineTopToBaseline + 1;
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
  check('web önizleme paketi lang="tr" taşıyor', /lang\s*=/.test(prev), 'build-web-preview.cjs <html lang> yazmıyor');
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
  await page.goto(`${BASE}?debug=1&nohowto&nodaily&unlockAll`);
  await page.waitForSelector('[data-testid=menu-levels]');
  await H.startLevel(page, 11);
  // Goals out of reach so the formula checks never end the level.
  await page.evaluate(() => window.__kum.session.goals.goals.forEach((g) => (g.target = 1e9)));
  // All coordinates below are in design grains × S (S = grid cells per design grain: 1 for 48×80, 2 for 96×160).
  // Expected points are in design grains (session converts cells with cellsToGrains()).
  // 1) Score formula: one full-width path (48 × 4 design grains = 192 g).
  const r1 = await page.evaluate(() => {
    const s = window.__kum.session;
    const g = s.grid;
    const S = g.w / 48;
    for (let i = 0; i < g.size; i++) if (!(g.flags[i] & 1)) g.clearCell(i);
    s.score = 0;
    s.chain = 0;
    for (let x = 0; x < g.w; x++) for (let y = g.h - 4 * S; y < g.h; y++) g.set(x, y, 1);
    s.wake();
    s.runUntilSettled(400000);
    return { S, score: s.score, chain: s.bestChain };
  });
  check('puan: tek yol (192 g) = (192+100)×1 = 292', r1.score === 292, r1);
  // 2) Chain: the lower path clears, sand above falls into the hole and completes a second path.
  const r2 = await page.evaluate(() => {
    const s = window.__kum.session;
    const g = s.grid;
    const S = g.w / 48;
    for (let i = 0; i < g.size; i++) if (!(g.flags[i] & 1)) g.clearCell(i);
    s.score = 0;
    s.chain = 0;
    s.bestChain = 0;
    const B = 4 * S;
    for (let x = 0; x < g.w; x++) for (let y = g.h - B; y < g.h; y++) g.set(x, y, 1);
    for (let x = 0; x < g.w; x++) for (let y = g.h - 2 * B; y < g.h - B; y++) g.set(x, y, x >= 5 * B && x < 6 * B ? 1 : 3);
    for (let x = 5 * B; x < 6 * B; x++) for (let y = g.h - 3 * B; y < g.h - 2 * B; y++) g.set(x, y, 3);
    s.wake();
    s.runUntilSettled(400000);
    return { score: s.score, bestChain: s.bestChain };
  });
  check('zincir: düşen kum yeni yol kurunca Z=2', r2.bestChain >= 2, r2);
  // 3) Same-check double: two separate full rows -> Z and Z+1, largest first.
  const r3 = await page.evaluate(() => {
    const s = window.__kum.session;
    const g = s.grid;
    const S = g.w / 48;
    for (let i = 0; i < g.size; i++) if (!(g.flags[i] & 1)) g.clearCell(i);
    s.score = 0;
    s.chain = 0;
    for (let x = 0; x < g.w; x++) {
      for (let y = g.h - 4 * S; y < g.h; y++) g.set(x, y, 1); // 192 g
      for (let y = g.h - 6 * S; y < g.h - 4 * S; y++) g.set(x, y, 3); // 96 g
    }
    s.wake();
    let ev = null;
    const off = s.events.on((e) => {
      if (e.type === 'cleared' && !ev) ev = e;
    });
    s.runUntilSettled(400000);
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
    s.runUntilSettled(400000);
    return { afterDrop, afterSettle: s.chain };
  });
  check('zincir bırakışta sıfırlanmıyor, durulunca (yol yoksa) sıfırlanıyor', r4.afterDrop === 3 && r4.afterSettle === 0, r4);
  // 5) Chain cap ×5.
  const r5 = await page.evaluate(() => {
    const s = window.__kum.session;
    const g = s.grid;
    const S = g.w / 48;
    for (let i = 0; i < g.size; i++) if (!(g.flags[i] & 1)) g.clearCell(i);
    s.chain = 7;
    s.score = 0;
    for (let x = 0; x < g.w; x++) for (let y = g.h - 4 * S; y < g.h; y++) g.set(x, y, 1);
    s.wake();
    s.runUntilSettled(400000);
    return { score: s.score };
  });
  check('zincir tavanı ×5', r5.score === 292 * 5, r5);
  // 6) Bomb: grains removed by the blast score 1×Z and count for the grain goal (level 12: sumak).
  await H.startLevel(page, 12);
  const r6 = await page.evaluate(() => {
    const s = window.__kum.session;
    const g = s.grid;
    const S = g.w / 48;
    for (let i = 0; i < g.size; i++) if (!(g.flags[i] & 1)) g.clearCell(i);
    s.score = 0;
    s.chain = 0;
    s.goals.goals.forEach((q) => q.def.type !== 'clear_color_grains' && (q.target = 1e9));
    const goal = s.goals.goals.find((q) => q.def.type === 'clear_color_grains');
    if (goal) goal.target = 1e9;
    const before = goal ? goal.current : -1;
    for (let x = 0; x < g.w; x++) for (let y = g.h - 4 * S; y < g.h; y++) g.set(x, y, 1);
    for (let x = 0; x < g.w; x++) for (let y = g.h - 12 * S; y < g.h - 4 * S; y++) g.set(x, y, ((x / (4 * S)) | 0) % 2 ? 3 : 4);
    g.flags[(g.h - 2 * S) * g.w + 24 * S] |= 2; // bomb grain inside the bottom path
    s.wake();
    let bombEv = null;
    const off = s.events.on((e) => {
      if (e.type === 'bomb') bombEv = e;
    });
    s.runUntilSettled(400000);
    off();
    return { score: s.score, goalColor: goal && goal.def.color, before, after: goal ? goal.current : -1, bombGrains: bombEv && bombEv.grains };
  });
  check('bomba: patlama taneleri gram hedefine sayılıyor', r6.after > r6.before && r6.bombGrains > 0, r6);
  check('bomba puanı = yol + bomba tanesi×Z (±1 yuvarlama)', Math.abs(r6.score - (292 + r6.bombGrains)) <= 1, r6);
  // 7) Sieve (Elek): 10 design grains of colour 4 → 10 points, no multiplier, counts for the grain goal.
  const r7 = await page.evaluate(() => {
    const s = window.__kum.session;
    const g = s.grid;
    const S = g.w / 48;
    for (let i = 0; i < g.size; i++) if (!(g.flags[i] & 1)) g.clearCell(i);
    s.score = 0;
    s.chain = 4;
    for (let x = 0; x < 10 * S; x++) for (let y = g.h - S; y < g.h; y++) g.set(x, y, 4);
    const goal = s.goals.goals.find((q) => q.def.type === 'clear_color_grains');
    const before = goal.current;
    const n = s.sieveColor(4);
    return { n, score: s.score, gained: goal.current - before };
  });
  check('Elek: 1 puan/tane, çarpansız, gram hedefine sayılıyor', r7.score === 10 && r7.gained === 10, r7);
  // 8) Scoop: 1 block wide (4 design grains) × 10 grain rows = 40 g (joker included), statics untouched.
  const r8 = await page.evaluate(() => {
    const s = window.__kum.session;
    const g = s.grid;
    const S = g.w / 48;
    for (let i = 0; i < g.size; i++) if (!(g.flags[i] & 1)) g.clearCell(i);
    s.score = 0;
    for (let y = g.h - 10 * S; y < g.h; y++) for (let x = 0; x < g.w; x++) g.set(x, y, 1);
    g.set(10 * S, g.h - 5 * S, 15); // joker
    const n = s.scoopColumns(8 * S, 4 * S);
    return { n, score: s.score };
  });
  check('Kepçe: 1 blok × 10 satır = 40 g (joker dahil), 1 puan/tane', r8.score === 40, r8);
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
    s.dealt = s.placed;
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
    s.dealt = s.placed;
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
    s.runUntilSettled(400000);
    return { state: s.state, done: goal.current >= goal.target, left: s.piecesLeft };
  });
  check('Tezgâh bonusu puan hedefini tamamlamıyor', sb.state === 'playing' && !sb.done, sb);
  // Restart from the pause menu: is it a new attempt (different pieces, GDD §4.2)?
  await H.startLevel(page, 13);
  const seqA = await page.evaluate(() => {
    const s = window.__kum.session;
    return { tray: s.tray.map((t) => t && t.kind + t.color).join(','), attempts: (window.__app.save.level(13) || {}).attempts || 0 };
  });
  await page.click('[data-testid=pause]');
  await page.click('[data-testid=pause-restart]');
  await page.waitForTimeout(300);
  const seqB = await page.evaluate(() => {
    const s = window.__kum.session;
    return { tray: s.tray.map((t) => t && t.kind + t.color).join(','), attempts: (window.__app.save.level(13) || {}).attempts || 0 };
  });
  check('duraklat → yeniden başla yeni deneme sayılıyor (farklı kese dizisi)', seqA.tray !== seqB.tray || seqB.attempts > seqA.attempts, { seqA, seqB });
  check('konsol hatası yok', page.errors.length === 0, page.errors.slice(0, 5));
  await ctx.close();
};


// Sürükle-bırak hissi (commit 5f134c6: katı blok düşüş, FLAG_FALLING, SAND_REPOSE=2, hayalet).
sections.drop = async (browser) => {
  const { ctx, page } = await newPage(browser, VIEWPORTS[0]);
  await page.goto(`${BASE}?debug=1&nohowto&nodaily&unlockAll`);
  await page.waitForSelector('[data-testid=menu-levels]');
  await H.startLevel(page, 11);
  const clearBoard = () =>
    page.evaluate(() => {
      const s = window.__kum.session;
      const g = s.grid;
      for (let i = 0; i < g.size; i++) if (!(g.flags[i] & 1)) g.clearCell(i);
      s.goals.goals.forEach((q) => (q.target = 1e9));
      g.version++;
      s.wake();
      s.runUntilSettled(400000);
    });
  // Put a known piece (O, colour c) in slot 0 and select it.
  const setPiece = (kind = 'O', color = 1, rot = 0) =>
    page.evaluate(
      ([kind, color, rot]) => {
        const k = window.__kum;
        k.session.tray[0] = { kind, rot, color, color2: null, special: null, specialCell: -1, jokerCell: -1 };
        k.scene.sel = 0;
        k.scene.trayDirty = true;
      },
      [kind, color, rot],
    );
  const FALL = 128; // FLAG_FALLING
  // a) Release height follows the finger (top edge = finger − 64px lift − piece height).
  const heights = [];
  for (const fy of [0.15, 0.45, 0.75]) {
    await clearBoard();
    await setPiece('O', 1);
    const board = await page.locator('[data-testid=board]').boundingBox();
    await H.dragSlotToGrain(page, 0, 24, { ty: board.y + board.height * fy, hold: true });
    await page.waitForTimeout(120);
    const pre = await page.evaluate(() => ({ ghostY: window.__kum.scene.ghost.y, wantY: window.__kum.scene.wantY, floatOpacity: window.__kum.scene.dragEl.style.opacity }));
    if (fy === 0.45) await H.shot(page, 'drop-ghost-hold');
    await page.mouse.up();
    // Sample the first frame after release: where are the falling grains?
    const post = await page.evaluate((FALL) => {
      const g = window.__kum.session.grid;
      let top = -1;
      let n = 0;
      for (let i = 0; i < g.size; i++)
        if (g.flags[i] & FALL) {
          n++;
          if (top < 0) top = (i / g.w) | 0;
        }
      return { fallingTop: top, fallingGrains: n };
    }, FALL);
    heights.push({ fy, ...pre, ...post });
  }
  info('bırakma yüksekliği (parmak y oranı → hayalet/çıkış satırı)', heights);
  check('farklı yüksekliklerde bırakınca çıkış satırı parmağı izliyor', heights[0].wantY < heights[1].wantY && heights[1].wantY < heights[2].wantY, heights.map((h) => h.wantY));
  check('tahta üstünde yüzen kopya gizleniyor (hayalet tek gösterge)', heights.every((h) => h.floatOpacity === '0'), heights.map((h) => h.floatOpacity));
  // b) Rigid fall: the O stays an 8×8 square while falling, then turns to sand.
  await clearBoard();
  await setPiece('O', 1);
  const rigid = await page.evaluate((FALL) => {
    const s = window.__kum.session;
    const g = s.grid;
    const S = g.w / 48;
    s.drop(0, 20 * S, 0);
    const shapes = [];
    for (let t = 0; t < 80; t++) {
      s.tick();
      let minX = 1e9, maxX = -1, minY = 1e9, maxY = -1, n = 0;
      for (let i = 0; i < g.size; i++)
        if (g.flags[i] & FALL) {
          n++;
          const x = i % g.w, y = (i / g.w) | 0;
          minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y);
        }
      if (!n) break;
      shapes.push({ n, w: maxX - minX + 1, h: maxY - minY + 1 });
    }
    s.runUntilSettled(400000);
    let spreadOut = 0, total = 0;
    for (let i = 0; i < g.size; i++) if (g.color[i] === 1) { total++; const x = i % g.w; if (x < 20 * S || x >= 28 * S) spreadOut++; }
    return { S, ticksFalling: shapes.length, allSquare: shapes.every((q) => q.n === 64 * S * S && q.w === 8 * S && q.h === 8 * S), total, spreadOut };
  }, FALL);
  check('düşen kese katı blok kalıyor (2×2 blok, 64 g)', rigid.allSquare && rigid.ticksFalling > 0, rigid);
  info('düz zeminde yayılma (kese sütunları dışına taşan tane)', `${rigid.spreadOut}/${rigid.total}`);
  check('düz zeminde kayma sınırlı (≤ %25 tane kese sütunları dışında)', rigid.spreadOut / rigid.total <= 0.25, rigid);
  // c) Overhang: a shelf of sand with empty space below; aiming under it must stop on top.
  await clearBoard();
  await setPiece('O', 3);
  const tuck = await page.evaluate(() => {
    const s = window.__kum.session;
    const g = s.grid;
    const S = g.w / 48;
    for (let x = 16 * S; x < 32 * S; x++) for (let k = 0; k < S; k++) g.set(x, 40 * S + k, 255, 0, 1); // raf (static) row
    g.version++;
    const row = s.dropRow(0, 20 * S, 70 * S);
    s.drop(0, 20 * S, 70 * S);
    s.runUntilSettled(400000);
    let under = 0;
    for (let y = 41 * S; y < g.h; y++) for (let x = 16 * S; x < 32 * S; x++) if (g.get(x, y) === 3) under++;
    return { releaseRow: row, maxRow: 32 * S, grainsUnderShelf: under };
  });
  check('çıkıntı altına sokulamıyor (raf altına tane girmedi)', tuck.releaseRow <= tuck.maxRow && tuck.grainsUnderShelf === 0, tuck);
  // d) Drop onto flowing sand (real pointer): second drop while the first still moves.
  await clearBoard();
  await setPiece('O', 1);
  await H.dragSlotToGrain(page, 0, 12);
  const moving = await page.evaluate(() => !window.__kum.session.settled);
  await page.evaluate(() => {
    const k = window.__kum;
    const slot = k.session.tray.findIndex((t) => t);
    k.scene.sel = slot;
  });
  const slot2 = await page.evaluate(() => window.__kum.scene.sel);
  const placedBefore = await page.evaluate(() => window.__kum.session.placed);
  await H.dragSlotToGrain(page, slot2, 36);
  const placedAfter = await page.evaluate(() => window.__kum.session.placed);
  check('akan kuma (ilk kese hareket ederken) ikinci kese bırakılabiliyor', moving && placedAfter === placedBefore + 1, { moving, placedBefore, placedAfter });
  // e) Two pieces in the air: when the first lands, does the second lose its rigid flag mid-air?
  await clearBoard();
  const twin = await page.evaluate((FALL) => {
    const s = window.__kum.session;
    const g = s.grid;
    const O = (c) => ({ kind: 'O', rot: 0, color: c, color2: null, special: null, specialCell: -1, jokerCell: -1 });
    s.tray[0] = O(1);
    s.tray[1] = O(3);
    const S = g.w / 48;
    s.drop(0, 0, 60 * S); // released low → lands almost at once
    s.drop(1, 36 * S, 0); // released at the top → still high in the air
    let midAirLost = false;
    for (let t = 0; t < 120; t++) {
      s.tick();
      let fallA = 0, fallB = 0, bTop = 1e9;
      for (let i = 0; i < g.size; i++) {
        if (g.color[i] === 3) bTop = Math.min(bTop, (i / g.w) | 0);
        if (g.flags[i] & FALL) g.color[i] === 1 ? fallA++ : fallB++;
      }
      if (fallA === 0 && fallB === 0) {
        midAirLost = bTop < g.h - 8 * S - 1; // B was not on the floor yet
        return { tick: t, bTopWhenFlagsCleared: bTop, midAirLost };
      }
    }
    return { midAirLost };
  }, FALL);
  check('iki kese havadayken biri yere değince diğeri katılığını korumalı', !twin.midAirLost, twin);
  // f) Drop outside the board → back to the tray, no piece used.
  await clearBoard();
  await setPiece('O', 1);
  const before = await page.evaluate(() => ({ placed: window.__kum.session.placed, tray: !!window.__kum.session.tray[0] }));
  const sb = await page.locator('[data-testid=slot-0]').boundingBox();
  await page.mouse.move(sb.x + sb.width / 2, sb.y + sb.height / 2);
  await page.mouse.down();
  await page.mouse.move(sb.x + sb.width / 2, sb.y - 30, { steps: 4 });
  await page.mouse.move(2, 400, { steps: 6 }); // board edge? go far left outside the board
  const board = await page.locator('[data-testid=board]').boundingBox();
  await page.mouse.move(board.x - 6 > 0 ? board.x - 6 : 1, board.y + board.height + 30, { steps: 4 });
  await page.mouse.up();
  const after = await page.evaluate(() => ({ placed: window.__kum.session.placed, tray: !!window.__kum.session.tray[0], dragShown: window.__kum.scene.dragEl.classList.contains('show') }));
  check('tahta dışına bırakınca kese tepsiye dönüyor, hak harcanmıyor', after.placed === before.placed && after.tray && !after.dragShown, { before, after });
  // g) Stale release height: drag low over the board, leave the board, release; then keyboard drop.
  await clearBoard();
  await setPiece('O', 1);
  await H.dragSlotToGrain(page, 0, 24, { ty: board.y + board.height * 0.8, hold: true });
  await page.mouse.move(board.x + board.width / 2, board.y + board.height + 60, { steps: 4 });
  await page.mouse.up();
  const stale = await page.evaluate(() => window.__kum.scene.wantY);
  await page.keyboard.press('Space');
  const kb = await page.evaluate((FALL) => {
    const g = window.__kum.session.grid;
    for (let i = 0; i < g.size; i++) if (g.flags[i] & FALL) return (i / g.w) | 0;
    return -1;
  }, FALL);
  check('iptal edilen sürüklemeden sonra çıkış yüksekliği sıfırlanıyor (klavye/dokunma bırakışı tepeden)', stale === 0, { wantYAfterCancel: stale, keyboardDropTopRow: kb });
  // h) Piece dropped during a clear flash hangs in the air for the whole flash (sim paused).
  await clearBoard();
  const hang = await page.evaluate((FALL) => {
    const s = window.__kum.session;
    const g = s.grid;
    const S = g.w / 48;
    for (let x = 0; x < g.w; x++) for (let y = g.h - 4 * S; y < g.h; y++) g.set(x, y, 1);
    s.wake();
    while (!s.clearPending) s.tick();
    s.tray[0] = { kind: 'O', rot: 0, color: 3, color2: null, special: null, specialCell: -1, jokerCell: -1 };
    s.drop(0, 20 * S, 10 * S);
    const top0 = (() => { for (let i = 0; i < g.size; i++) if (g.flags[i] & FALL) return (i / g.w) | 0; return -1; })();
    let frozenTicks = 0;
    while (s.clearPending) { s.tick(); frozenTicks++; }
    const top1 = (() => { for (let i = 0; i < g.size; i++) if (g.flags[i] & FALL) return (i / g.w) | 0; return -1; })();
    return { top0, top1, frozenTicks, frozenMs: Math.round((frozenTicks * 1000) / 60) };
  }, FALL);
  info('patlama yanıp sönerken bırakılan kese havada donuyor', hang);
  // Repose: a 1-grain-deep hole next to a pile is never filled by sliding sand (SAND_REPOSE=2).
  await clearBoard();
  const repose = await page.evaluate(() => {
    const s = window.__kum.session;
    const g = s.grid;
    const S = g.w / 48;
    for (let x = 0; x < g.w; x++) if (x !== 30 * S) g.set(x, g.h - 1, 1);
    for (let x = 24 * S; x < 30 * S; x++) for (let y = g.h - 6 * S; y < g.h - 1; y++) g.set(x, y, 1);
    s.wake();
    s.runUntilSettled(400000);
    return { holeFilled: g.get(30 * S, g.h - 1) !== 0 };
  });
  info('SAND_REPOSE=2: yığının yanındaki 1 tane derinliğindeki boşluk kayan kumla dolmuyor (yol tamamlamayı etkiler)', repose);
  check('konsol hatası yok', page.errors.length === 0, page.errors.slice(0, 5));
  await ctx.close();
};


const SAVE_KEY = 'kumakisi.save.v1';
const lvl = (stars = 3) => ({ stars, best: 1000, completed: true, attempts: 1, lossStreak: 0 });
const progress = (n) => {
  const levels = {};
  for (let i = 1; i <= n; i++) levels[i] = lvl();
  return levels;
};
const forceWin = (page) =>
  page.evaluate(() => {
    const s = window.__kum.session;
    for (const g of s.goals.goals) g.current = g.target;
    s.wake();
  });
const forceLose = (page) =>
  page.evaluate(() => {
    const s = window.__kum.session;
    const g = s.grid;
    const [a, b] = s.level.colors;
    for (let y = 0; y < g.h; y++) for (let x = 0; x < g.w; x++) if (g.get(x, y) === 0) g.set(x, y, (x >> 2) % 2 ? a : b);
    s.wake();
  });

sections.flow = async (browser) => {
  const { ctx, page } = await newPage(browser, VIEWPORTS[0]);
  // First launch (GDD §15: goes straight into level 1).
  await page.goto(`${BASE}?debug=1&nohowto`);
  await page.evaluate(() => localStorage.clear());
  await page.goto(`${BASE}?debug=1&nohowto`);
  await page.waitForSelector('[data-testid=menu-play], [data-testid=board]');
  const first = (await page.locator('[data-testid=board]').count()) ? 'board' : 'menu';
  check('ilk açılışta doğrudan bölüm 1 (GDD §15)', first === 'board', `açılan: ${first}`);
  await H.shot(page, 'flow-01-first-launch');
  check('ilk açılışta günlük ödül çıkmıyor', (await page.locator('[data-testid=daily]').count()) === 0);
  check('ilk açılışta Serbest Tezgâh kilitli', await page.locator('[data-testid=menu-endless]').isDisabled());
  // "Nasıl oynanır?" card before level 1 (without the nohowto flag).
  {
    const { ctx: c2, page: p2 } = await newPage(browser, VIEWPORTS[0]);
    await p2.goto(`${BASE}?debug=1&nodaily`);
    await p2.evaluate(() => localStorage.clear());
    await p2.goto(`${BASE}?debug=1&nodaily`);
    await p2.waitForSelector('[data-testid=menu-play], [data-testid=board], [data-testid=howto-close]');
    if (await p2.locator('[data-testid=menu-play]').count()) await p2.click('[data-testid=menu-play]');
    const howto = await p2.waitForSelector('[data-testid=howto-close]', { timeout: 3000 }).then(() => true).catch(() => false);
    if (howto) {
      await p2.waitForTimeout(400);
      await H.shot(p2, 'flow-00-howto');
      await p2.click('[data-testid=howto-close]');
    }
    info('bölüm 1 öncesi "Nasıl oynanır?" kartı', howto ? 'gösterildi' : 'yok');
    await c2.close();
  }
  // Tutorials 1–3 through the real pointer path.
  for (const id of [1, 2, 3]) {
    if (id === 1) await page.click('[data-testid=menu-play]');
    await page.waitForSelector('[data-testid=board]');
    await page.waitForTimeout(500);
    if (await page.locator('[data-testid=intro-start]').count()) await page.click('[data-testid=intro-start]');
    const texts = [];
    for (let k = 0; k < 20; k++) {
      const st = await page.evaluate(() => window.__kum.session.state);
      if (st !== 'playing') break;
      const t = (await page.locator('[data-testid=tutorial-text]').textContent().catch(() => '')) || '';
      if (t && !texts.includes(t.trim())) texts.push(t.trim());
      await H.hintedMove(page);
      await page.waitForTimeout(150);
      await H.settle(page);
      await page.waitForTimeout(250);
    }
    const st = await page.evaluate(() => ({ state: window.__kum.session.state, placed: window.__kum.session.placed, score: window.__kum.session.score, stars: window.__kum.session.stars }));
    info(`öğretici ${id} metinleri`, texts);
    check(`bölüm ${id} (öğretici) ipucu hamleleriyle kazanılıyor`, st.state === 'won', st);
    await H.waitResult(page);
    await page.waitForTimeout(1500);
    await H.shot(page, `flow-02-won-${id}`);
    const gold = await page.locator('[data-testid=reward-gold]').textContent().catch(() => null);
    const expGold = [0, 20, 30, 40][st.stars];
    check(`bölüm ${id} ödül paneli ilk galibiyet altını (${st.stars}★ → ${expGold})`, gold && gold.includes(String(expGold)), gold);
    if (id < 3) await page.click('[data-testid=result-next]');
  }
  // Result → map.
  await page.click('[data-testid=result-levels]');
  await page.waitForSelector('[data-testid=map]');
  await page.waitForTimeout(400);
  await H.shot(page, 'flow-03-map-after-3');
  const stars = await page.locator('.star-total b').textContent();
  info('harita toplam yıldız', stars);
  check('harita: bölüm 4 açık, 5 kilitli', (await page.locator('[data-testid=level-4]').isEnabled()) && (await page.locator('[data-testid=level-5]').isDisabled()));
  // Level 4 intro → mechanic cards + booster bar appears.
  await page.click('[data-testid=level-4]');
  await page.waitForSelector('[data-testid=level-intro]');
  await page.waitForTimeout(400);
  await H.shot(page, 'flow-04-intro-4');
  const mech = await page.locator('[data-testid^=intro-]').evaluateAll((els) => els.map((e) => e.getAttribute('data-testid')));
  check('bölüm 4 tanıtım: scoreGoal + boosterShuffle kartları', mech.includes('intro-scoreGoal') && mech.includes('intro-boosterShuffle'), mech);
  await page.click('[data-testid=intro-start]');
  await page.waitForTimeout(300);
  check('bölüm 4: Yenile görünür, 2 hediye', ((await page.locator('[data-testid=booster-shuffle]').textContent()) || '').includes('2'));
  // Lose → free continue (level ≤ 5).
  await forceLose(page);
  await H.waitResult(page);
  await page.waitForTimeout(600);
  await H.shot(page, 'flow-05-lost-free-continue');
  await page.click('[data-testid=continue-free]');
  await page.waitForTimeout(300);
  const after = await page.evaluate(() => ({ state: window.__kum.session.state, left: window.__kum.session.piecesLeft }));
  check('ücretsiz devam sonrası oyun sürüyor', after.state === 'playing', after);
  // Pause: sound / haptics toggles.
  await page.click('[data-testid=pause]');
  await page.waitForSelector('[data-testid=pause-resume]');
  await H.shot(page, 'flow-06-pause');
  const toggles = await page.locator('.scene.overlay button').evaluateAll((els) => els.map((e) => e.getAttribute('aria-label') || e.textContent.trim()));
  info('duraklat düğmeleri', toggles);
  const soundBtn = page.locator('.scene.overlay button', { hasText: /Ses/ }).first();
  if (await soundBtn.count()) {
    await soundBtn.click();
    const v = await page.evaluate(() => window.__app.save.settings.sound);
    check('duraklat: ses kapat kaydediliyor', v === false);
    await soundBtn.click();
  }
  // Restart has no confirmation (GDD §15: "İlerleme kaybolacak").
  const placedBefore = await page.evaluate(() => window.__kum.session.placed);
  await page.click('[data-testid=pause-restart]');
  await page.waitForTimeout(300);
  const confirmShown = (await page.locator('[role=alertdialog], [data-testid*=confirm]').count()) > 0;
  check('Yeniden başla onay soruyor (GDD §15)', confirmShown, `onay yok; ${placedBefore} kese ilerleme sessizce silindi`);
  // Pause → exit to map: also no confirmation.
  await page.click('[data-testid=pause]');
  await page.click('[data-testid=pause-exit]');
  await page.waitForTimeout(300);
  check('Haritaya dön onay soruyor (GDD §15)', (await page.locator('[role=alertdialog], [data-testid*=confirm]').count()) > 0, 'onay yok');
  // Daily reward on the next menu entry (level 1 done).
  await page.goto(`${BASE}?debug=1&nohowto`);
  await page.waitForSelector('[data-testid=menu-play]');
  await page.waitForTimeout(400);
  const daily = await page.locator('[data-testid=daily]').count();
  check('günlük ödül: bölüm 1 sonrası menüde açılıyor', daily === 1);
  if (daily) {
    await H.shot(page, 'flow-07-daily');
    const g0 = await page.evaluate(() => window.__app.meta.economy.gold);
    await page.click('[data-testid=daily-claim]');
    await page.waitForTimeout(500);
    const g1 = await page.evaluate(() => window.__app.meta.economy.gold);
    check('günlük ödül 1. gün = 25 altın', g1 - g0 === 25, { g0, g1 });
    await page.goto(`${BASE}?debug=1&nohowto`);
    await page.waitForSelector('[data-testid=menu-play]');
    await page.waitForTimeout(300);
    check('günlük ödül aynı gün ikinci kez çıkmıyor', (await page.locator('[data-testid=daily]').count()) === 0);
  }
  // Shop: free gold rewarded ad (fake) → +30, then 3/day.
  await page.click('[data-testid=menu-shop]');
  await page.waitForSelector('[data-testid=shop]');
  const g2 = await page.evaluate(() => window.__app.meta.economy.gold);
  for (let i = 0; i < 4; i++) {
    const btn = page.locator('[data-testid=shop-free-gold]');
    if (await btn.isDisabled()) break;
    await btn.click();
    await page.waitForSelector('[data-testid=fake-ad-rewarded]', { timeout: 3000 }).catch(() => null);
    await page.waitForTimeout(1900);
  }
  const g3 = await page.evaluate(() => window.__app.meta.economy.gold);
  check('mağaza: bedava altın günde 3 × 30 = 90', g3 - g2 === 90, { g2, g3 });
  await H.shot(page, 'flow-08-shop-after-free');
  // Buying a booster with gold.
  const buyScoop = page.locator('[data-testid=shop-booster-shuffle]');
  if (await buyScoop.count()) {
    const b0 = await page.evaluate(() => ({ g: window.__app.meta.economy.gold, n: window.__app.save.economy.boosters.shuffle }));
    await buyScoop.click({ force: true });
    await page.waitForTimeout(300);
    const b1 = await page.evaluate(() => ({ g: window.__app.meta.economy.gold, n: window.__app.save.economy.boosters.shuffle }));
    check('mağaza: Yenile 100 altına alınıyor', b0.g - b1.g === 100 && b1.n === b0.n + 1, { b0, b1 });
  }
  await page.click('[data-testid=shop-close]', { force: true });
  // Endless unlock rule: level 8 won.
  await H.fresh(page, '?debug=1&nohowto&nodaily', { levels: progress(7) });
  check('sonsuz mod: bölüm 7 kazanılmışken kilitli', await page.locator('[data-testid=menu-endless]').isDisabled());
  await H.fresh(page, '?debug=1&nohowto&nodaily', { levels: progress(8) });
  check('sonsuz mod: bölüm 8 kazanılınca açık', await page.locator('[data-testid=menu-endless]').isEnabled());
  // Endless game over → result card with gold = floor(score/500) ≤ 30.
  await page.click('[data-testid=menu-endless]');
  await page.waitForSelector('[data-testid=board]');
  await page.evaluate(() => (window.__kum.session.score = 20000));
  await forceLose(page);
  await H.waitResult(page);
  await page.waitForTimeout(600);
  await H.shot(page, 'flow-09-endless-over');
  const eg = await page.locator('[data-testid=reward-gold]').textContent().catch(() => null);
  check('sonsuz ödül en fazla 30 altın', eg && /30/.test(eg), eg);
  check('sonsuz sonuçta "Devam et" teklifi yok', (await page.locator('[data-testid=continue-offer]').count()) === 0);
  // Back navigation (Escape = hardware back): play → pause → resume; map → menu; menu → (exit, no confirm).
  await page.goto(`${BASE}?debug=1&nohowto&nodaily&unlockAll`);
  await page.waitForSelector('[data-testid=menu-levels]');
  await H.startLevel(page, 5);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(200);
  const paused = await page.locator('[data-testid=pause-resume]').count();
  await page.keyboard.press('Escape');
  await page.waitForTimeout(200);
  const resumed = (await page.locator('[data-testid=pause-resume]').count()) === 0;
  check('geri: oyun → duraklat → devam', paused === 1 && resumed);
  check('konsol hatası yok', page.errors.length === 0, page.errors.slice(0, 5));
  await ctx.close();
};

sections.audio = async (browser) => {
  const { ctx, page } = await newPage(browser, VIEWPORTS[0]);
  await page.goto(`${BASE}?debug=1&nohowto&nodaily&unlockAll`);
  await page.waitForSelector('[data-testid=menu-levels]');
  await page.click('[data-testid=menu-levels]'); // user gesture → audio unlock
  const danger = async () => {
    await page.evaluate(() => {
      const s = window.__kum.session;
      const g = s.grid;
      const S = g.w / 48;
      for (let x = 0; x < 8 * S; x++) for (let y = 5 * S; y < 12 * S; y++) g.set(x, y, 255, 0, 1);
      g.set(2 * S, 4 * S, s.level.colors[0]);
      s.wake();
    });
    await page.waitForTimeout(700);
    return page.evaluate(() => window.__app.audio.dangerOn);
  };
  const dangerOn = () => page.evaluate(() => window.__app.audio.dangerOn);
  await H.startLevel(page, 10);
  check('tehlike döngüsü başlıyor', await danger());
  await page.click('[data-testid=pause]');
  await page.waitForTimeout(300);
  check('duraklatınca tehlike döngüsü duruyor', !(await dangerOn()), 'Duraklat ekranında "küt küt" sürüyor');
  await page.click('[data-testid=pause-exit]');
  await page.waitForTimeout(1500);
  check('duraklat → Bölümler (harita) sonrası döngü durmuş', !(await dangerOn()), 'harita ekranında tehlike sesi çalmaya devam ediyor');
  await page.click('[data-testid=level-btn], .level-btn.back', { timeout: 500 }).catch(() => {});
  await page.goto(`${BASE}?debug=1&nohowto&nodaily&unlockAll`);
  await page.waitForSelector('[data-testid=menu-levels]');
  await page.click('[data-testid=menu-levels]');
  await H.startLevel(page, 10);
  await danger();
  await page.click('[data-testid=pause]');
  await page.click('[data-testid=pause-restart]');
  await page.waitForTimeout(1500);
  const st = await page.evaluate(() => ({ dangerOn: window.__app.audio.dangerOn, sessionDanger: window.__kum.session.danger }));
  check('yeniden başla sonrası (tahta boş) tehlike döngüsü durmuş', !st.dangerOn, st);
  // After a lost→continue the danger state is not re-announced.
  await page.click('[data-testid=pause]').catch(() => {});
  await page.click('[data-testid=pause-resume]').catch(() => {});
  // Visibility hidden stops loops (webAudio.onHidden).
  await danger();
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await page.waitForTimeout(200);
  const hid = await page.evaluate(() => ({ dangerOn: window.__app.audio.dangerOn, paused: !!document.querySelector('[data-testid=pause-resume]') }));
  check('arka plana geçince döngüler duruyor ve oyun duraklıyor', !hid.dangerOn && hid.paused, hid);
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => false });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await page.click('[data-testid=pause-resume]');
  await page.waitForTimeout(1500);
  const back = await page.evaluate(() => ({ dangerOn: window.__app.audio.dangerOn, sessionDanger: window.__kum.session.danger }));
  check('ön plana dönüp devam edince tehlike hâlâ varsa döngü yeniden başlıyor', back.dangerOn === back.sessionDanger, back);
  check('konsol hatası yok', page.errors.length === 0, page.errors.slice(0, 5));
  await ctx.close();
};

sections.save = async (browser) => {
  const { ctx, page } = await newPage(browser, VIEWPORTS[0]);
  await H.fresh(page, '?debug=1&nohowto&nodaily&unlockAll');
  await H.startLevel(page, 2);
  await forceWin(page);
  await H.waitResult(page);
  await page.waitForTimeout(400);
  await page.goto(`${BASE}?debug=1&nohowto&nodaily&unlockAll`);
  await page.waitForSelector('[data-testid=menu-sound]');
  await page.click('[data-testid=menu-sound]');
  await page.click('[data-testid=menu-haptics]');
  await page.evaluate(() => window.__app.meta.economy.earn(777, 'qa'));
  const before = await page.evaluate(() => ({ gold: window.__app.meta.economy.gold, l2: window.__app.save.level(2), settings: { ...window.__app.save.settings } }));
  await page.waitForTimeout(200);
  await page.reload();
  await page.waitForSelector('[data-testid=menu-play]');
  const after = await page.evaluate(() => ({ gold: window.__app.meta.economy.gold, l2: window.__app.save.level(2), settings: { ...window.__app.save.settings } }));
  check('yenileme sonrası altın, ilerleme, yıldız, ayarlar korunuyor', JSON.stringify(before) === JSON.stringify(after), { before, after });
  // Write during play then reload immediately (coalesced async write).
  await H.startLevel(page, 3);
  await forceWin(page);
  await page.waitForTimeout(800); // END_DELAY
  await page.reload();
  await page.waitForSelector('[data-testid=menu-play]');
  const l3 = await page.evaluate(() => window.__app.save.level(3));
  check('kazandıktan hemen sonra yenileme: bölüm kaydı korunuyor', l3 && l3.completed, l3);
  // Corrupt saves.
  const junk = ['çöp{{{', 'null', '[]', '123', '{"levels":"x","settings":null,"economy":{"gold":-50,"boosters":"y"},"daily":7,"ads":{"interstitials":"z"}}', '{"levels":{"1":null,"2":{"completed":"yes","stars":"9"}},"economy":{"gold":"1e999"}}', '{"version":1,"seenIntros":[1,2],"tutorialsDone":{"a":1}}'];
  for (const j of junk) {
    const { ctx: c2, page: p2 } = await newPage(browser, VIEWPORTS[1]);
    await p2.goto(`${BASE}?debug=1&nohowto&nodaily`);
    await p2.evaluate(([k, v]) => localStorage.setItem(k, v), [SAVE_KEY, j]);
    await p2.goto(`${BASE}?debug=1&nohowto&nodaily`);
    const ok = await p2.waitForSelector('[data-testid=menu-play]', { timeout: 5000 }).then(() => true).catch(() => false);
    const st = ok ? await p2.evaluate(() => ({ gold: window.__app.meta.economy.gold, l2: window.__app.save.level(2) || null })) : null;
    let playable = false;
    if (ok) {
      await p2.click('[data-testid=menu-play]');
      playable = await p2.waitForSelector('[data-testid=board]', { timeout: 4000 }).then(() => true).catch(() => false);
    }
    check(`bozuk kayıt açılıyor: ${j.slice(0, 40)}`, ok && playable && p2.errors.length === 0, { st, errors: p2.errors.slice(0, 2) });
    if (st && st.l2) info('bozuk kayıt onarımı (bölüm 2)', st.l2);
    await c2.close();
  }
  // localStorage throwing (private mode / blocked).
  {
    const { ctx: c3, page: p3 } = await newPage(browser, VIEWPORTS[1]);
    await c3.addInitScript(() => {
      Storage.prototype.getItem = () => {
        throw new Error('blocked');
      };
      Storage.prototype.setItem = () => {
        throw new Error('blocked');
      };
    });
    await p3.goto(`${BASE}?debug=1&nohowto&nodaily`);
    const ok = await p3.waitForSelector('[data-testid=menu-play]', { timeout: 5000 }).then(() => true).catch(() => false);
    check('localStorage engelliyken oyun açılıyor', ok, p3.errors.slice(0, 2));
    await c3.close();
  }
  check('konsol hatası yok', page.errors.length === 0, page.errors.slice(0, 5));
  await ctx.close();
};

sections.robust = async (browser) => {
  const { ctx, page } = await newPage(browser, VIEWPORTS[0]);
  await page.goto(`${BASE}?debug=1&nohowto&nodaily&unlockAll`);
  await page.waitForSelector('[data-testid=menu-levels]');
  await H.startLevel(page, 11);
  // Rapid taps on the selected slot (rotate spam).
  const sb = await page.locator('[data-testid=slot-0]').boundingBox();
  const rot0 = await page.evaluate(() => window.__kum.session.tray[0].rot);
  for (let i = 0; i < 25; i++) await page.mouse.click(sb.x + sb.width / 2, sb.y + sb.height / 2, { delay: 5 });
  await page.waitForTimeout(200);
  const rot1 = await page.evaluate(() => window.__kum.session.tray[0].rot);
  info('25 hızlı dokunuş sonrası dönüş (beklenen (rot0+24 veya 25)%4)', { rot0, rot1 });
  check('hızlı dokunuşta hata yok', page.errors.length === 0, page.errors.slice(0, 3));
  // Rapid drags: three pieces dropped back-to-back.
  const p0 = await page.evaluate(() => window.__kum.session.placed);
  for (const x of [6, 24, 42]) {
    const slot = await page.evaluate(() => window.__kum.session.tray.findIndex((t) => t));
    if (slot < 0) break;
    await H.dragSlotToGrain(page, slot, x, { steps: 3 });
  }
  const p1 = await page.evaluate(() => window.__kum.session.placed);
  info('art arda 3 hızlı sürükle-bırak', `${p1 - p0} kese yerleşti`);
  // Multi-touch: finger A drags slot 0, finger B taps slot 1 meanwhile.
  const cdp = await ctx.newCDPSession(page);
  await H.settle(page);
  const before = await page.evaluate(() => ({ placed: window.__kum.session.placed, tray: window.__kum.session.tray.map((t) => !!t) }));
  const s0 = await page.locator('[data-testid=slot-0]').boundingBox();
  const s1 = await page.locator('[data-testid=slot-1]').boundingBox();
  const board = await page.locator('[data-testid=board]').boundingBox();
  const A = (x, y) => ({ x, y, id: 1 });
  const B = (x, y) => ({ x, y, id: 2 });
  const c0 = [s0.x + s0.width / 2, s0.y + s0.height / 2];
  const c1 = [s1.x + s1.width / 2, s1.y + s1.height / 2];
  const send = (type, pts) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts });
  await send('touchStart', [A(...c0)]);
  await send('touchMove', [A(c0[0], c0[1] - 60)]);
  await send('touchStart', [A(c0[0], c0[1] - 60), B(...c1)]);
  await send('touchMove', [A(board.x + board.width * 0.3, board.y + board.height * 0.3), B(c1[0], c1[1] - 120)]);
  await send('touchMove', [A(board.x + board.width * 0.3, board.y + board.height * 0.3), B(board.x + board.width * 0.8, board.y + board.height * 0.3)]);
  await send('touchEnd', [A(board.x + board.width * 0.3, board.y + board.height * 0.3)]);
  await send('touchEnd', []);
  await page.waitForTimeout(300);
  const after = await page.evaluate(() => ({ placed: window.__kum.session.placed, tray: window.__kum.session.tray.map((t) => !!t), dragShown: window.__kum.scene.dragEl.classList.contains('show') }));
  check('çoklu dokunuş: yalnızca bir kese yerleşiyor, sürükleme görseli takılı kalmıyor', after.placed - before.placed <= 1 && !after.dragShown, { before, after });
  // Pointer cancel mid-drag (e.g. system gesture): drag image must disappear.
  await H.settle(page);
  const s2 = await page.evaluate(() => window.__kum.session.tray.findIndex((t) => t));
  const bb = await page.locator(`[data-testid=slot-${s2}]`).boundingBox();
  await send('touchStart', [A(bb.x + bb.width / 2, bb.y + bb.height / 2)]);
  await send('touchMove', [A(bb.x + bb.width / 2, bb.y - 80)]);
  await send('touchCancel', []);
  await page.waitForTimeout(200);
  check('pointercancel sonrası sürüklenen kese kayboluyor', !(await page.evaluate(() => window.__kum.scene.dragEl.classList.contains('show'))));
  // Window resize mid-game.
  const w0 = await page.evaluate(() => document.querySelector('[data-testid=board]').getBoundingClientRect().width);
  await page.setViewportSize({ width: 360, height: 640 });
  await page.waitForTimeout(400);
  const r1 = await page.evaluate(() => {
    const b = document.querySelector('[data-testid=board]').getBoundingClientRect();
    return { w: b.width, h: b.height, bottom: b.bottom, vh: innerHeight, sx: document.documentElement.scrollWidth };
  });
  await H.shot(page, 'robust-resize-360x640');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(400);
  const w2 = await page.evaluate(() => document.querySelector('[data-testid=board]').getBoundingClientRect().width);
  check('pencere boyutu değişince tahta yeniden ölçekleniyor', r1.w !== w0 && Math.abs(w2 - w0) < 1 && r1.sx <= 360, { w0, r1, w2 });
  // Drag over the edge of the screen and release outside the window.
  await H.settle(page);
  const s3 = await page.evaluate(() => window.__kum.session.tray.findIndex((t) => t));
  const before3 = await page.evaluate(() => window.__kum.session.placed);
  const b3 = await page.locator(`[data-testid=slot-${s3}]`).boundingBox();
  await page.mouse.move(b3.x + 20, b3.y + 20);
  await page.mouse.down();
  await page.mouse.move(b3.x + 20, 300, { steps: 5 });
  await page.mouse.move(-50, 300, { steps: 5 });
  await page.mouse.up();
  await page.waitForTimeout(200);
  const after3 = await page.evaluate(() => ({ placed: window.__kum.session.placed, drag: window.__kum.scene.dragEl.classList.contains('show') }));
  check('ekran dışına bırakma: kese harcanmıyor, görsel takılmıyor', after3.placed === before3 && !after3.drag, { before3, after3 });
  // Double tap on "Sonraki bölüm".
  await forceWin(page);
  await H.waitResult(page);
  await page.waitForTimeout(400);
  await page.locator('[data-testid=result-next]').dblclick().catch(() => {});
  await page.waitForTimeout(800);
  const depth = await page.evaluate(() => ({ depth: window.__app.scenes.depth, ends: window.__app.save.ads.levelEnds }));
  check('Sonraki bölüme çift dokunuş tek geçiş/tek bölüm sonu sayıyor', depth.depth <= 2 && depth.ends === 1, depth);
  // Pause during a drag.
  if (await page.locator('[data-testid=intro-start]').count()) await page.click('[data-testid=intro-start]');
  await H.settle(page);
  const s4 = await page.evaluate(() => window.__kum.session.tray.findIndex((t) => t));
  await H.dragSlotToGrain(page, s4, 24, { hold: true });
  await page.keyboard.press('Escape');
  await page.mouse.up();
  await page.waitForTimeout(200);
  const pd = await page.evaluate(() => ({ paused: !!document.querySelector('[data-testid=pause-resume]'), drag: window.__kum.scene.dragEl.classList.contains('show') }));
  check('sürüklerken duraklat: sürükleme iptal, kese yerleşmiyor', pd.paused && !pd.drag, pd);
  check('konsol hatası yok', page.errors.length === 0, page.errors.slice(0, 5));
  await ctx.close();
};

sections.ads = async (browser) => {
  const { ctx, page } = await newPage(browser, VIEWPORTS[0]);
  await ctx.addInitScript(() => {
    const real = Date.now.bind(Date);
    Date.now = () => real() + (Number(localStorage.getItem('qa.clockOffset')) || 0);
  });
  const setOffset = (ms) => page.evaluate((ms) => localStorage.setItem('qa.clockOffset', String(ms)), ms);
  let offset = 0;
  const advance = async (ms) => {
    offset += ms;
    await setOffset(offset);
  };
  // In-app navigation only (a reload would restart the app session, rule 5).
  const enterFromMap = async (id) => {
    if (!(await page.locator('[data-testid=map]').count())) {
      await page.click('[data-testid=menu-levels]');
      await page.waitForSelector('[data-testid=map]');
    }
    await page.locator(`[data-testid=level-${id}]`).scrollIntoViewIfNeeded();
    await page.click(`[data-testid=level-${id}]`);
    await page.waitForSelector('[data-testid=board]');
    await page.waitForTimeout(150);
    if (await page.locator('[data-testid=intro-start]').count()) await page.click('[data-testid=intro-start]');
  };
  const playAndLeave = async (id, how = 'levels', result = 'win') => {
    if (!(await page.locator('[data-testid=board]').count()) || !(await page.evaluate((id) => window.__kum && window.__kum.session.level.id === id && window.__kum.session.isPlaying, id))) await enterFromMap(id);
    if (result === 'win') await forceWin(page);
    else await forceLose(page);
    await H.waitResult(page);
    await page.waitForTimeout(250);
    await page.click(`[data-testid=${how === 'retry' ? 'result-retry' : 'result-levels'}]`);
    const shown = await page.waitForSelector('[data-testid=fake-ad-interstitial]', { timeout: 1200 }).then(() => true).catch(() => false);
    if (shown) await page.waitForTimeout(1800);
    if (how === 'retry') {
      await page.waitForSelector('[data-testid=board]');
      await page.waitForTimeout(150);
    } else await page.waitForSelector('[data-testid=map]');
    const dec = await page.evaluate(() => window.__app.meta.ads.lastDecision);
    return { shown, reason: dec && dec.reason, ends: await page.evaluate(() => window.__app.save.ads.levelEnds) };
  };
  // Fresh player before level 8 is won → never.
  await H.fresh(page, '?debug=1&nohowto&nodaily&unlockAll', { levels: progress(3) });
  await setOffset(0);
  let r;
  const seq = [];
  for (const id of [4, 5, 6, 7]) seq.push(await playAndLeave(id));
  check('bölüm 8 kazanılmadan geçiş reklamı yok', seq.every((x) => !x.shown), seq.map((x) => x.reason));
  // Level 8 won on this end: still locked (must be won BEFORE).
  r = await playAndLeave(8);
  check('bölüm 8 sonunda reklam yok (kural: 8 önceden kazanılmış olmalı)', !r.shown && r.reason === 'locked', r);
  // Session < 3 min.
  r = await playAndLeave(9);
  check('oturum < 3 dk iken reklam yok', !r.shown && r.reason === 'session', r);
  await advance(181_000);
  r = await playAndLeave(10);
  check('tüm koşullar sağlanınca geçiş reklamı gösteriliyor', r.shown, r);
  // Right after: level gap.
  r = await playAndLeave(12);
  check('reklam sonrası < 3 bölüm sonu → yok', !r.shown && r.reason === 'level_gap', r);
  r = await playAndLeave(13);
  r = await playAndLeave(14);
  check('3 bölüm sonu ama < 90 sn → yok (cooldown)', !r.shown && r.reason === 'cooldown', r);
  await advance(91_000);
  r = await playAndLeave(15);
  check('90 sn sonra gösteriliyor', r.shown, r);
  // Retry never shows.
  for (let k = 0; k < 3; k++) await playAndLeave(16, 'retry', 'lose');
  await advance(91_000);
  r = await playAndLeave(16, 'retry', 'lose');
  check('"Tekrar dene" geçişinde asla yok', !r.shown, r);
  // Frustration: 3+ losses in a row on this level, then leaving to the map.
  r = await playAndLeave(16, 'levels', 'lose');
  check('aynı bölümde art arda 3 kayıp → haritaya geçişte yok', !r.shown && r.reason === 'frustration', r);
  // Hourly cap: 2 shown so far within the hour; show 2 more then expect cap.
  let shownCount = 2;
  for (let k = 0; k < 6 && shownCount < 4; k++) {
    await advance(91_000);
    for (let j = 0; j < 2; j++) await playAndLeave(17);
    await advance(91_000);
    r = await playAndLeave(18);
    if (r.shown) shownCount++;
  }
  await advance(91_000);
  for (let j = 0; j < 3; j++) await playAndLeave(19);
  r = await playAndLeave(19);
  const inter = await page.evaluate(() => window.__app.save.ads.interstitials.length);
  check('saatte en fazla 4 geçiş reklamı', !r.shown && r.reason === 'hourly_cap', { r, shownCount, inter, offsetMin: Math.round(offset / 60000) });
  // Remove ads → never.
  await page.evaluate(() => {
    window.__app.save.economy.noAds = true;
    window.__app.save.commit();
  });
  await advance(3_600_000);
  for (let j = 0; j < 3; j++) await playAndLeave(20);
  r = await playAndLeave(21);
  check('Reklamları Kaldır sonrası geçiş reklamı yok', !r.shown && r.reason === 'no_ads', r);
  check('konsol hatası yok', page.errors.length === 0, page.errors.slice(0, 5));
  await ctx.close();
};

sections.perf = async () => {
  const secs = Number(process.env.QA_PERF_SEC || 180);
  const browser = await chromium.launch({ args: ['--enable-precise-memory-info', '--js-flags=--expose-gc'] });
  const { ctx, page } = await newPage(browser, VIEWPORTS[0]);
  await H.fresh(page, '?debug=1&nohowto&nodaily&unlockAll');
  await page.click('[data-testid=menu-endless]');
  await page.waitForSelector('[data-testid=board]');
  const res = await page.evaluate(async (secs) => {
    const frames = [];
    const samples = [];
    let games = 0;
    let moves = 0;
    let maxScore = 0;
    let last = performance.now();
    const t0 = last;
    const mem = () => (performance.memory ? performance.memory.usedJSHeapSize : null);
    const nodes = () => document.getElementsByTagName('*').length;
    let lastMove = 0;
    let lastSample = 0;
    await new Promise((resolve) => {
      const step = (now) => {
        frames.push(now - last);
        last = now;
        const k = window.__kum;
        if (k && k.session) {
          const s = k.session;
          if (s.isPlaying && now - lastMove > 280) {
            lastMove = now;
            // Cheap scripted mover (the hint search itself is measured separately below,
            // it must not pollute the game's frame times).
            const slot = s.tray.findIndex((t) => t);
            if (slot >= 0) {
              const p = s.tray[slot];
              p.rot = (moves * 7) & 3;
              const w = s.grid.w;
              for (let t = 0; t < 12; t++) {
                const x = Math.floor(((moves * 5 + t * 7) % 12) * (w / 12));
                if (s.canDrop(slot, x) && s.drop(slot, x)) {
                  moves++;
                  break;
                }
              }
            }
            maxScore = Math.max(maxScore, s.score);
          } else if (!s.isPlaying) {
            const retry = document.querySelector('[data-testid=result-retry]');
            if (retry) {
              games++;
              retry.click();
            }
          }
        }
        if (now - lastSample > 10000) {
          lastSample = now;
          samples.push({ t: Math.round((now - t0) / 1000), heapMB: mem() && +(mem() / 1048576).toFixed(1), nodes: nodes(), particles: document.querySelectorAll('.fx-float').length });
        }
        if (now - t0 < secs * 1000) requestAnimationFrame(step);
        else resolve();
      };
      requestAnimationFrame(step);
    });
    frames.shift();
    const sorted = [...frames].sort((a, b) => a - b);
    const avg = frames.reduce((a, b) => a + b, 0) / frames.length;
    return {
      secs,
      frames: frames.length,
      avgMs: +avg.toFixed(2),
      p95Ms: +sorted[Math.floor(sorted.length * 0.95)].toFixed(2),
      p99Ms: +sorted[Math.floor(sorted.length * 0.99)].toFixed(2),
      maxMs: +sorted[sorted.length - 1].toFixed(1),
      over33: frames.filter((f) => f > 33.4).length,
      games,
      moves,
      maxScore,
      samples,
    };
  }, secs);
  info('sonsuz mod performans', { ...res, samples: undefined });
  // Cost of the hint search (tutorial hand uses it on the main thread).
  const hintCost = await page.evaluate(() => {
    const k = window.__kum;
    const t = [];
    for (let i = 0; i < 5; i++) {
      const t0 = performance.now();
      k.hint();
      t.push(performance.now() - t0);
    }
    return { ms: t.map((x) => +x.toFixed(1)), grid: `${k.session.grid.w}x${k.session.grid.h}` };
  });
  info('ipucu (findHintMove) süresi / çağrı', hintCost);
  check('ipucu araması tek karede ≤ 50 ms (öğretici el işareti ana iş parçacığında)', Math.max(...hintCost.ms) <= 50, hintCost);
  info('örnekler (10 sn)', res.samples);
  const first = res.samples[1] || res.samples[0];
  const lastS = res.samples[res.samples.length - 1];
  check('kare süresi ort. ≤ 17.5 ms (60 fps, headless yazılım çizimi)', res.avgMs <= 17.5, res.avgMs);
  check('kare süresi p95 ≤ 25 ms', res.p95Ms <= 25, res.p95Ms);
  check('DOM düğüm sayısı büyümüyor (≤ +15%)', lastS.nodes <= first.nodes * 1.15, { first: first.nodes, last: lastS.nodes });
  if (first.heapMB) check('JS heap büyümesi ≤ 10 MB', lastS.heapMB - first.heapMB <= 10, { first: first.heapMB, last: lastS.heapMB });
  check('konsol hatası yok', page.errors.length === 0, page.errors.slice(0, 5));
  await ctx.close();
  await browser.close();
};

sections.a11y = async (browser) => {
  const { ctx, page } = await newPage(browser, VIEWPORTS[0], { reducedMotion: 'reduce' });
  await page.goto(`${BASE}?debug=1&nohowto&nodaily&unlockAll`);
  await page.waitForSelector('[data-testid=menu-levels]');
  await H.startLevel(page, 30);
  const chips = await page.evaluate(() => [...document.querySelectorAll('.goal-chip')].map((c) => ({ spice: c.classList.contains('spice'), svg: !!c.querySelector('svg') })));
  check('hedef çiplerinde renk körü sembolü (renkli hedef → SVG sembol)', chips.filter((c) => c.spice).every((c) => c.svg) && chips.some((c) => c.spice), chips);
  // Tray symbols: render one slot big and look for symbol-coloured pixels inside the block (canvas).
  const box = await page.locator('[data-testid=slot-0]').boundingBox();
  await page.screenshot({ path: path.join(OUT, 'qa1-a11y-tray-symbols.png'), clip: { x: 0, y: box.y - 4, width: 390, height: box.height + 8 } });
  const anim = await page.evaluate(() => {
    const live = (e) => {
      const cs = getComputedStyle(e);
      return cs.animationName !== 'none' && cs.animationName !== 'fade' && cs.animationDuration.split(',').some((d) => parseFloat(d) > 0.02);
    };
    const cls = (e) => (e.className && e.className.baseVal !== undefined ? e.className.baseVal : String(e.className)).split(' ')[0];
    return [...document.querySelectorAll('*')].filter(live).map((e) => `${e.tagName.toLowerCase()}.${cls(e)}:${getComputedStyle(e).animationName} ${getComputedStyle(e).animationDuration} ×${getComputedStyle(e).animationIterationCount}`).slice(0, 10);
  });
  check('prefers-reduced-motion: oyun ekranında CSS animasyonu yok', anim.length === 0, anim);
  const shake = await page.evaluate(() => window.__kum.scene.fx.reduce);
  check('prefers-reduced-motion: sarsıntı kapalı (JS)', shake === true, shake);
  await page.goto(`${BASE}?debug=1&nohowto&nodaily&unlockAll`);
  await page.waitForSelector('[data-testid=menu-levels]');
  const animMenu = await page.evaluate(() => {
    const live = (e) => {
      const cs = getComputedStyle(e);
      return cs.animationName !== 'none' && cs.animationName !== 'fade' && cs.animationDuration.split(',').some((d) => parseFloat(d) > 0.02);
    };
    const cls = (e) => (e.className && e.className.baseVal !== undefined ? e.className.baseVal : String(e.className)).split(' ')[0];
    return [...document.querySelectorAll('*')].filter(live).map((e) => `${e.tagName.toLowerCase()}.${cls(e)}:${getComputedStyle(e).animationName} ${getComputedStyle(e).animationDuration} ×${getComputedStyle(e).animationIterationCount}`).slice(0, 10);
  });
  check('prefers-reduced-motion: menüde CSS animasyonu yok', animMenu.length === 0, animMenu);
  // Contrast of key token pairs.
  const pairs = await page.evaluate(() => {
    const css = getComputedStyle(document.documentElement);
    const v = (n) => css.getPropertyValue(n).trim();
    const rgb = (hex) => {
      const m = hex.replace('#', '');
      const n = m.length === 3 ? m.split('').map((c) => c + c).join('') : m;
      return [0, 2, 4].map((i) => parseInt(n.slice(i, i + 2), 16) / 255);
    };
    const lum = (hex) => {
      const [r, g, b] = rgb(hex).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
      return 0.2126 * r + 0.7152 * g + 0.0722 * b;
    };
    const ratio = (a, b) => {
      const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
      return +((x + 0.05) / (y + 0.05)).toFixed(2);
    };
    const list = [
      ['--fg', '--bg', 'gövde metni'],
      ['--muted', '--panel', 'ikincil metin (kart)'],
      ['--faint', '--bg', 'sürüm / soluk metin'],
      ['--parchment-muted', '--parchment', 'HUD sipariş başlığı (9.6px)'],
      ['--parchment-ink', '--parchment', 'sipariş satırları'],
      ['--on-accent', '--accent', 'birincil düğme'],
      ['--muted', '--bg', 'PARÇA / PUAN etiketleri'],
    ];
    return list.map(([a, b, use]) => ({ use, fg: v(a), bg: v(b), ratio: ratio(v(a), v(b)) }));
  });
  for (const p of pairs) check(`kontrast ≥ 4.5: ${p.use} (${p.fg} / ${p.bg})`, p.ratio >= 4.5, p.ratio);
  check('konsol hatası yok', page.errors.length === 0, page.errors.slice(0, 5));
  await ctx.close();
};

sections.balance = async (browser) => {
  const tries = Number(process.env.QA_TRIES || 3);
  const { ctx, page } = await newPage(browser, { width: 390, height: 844, dpr: 1 });
  await H.fresh(page, '?debug=1&nohowto&nodaily&unlockAll', { tutorialsDone: ['t1', 't2', 't3'], seenIntros: ['scoreGoal', 'boosterShuffle', 'colorPath', 'bomb', 'grains', 'boosterScoop', 'shelf', 'newColorSumac', 'boosterSieve', 'joker', 'sack', 'twoColor', 'newColorIndigo'] });
  const levels = await page.evaluate(() => [...Array(30)].map((_, i) => i + 1));
  const table = [];
  for (const id of levels) {
    const row = { id, wins: 0, tries, scores: [], used: [], reasons: [], readyPath: false, limit: null };
    for (let t = 0; t < tries; t++) {
      await H.startLevel(page, id, '?debug=1&nohowto&nodaily&unlockAll');
      if (t === 0) {
        row.readyPath = await page.evaluate(() => {
          const s = window.__kum.session;
          s.runUntilSettled(400000);
          return s.score > 0;
        });
        row.limit = await page.evaluate(() => window.__kum.session.level.pieceLimit);
      }
      const r = await H.botPlay(page, 80);
      if (r.state === 'won') row.wins++;
      row.scores.push(r.score);
      row.used.push(r.placed);
      if (r.state !== 'won') row.reasons.push(r.reason || r.state);
      // Record the attempt so the next try uses the next attempt seed (like a real retry).
      await page.waitForTimeout(750);
      await page.goto(`${BASE}?debug=1&nohowto&nodaily&unlockAll`);
    }
    table.push(row);
    console.log(`  bölüm ${String(id).padStart(2)}: ${row.wins}/${tries} kazandı, parça ${row.used.join('/')} / ${row.limit}, puan ${row.scores.join('/')}${row.reasons.length ? ', kayıp: ' + row.reasons.join(',') : ''}${row.readyPath ? ' — BAŞLANGIÇTA HAZIR YOL' : ''}`);
  }
  info('denge tablosu (hint botu, ön değerlendirme)', table);
  check('hiçbir bölüm başlangıçta hazır yol içermiyor', table.every((r) => !r.readyPath), table.filter((r) => r.readyPath).map((r) => r.id));
  check('öğretici bölümler 1–3 bot ile her denemede kazanılıyor', table.slice(0, 3).every((r) => r.wins === r.tries), table.slice(0, 3).map((r) => `${r.id}:${r.wins}/${r.tries}`));
  const zero = table.filter((r) => r.wins === 0).map((r) => r.id);
  info('botun hiç kazanamadığı bölümler (insan için zor/imkânsız adayı)', zero);
  fs.writeFileSync(path.join(OUT, 'qa-balance.json'), JSON.stringify(table, null, 2));
  // Random-move player on tutorials: can they be lost?
  const rnd = [];
  for (const id of [1, 2, 3]) {
    let losses = 0;
    for (let t = 0; t < 10; t++) {
      await H.startLevel(page, id, '?debug=1&nohowto&nodaily&unlockAll');
      const r = await page.evaluate((seed) => {
        let x = seed * 9301 + 49297;
        const rand = () => ((x = (x * 9301 + 49297) % 233280) / 233280);
        const s = window.__kum.session;
        let n = 0;
        while (s.isPlaying && n < 60) {
          const slots = s.tray.map((p, i) => (p ? i : -1)).filter((i) => i >= 0);
          if (!slots.length) break;
          const slot = slots[Math.floor(rand() * slots.length)];
          s.tray[slot].rot = Math.floor(rand() * 4);
          const ok = s.drop(slot, Math.floor(rand() * 45));
          if (!ok) s.drop(slot, Math.floor(rand() * 40));
          s.runUntilSettled(400000);
          n++;
        }
        return s.state;
      }, t + id * 10);
      if (r === 'lost') losses++;
      await page.goto(`${BASE}?debug=1&nohowto&nodaily&unlockAll`);
    }
    rnd.push({ id, randomLosses: `${losses}/10` });
  }
  info('rastgele oyuncu öğretici bölümlerde', rnd);
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
