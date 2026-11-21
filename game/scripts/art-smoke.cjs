// Art pass smoke test (Playwright): screenshots of every screen in two phone sizes
// (390×844 @3x, 360×740 @2x) plus a board frame-time measurement.
//   menu, map, intro card, tutorial (dim + hand), drag, path burst, Çifte/zincir word +
//   Zerde sneeze, danger, sack / joker / two-colour / bomb levels, pause, won, lost.
// Usage: npm run build && npx vite preview --port 4173 &
//        NODE_PATH=$(npm root -g) node scripts/art-smoke.cjs <screenshotDir> [baseUrl]
// Files: <dir>/wave2b-art-<w>x<h>-NN-name.png. Exits non-zero on console/page errors.
const { chromium } = require('playwright');
const OUT = process.argv[2] || '.';
const BASE = process.argv[3] || 'http://localhost:4173/';
const VIEWPORTS = [
  { width: 390, height: 844, dpr: 3 },
  { width: 360, height: 740, dpr: 2 },
];

async function run(browser, vp) {
  const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, deviceScaleFactor: vp.dpr, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(`error: ${m.text()}`); });
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  const tag = `${vp.width}x${vp.height}`;
  const shot = (name) => page.screenshot({ path: `${OUT}/wave2b-art-${tag}-${name}.png` });
  const log = (...a) => console.log(`[${tag}]`, ...a);
  const settle = async () => {
    for (let i = 0; i < 80; i++) {
      const ok = await page.evaluate(() => { const s = window.__kum.session; return !s.isPlaying || (s.settled && !s.clearPending); });
      if (ok) return;
      await page.waitForTimeout(100);
    }
  };
  const openLevel = async (id) => {
    await page.goto(`${BASE}?debug=1&nodaily&unlockAll`);
    await page.waitForSelector('[data-testid=menu-levels]');
    await page.click('[data-testid=menu-levels]');
    await page.waitForSelector(`[data-testid=level-${id}]`);
    await page.click(`[data-testid=level-${id}]`);
    await page.waitForSelector('[data-testid=board]');
  };
  const startLevel = async (id, introShot) => {
    await openLevel(id);
    if (await page.locator('[data-testid=intro-start]').count()) {
      await page.waitForTimeout(400);
      if (introShot) await shot(introShot);
      await page.click('[data-testid=intro-start]');
    }
    await page.waitForTimeout(300);
  };
  async function dragSlotToGrain(slot, grainCenterX, hold = false) {
    const s = await page.locator(`[data-testid=slot-${slot}]`).boundingBox();
    const board = await page.locator('[data-testid=board]').boundingBox();
    const tx = board.x + (grainCenterX / 48) * board.width;
    const ty = board.y + board.height * 0.25;
    const sx = s.x + s.width / 2, sy = s.y + s.height / 2;
    await page.mouse.move(sx, sy);
    await page.mouse.down();
    for (let i = 1; i <= 10; i++) await page.mouse.move(sx + ((tx - sx) * i) / 10, sy + ((ty - sy) * i) / 10);
    if (!hold) await page.mouse.up();
  }
  const widthOf = (m) => page.evaluate((m) => { const p = window.__kum.session.tray[m.slot]; return p ? (p.rot % 2 === 0 ? { I: 4, O: 2, T: 3, L: 2, J: 2, S: 3, Z: 3 } : { I: 1, O: 2, T: 2, L: 3, J: 3, S: 2, Z: 2 })[p.kind] : 1; }, m);
  async function playHinted(n) {
    for (let k = 0; k < n; k++) {
      const st = await page.evaluate(() => window.__kum.session.state);
      if (st !== 'playing') return;
      const m = await page.evaluate(() => window.__kum.hint());
      if (!m) return;
      await page.evaluate((m) => { const p = window.__kum.session.tray[m.slot]; if (p) p.rot = m.rot; window.__kum.scene.trayDirty = true; }, m);
      await dragSlotToGrain(m.slot, m.x + ((await widthOf(m)) * 4) / 2);
      await page.waitForTimeout(150);
      await settle();
    }
  }

  // 1) Menu (fresh save) and the map.
  await page.goto(`${BASE}?debug=1&nodaily`);
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.waitForSelector('[data-testid=menu-play]');
  await page.waitForTimeout(500);
  await shot('01-menu');

  // 2) Level 1 tutorial: dim spotlight + hand + Zerde bubble, lifted drag, burst.
  await page.click('[data-testid=menu-play]');
  await page.waitForSelector('[data-testid=board]');
  await page.waitForTimeout(900);
  log('tutorial dim shown:', await page.locator('[data-testid=tutorial-dim].show').count());
  await shot('02-tutorial');
  const m0 = await page.evaluate(() => window.__kum.hint());
  await dragSlotToGrain(m0.slot, m0.x + 4, true);
  await page.waitForTimeout(120);
  await shot('03-drag');
  await page.mouse.up();
  await page.waitForFunction(() => window.__kum.session.clearPending, null, { timeout: 5000 }).catch(() => null);
  await page.waitForFunction(() => !window.__kum.session.clearPending, null, { timeout: 5000 }).catch(() => null);
  await page.waitForTimeout(90);
  await shot('04-burst');
  await settle();
  await page.waitForTimeout(400);
  await shot('05-tutorial-step2');
  await playHinted(12);
  await page.waitForSelector('[data-testid=result-won]', { timeout: 8000 }).catch(() => null);
  await page.waitForTimeout(2200); // stars stamp in
  await shot('06-won');

  // 3) Map.
  await page.goto(`${BASE}?debug=1&nodaily&unlockAll`);
  await page.waitForSelector('[data-testid=menu-levels]');
  await page.click('[data-testid=menu-levels]');
  await page.waitForSelector('[data-testid=map]');
  await page.waitForTimeout(400);
  await shot('07-map');
  await page.evaluate(() => { const m = document.querySelector('[data-testid=map]'); m.scrollTop = m.scrollHeight * 0.38; });
  await page.waitForTimeout(200);
  await shot('08-map-region2');

  // 4) Level 10: intro card, chain + double word, Zerde sneeze (3 stacked paths incl. pul biber).
  await startLevel(10, '09-intro');
  await page.evaluate(() => {
    const s = window.__kum.session; const g = s.grid;
    for (let y = g.h - 14; y < g.h; y++) for (let x = 0; x < g.w; x++) g.set(x, y, 0);
    for (let x = 0; x < g.w; x++) { g.set(x, g.h - 1, 1); g.set(x, g.h - 2, 2); g.set(x, g.h - 3, 1); g.set(x, g.h - 4, 3); g.set(x, g.h - 5, 3); }
    s.wake();
  });
  await page.waitForSelector('[data-testid=fx-word].show', { timeout: 4000 }).catch(() => null);
  await page.waitForTimeout(380);
  log('word:', await page.locator('[data-testid=fx-word]').getAttribute('aria-label').catch(() => null), (await page.locator('[data-testid=fx-word]').textContent()).trim());
  log('zerde peek shown:', await page.locator('[data-testid=zerde-peek].show').count());
  await shot('10-chain-sneeze');
  await settle();
  await page.waitForTimeout(800);

  // Danger edge.
  await page.evaluate(() => {
    const s = window.__kum.session; const g = s.grid;
    for (let x = 0; x < 8; x++) { g.set(x, 7, 255, 0, 1); g.set(x, 6, 2); }
    s.wake();
  });
  await page.waitForTimeout(900);
  await shot('11-danger');

  // Pause.
  await page.click('[data-testid=pause]');
  await page.waitForSelector('[data-testid=pause-resume]');
  await page.waitForTimeout(350);
  await shot('12-pause');
  await page.click('[data-testid=pause-resume]');

  // Lost: block the top so nothing fits.
  await page.evaluate(() => {
    const s = window.__kum.session; const g = s.grid;
    for (let x = 0; x < g.w; x += 3) g.set(x, 0, 255, 0, 1);
    s.wake();
  });
  await page.waitForSelector('[data-testid=result-lost]', { timeout: 6000 }).catch(() => null);
  await page.waitForTimeout(600);
  await shot('13-lost');

  // 5) Mechanics levels.
  for (const [id, name] of [[16, 'sack'], [13, 'joker'], [22, 'twocolor'], [6, 'bomb']]) {
    await startLevel(id, `14-intro-${name}`);
    await playHinted(2);
    await page.waitForTimeout(250);
    await shot(`15-level-${name}`);
  }

  // Bomb burst: one bomb grain inside a full pepper row.
  await page.evaluate(() => {
    const s = window.__kum.session; const g = s.grid;
    for (let y = g.h - 10; y < g.h; y++) for (let x = 0; x < g.w; x++) g.set(x, y, 2 + ((x >> 2) + (y >> 2)) % 2);
    for (let x = 0; x < g.w; x++) g.set(x, g.h - 6, 1);
    g.flags[(g.h - 6) * g.w + 20] |= 2;
    s.wake();
  });
  await page.waitForFunction(() => window.__kum.session.clearPending, null, { timeout: 4000 }).catch(() => null);
  await page.waitForFunction(() => !window.__kum.session.clearPending, null, { timeout: 4000 }).catch(() => null);
  await page.waitForTimeout(70);
  await shot('16-bomb');

  // 6) Frame time on a busy board: keep sand flowing for ~4 s and sample rAF intervals.
  await startLevel(10);
  const perf = await page.evaluate(async () => {
    const s = window.__kum.session;
    const g = s.grid;
    const kick = () => {
      // Pour a band of grains near the top (like a stream of dropped pouches).
      for (let y = 2; y < 10; y++) for (let x = 0; x < g.w; x++) if (g.get(x, y) === 0 && Math.random() < 0.5) g.set(x, y, 1 + ((x >> 2) % 3));
      s.wake();
    };
    const frames = [];
    let last = performance.now();
    let kicks = 0;
    await new Promise((resolve) => {
      const t0 = last;
      const step = (now) => {
        frames.push(now - last);
        last = now;
        if (now - t0 > kicks * 600 && kicks < 7) { kick(); kicks++; }
        if (now - t0 < 4000) requestAnimationFrame(step);
        else resolve();
      };
      requestAnimationFrame(step);
    });
    frames.shift();
    const avg = frames.reduce((a, b) => a + b, 0) / frames.length;
    const sorted = [...frames].sort((a, b) => a - b);
    const p95 = sorted[Math.floor(sorted.length * 0.95)];
    // Pure render cost of one board draw (upload forced by bumping the version).
    const scene = window.__kum.scene;
    const N = 120;
    const t1 = performance.now();
    for (let i = 0; i < N; i++) { g.version++; scene.renderer.draw(s, null); }
    const drawMs = (performance.now() - t1) / N;
    return { frames: frames.length, avgMs: +avg.toFixed(2), fps: +(1000 / avg).toFixed(1), p95Ms: +p95.toFixed(2), boardDrawMs: +drawMs.toFixed(3) };
  });
  log('frame timing:', JSON.stringify(perf));

  await ctx.close();
  return errors;
}

(async () => {
  const browser = await chromium.launch();
  const all = [];
  for (const vp of VIEWPORTS) all.push(...(await run(browser, vp)));
  console.log('console errors:', all.length ? all : 'none');
  await browser.close();
  process.exit(all.length ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
