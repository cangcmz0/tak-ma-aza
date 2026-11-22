// Board resolution check (Playwright, 390×844 @3x): board screenshots + frame / sim / draw cost
// while sand keeps pouring. Works for any SUB (reads sizes from the live session).
// Usage: npm run build && npx vite preview --port 4173 &
//        NODE_PATH=$(npm root -g) node scripts/hires-perf.cjs <outDir> [baseUrl] [tag]
// Writes <outDir>/hires-<tag>-*.png and prints JSON timings. Non-zero exit on console errors.
const { chromium } = require('playwright');
const OUT = process.argv[2] || '.';
const BASE = process.argv[3] || 'http://localhost:4173/';
const TAG = process.argv[4] || 'after';

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(`error: ${m.text()}`); });
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  const shot = (name, clip) => page.screenshot({ path: `${OUT}/hires-${TAG}-${name}.png`, clip });

  const openLevel = async (id) => {
    await page.goto(`${BASE}?debug=1&nodaily&unlockAll`);
    await page.waitForSelector('[data-testid=menu-levels]');
    await page.click('[data-testid=menu-levels]');
    await page.waitForSelector(`[data-testid=level-${id}]`);
    await page.click(`[data-testid=level-${id}]`);
    await page.waitForSelector('[data-testid=board]');
    if (await page.locator('[data-testid=intro-start]').count()) {
      await page.waitForTimeout(300);
      await page.click('[data-testid=intro-start]');
    }
    await page.waitForTimeout(300);
    // Dismiss tutorial overlays if any.
    await page.evaluate(() => document.querySelectorAll('.tutorial, .tut-layer').forEach((e) => e.remove()));
  };
  const waitSettled = async () => {
    for (let i = 0; i < 100; i++) {
      const ok = await page.evaluate(() => { const s = window.__kum.session; return !s.isPlaying || (s.settled && !s.clearPending); });
      if (ok) return;
      await page.waitForTimeout(100);
    }
  };

  // 1) A mid-game board: level 5 with a few pieces dropped by the debug hint/bot-free path.
  await openLevel(5);
  await page.evaluate(() => {
    const s = window.__kum.session;
    const g = s.grid;
    const blk = g.w / 12; // cells per block
    // Drop every tray piece once, spread across the board (rotation as dealt).
    for (let k = 0; k < 6; k++) {
      const slot = s.tray.findIndex((t) => t);
      if (slot < 0) break;
      s.drop(slot, Math.min(g.w - 4 * blk, Math.round(((k * 5) % 12) * blk * 0.7)), 0);
      for (let t = 0; t < 400 && !s.settled; t++) s.tick();
    }
  });
  await waitSettled();
  await page.waitForTimeout(200);
  await shot('board');
  const bb = await page.locator('[data-testid=board]').boundingBox();
  await shot('zoom', { x: bb.x, y: bb.y + bb.height * 0.6, width: bb.width * 0.5, height: bb.height * 0.4 });

  // 2) Timings with sand pouring continuously (level 10 board), with and without 4× CPU throttle.
  const measure = async (label) => {
    await openLevel(10);
    const r = await page.evaluate(async () => {
      const s = window.__kum.session;
      const scene = window.__kum.scene;
      const g = s.grid;
      const sub = g.w / 48;
      const kick = () => {
        for (let y = 2 * sub; y < 10 * sub; y++) for (let x = 0; x < g.w; x++) if (g.get(x, y) === 0 && Math.random() < 0.5) g.set(x, y, 1 + ((x / (4 * sub)) | 0) % 3);
        s.wake();
      };
      // rAF intervals over ~4 s with periodic pours.
      const frames = [];
      let last = performance.now();
      let kicks = 0;
      await new Promise((resolve) => {
        const t0 = last;
        const step = (now) => {
          frames.push(now - last);
          last = now;
          if (now - t0 > kicks * 500 && kicks < 8) { kick(); kicks++; }
          if (now - t0 < 4000) requestAnimationFrame(step);
          else resolve();
        };
        requestAnimationFrame(step);
      });
      frames.shift();
      const avg = frames.reduce((a, b) => a + b, 0) / frames.length;
      const sorted = [...frames].sort((a, b) => a - b);
      const p95 = sorted[Math.floor(sorted.length * 0.95)];
      // Pure sim cost per tick while sand is moving: snapshot a busy board and replay ticks.
      const state0 = s.state;
      s.state = 'playing';
      s.flashTicks = 0;
      kick();
      const snap = { c: g.color.slice(), sh: g.shade.slice(), f: g.flags.slice() };
      let ticks = 0;
      let simMs = 0;
      for (let rep = 0; rep < 6; rep++) {
        g.color.set(snap.c); g.shade.set(snap.sh); g.flags.set(snap.f); s.wake(); s.flashTicks = 0; s.state = 'playing';
        const t1 = performance.now();
        for (let k = 0; k < 30; k++) { s.tick(); ticks++; }
        simMs += performance.now() - t1;
      }
      const tickMs = simMs / ticks;
      // Render cost: full repaint (forced) and a typical frame while sand is falling.
      const rd = scene.renderer;
      const N = 60;
      const t2 = performance.now();
      for (let i = 0; i < N; i++) { g.version++; rd.needFull = true; rd.draw(s, null); }
      const drawFullMs = (performance.now() - t2) / N;
      g.color.set(snap.c); g.shade.set(snap.sh); g.flags.set(snap.f); s.wake(); s.flashTicks = 0; s.state = 'playing';
      rd.draw(s, null);
      let drawMs = 0;
      let rows = 0;
      for (let k = 0; k < 30; k++) {
        s.tick();
        const t3 = performance.now();
        rd.draw(s, null);
        drawMs += performance.now() - t3;
        rows += rd.lastPaintedRows ?? g.h;
      }
      s.state = state0;
      return {
        grid: `${g.w}x${g.h}`, frames: frames.length, avgFrameMs: +avg.toFixed(2), p95FrameMs: +p95.toFixed(2),
        simTickMs: +tickMs.toFixed(3), drawFullMs: +drawFullMs.toFixed(3), drawFallingMs: +(drawMs / 30).toFixed(3), rowsPerFrame: Math.round(rows / 30),
      };
    });
    console.log(`[${TAG}] ${label}:`, JSON.stringify(r));
    return r;
  };
  await measure('cpu x1');
  const cdp = await ctx.newCDPSession(page);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  await measure('cpu x4 (mid Android approx.)');
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });

  console.log('console errors:', errors.length ? errors : 'none');
  await browser.close();
  process.exit(errors.length ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
