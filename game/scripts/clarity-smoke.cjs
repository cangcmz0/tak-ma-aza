// Clarity pass smoke test (Playwright, 390×844): "Nasıl oynanır?" card, tutorial with wall
// glow and the "İşte böyle!" banner, live path progress hints, order texts, pause button,
// gold explainer, one-time booster tip, first-gold tip.
// Usage: npm run build && npx vite preview --port 4173 &
//        NODE_PATH=$(npm root -g) node scripts/clarity-smoke.cjs <screenshotDir> [baseUrl]
// Files: <dir>/clarity-NN-name.png. Exits non-zero on console/page errors.
const { chromium } = require('playwright');
const OUT = process.argv[2] || '.';
const BASE = process.argv[3] || 'http://localhost:4173/';

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(`error: ${m.text()}`); });
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  const shot = (name) => page.screenshot({ path: `${OUT}/clarity-${name}.png` });
  const log = (...a) => console.log('·', ...a);
  const settle = async () => {
    for (let i = 0; i < 80; i++) {
      const ok = await page.evaluate(() => { const s = window.__kum.session; return !s.isPlaying || (s.settled && !s.clearPending); });
      if (ok) return;
      await page.waitForTimeout(100);
    }
  };
  async function dragSlotToGrain(slot, grainCenterX) {
    const s = await page.locator(`[data-testid=slot-${slot}]`).boundingBox();
    const board = await page.locator('[data-testid=board]').boundingBox();
    const w = await page.evaluate(() => window.__kum.session.grid.w);
    const tx = board.x + (grainCenterX / w) * board.width;
    const ty = board.y + board.height * 0.3;
    const sx = s.x + s.width / 2, sy = s.y + s.height / 2;
    await page.mouse.move(sx, sy);
    await page.mouse.down();
    for (let i = 1; i <= 12; i++) await page.mouse.move(sx + ((tx - sx) * i) / 12, sy + ((ty - sy) * i) / 12);
    await page.mouse.up();
  }
  async function playHint() {
    const m = await page.evaluate(() => window.__kum.hint());
    if (!m) return false;
    await page.evaluate((m) => { const p = window.__kum.session.tray[m.slot]; if (p) p.rot = m.rot; window.__kum.scene.trayDirty = true; }, m);
    const cx = await page.evaluate((m) => {
      const s = window.__kum.session; const p = s.tray[m.slot];
      const B = s.grid.w / 12; // grains per block, read from the grid
      const wBlocks = p ? (p.rot % 2 === 0 ? { I: 4, O: 2, T: 3, L: 2, J: 2, S: 3, Z: 3 } : { I: 1, O: 2, T: 2, L: 3, J: 3, S: 2, Z: 2 })[p.kind] : 1;
      return m.x + (wBlocks * B) / 2;
    }, m);
    await dragSlotToGrain(m.slot, cx);
    return true;
  }

  // 1) First launch → level 1: how-to card first.
  await page.goto(`${BASE}?debug=1&nodaily`);
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.waitForSelector('[data-testid=menu-play]');
  await page.click('[data-testid=gold-badge]');
  await page.waitForSelector('[data-testid=gold-info]');
  await page.waitForTimeout(400);
  await shot('01-gold-info');
  await page.click('[data-testid=gold-info-ok]');
  await page.click('[data-testid=menu-play]');
  await page.waitForSelector('[data-testid=howto]');
  await page.waitForTimeout(1500);
  await shot('02-howto-a');
  await page.waitForTimeout(500);
  await shot('03-howto-b');
  await page.click('[data-testid=howto-close]');
  await page.waitForTimeout(900);
  await shot('04-tutorial-walls');
  // First drop → first pop → "İşte böyle!".
  await playHint();
  await page.waitForSelector('[data-testid=tutorial-aha].show', { timeout: 6000 }).catch(() => null);
  await page.waitForTimeout(500);
  log('aha shown:', await page.locator('[data-testid=tutorial-aha].show').count());
  await shot('05-aha');
  await page.waitForTimeout(3000);
  await settle();
  await shot('06-tutorial-step3');
  for (let k = 0; k < 10 && (await page.evaluate(() => window.__kum.session.state)) === 'playing'; k++) {
    await playHint();
    await page.waitForTimeout(200);
    await settle();
  }
  await page.waitForSelector('[data-testid=result-won]', { timeout: 8000 }).catch(() => null);
  await page.waitForTimeout(1800);
  log('first gold tip:', await page.locator('[data-testid=gold-tip]').count());
  await shot('07-won-gold-tip');

  // 2) Path progress hints on a crafted board (level 5, colour path goal) + intro card text.
  await page.goto(`${BASE}?debug=1&nodaily&unlockAll`);
  await page.waitForSelector('[data-testid=menu-levels]');
  await page.click('[data-testid=menu-levels]');
  await page.click('[data-testid=level-5]');
  await page.waitForSelector('[data-testid=board]');
  if (await page.locator('[data-testid=intro-start]').count()) {
    await page.waitForTimeout(400);
    await shot('08-intro-order');
    await page.click('[data-testid=intro-start]');
  }
  await page.evaluate(() => {
    const s = window.__kum.session; const g = s.grid;
    const B = g.w / 12;
    for (let i = 0; i < g.size; i++) if (g.color[i] !== 255 && g.color[i] !== 254) g.color[i] = 0;
    g.version++;
    // Zerdeçal from the left wall: 8 of 12 blocks; pul biber: 4 blocks from the left, 3 from the right.
    for (let y = g.h - B; y < g.h; y++) for (let x = 0; x < 8 * B; x++) g.set(x, y, 2);
    for (let y = g.h - 2 * B; y < g.h - B; y++) { for (let x = 0; x < 4 * B; x++) g.set(x, y, 1); for (let x = g.w - 3 * B; x < g.w; x++) g.set(x, y, 1); }
    for (let y = g.h - 2 * B; y < g.h - B; y++) for (let x = 4 * B; x < 6 * B; x++) g.set(x, y, 3);
    s.wake();
  });
  await settle();
  await page.waitForTimeout(400);
  log('path progress:', JSON.stringify(await page.evaluate(() => window.__kum.scene.pathHint.current.map((p) => ({ c: p.color, f: +p.frac.toFixed(2) })))));
  await shot('09-path-progress');

  // 3) Pause with "Nasıl oynanır?".
  await page.click('[data-testid=pause]');
  await page.waitForSelector('[data-testid=pause-howto]');
  await page.waitForTimeout(350);
  await shot('10-pause');
  await page.click('[data-testid=pause-howto]');
  await page.waitForSelector('[data-testid=howto]');
  await page.waitForTimeout(300);
  await page.click('[data-testid=howto-close]');
  await page.click('[data-testid=pause-exit]');

  // 4) Level 7: boosters appear → one-time explainer bubble.
  await page.waitForSelector('[data-testid=level-7]');
  await page.click('[data-testid=level-7]');
  await page.waitForSelector('[data-testid=board]');
  if (await page.locator('[data-testid=intro-start]').count()) {
    await page.waitForTimeout(300);
    await page.click('[data-testid=intro-start]');
  }
  await page.waitForTimeout(500);
  log('booster tip:', await page.locator('[data-testid=booster-tip]').count());
  await shot('11-booster-tip');

  console.log('console errors:', errors.length ? errors : 'none');
  await browser.close();
  process.exit(errors.length ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
