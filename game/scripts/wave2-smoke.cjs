// Wave 2 gameplay smoke test (Playwright, 390x844): tutorial level 1 (hand + lifted drag piece),
// juice words, intro card + sacks, joker / two-colour levels, endless mode, back button (web no-op).
// Usage: npm run build && npx vite preview --port 4173 &
//        NODE_PATH=$(npm root -g) node scripts/wave2-smoke.cjs <screenshotDir> [baseUrl]
// Exits non-zero on console errors / page errors.
const { chromium } = require('playwright');
const OUT = process.argv[2] || '.';
const BASE = process.argv[3] || 'http://localhost:4173/';
const shot = (page, name) => page.screenshot({ path: `${OUT}/wave2-gameplay-${name}.png` });

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errors.push(`${m.type()}: ${m.text()}`); });
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  const log = (...a) => console.log('·', ...a);
  const state = () => page.evaluate(() => { const s = window.__kum.session; return { placed: s.placed, score: s.score, state: s.state, tray: s.tray.map((t) => t && t.kind), chain: s.chain }; });
  const settle = async () => { for (let i = 0; i < 60; i++) { const ok = await page.evaluate(() => { const s = window.__kum.session; return !s.isPlaying || (s.settled && !s.clearPending); }); if (ok) return; await page.waitForTimeout(100); } };

  async function dragSlotToGrain(slot, grainCenterX, { hold = false } = {}) {
    const s = await page.locator(`[data-testid=slot-${slot}]`).boundingBox();
    const board = await page.locator('[data-testid=board]').boundingBox();
    const tx = board.x + (grainCenterX / (await page.evaluate(() => window.__kum.session.grid.w))) * board.width;
    const ty = board.y + board.height * 0.25;
    const sx = s.x + s.width / 2, sy = s.y + s.height / 2;
    await page.mouse.move(sx, sy);
    await page.mouse.down();
    for (let i = 1; i <= 10; i++) await page.mouse.move(sx + ((tx - sx) * i) / 10, sy + ((ty - sy) * i) / 10);
    if (hold) return;
    await page.mouse.up();
  }
  async function playHinted(maxMoves) {
    for (let n = 0; n < maxMoves; n++) {
      const st = await state();
      if (st.state !== 'playing') break;
      const m = await page.evaluate(() => window.__kum.hint());
      if (!m) break;
      await page.evaluate((m) => { const s = window.__kum.session; const p = s.tray[m.slot]; if (p) p.rot = m.rot; window.__kum.scene.trayDirty = true; }, m);
      const kind = (await state()).tray[m.slot];
      const w = await page.evaluate((m) => { const s = window.__kum.session; const p = s.tray[m.slot]; return p ? (p.rot % 2 === 0 ? { I: 4, O: 2, T: 3, L: 2, J: 2, S: 3, Z: 3 } : { I: 1, O: 2, T: 2, L: 3, J: 3, S: 2, Z: 2 })[p.kind] : 1; }, m);
      await dragSlotToGrain(m.slot, m.x + (w * (await page.evaluate(() => window.__kum.session.grid.w / 12))) / 2);
      await page.waitForTimeout(150);
      await settle();
      log('move', n, kind, 'x', m.x, JSON.stringify(await state()));
    }
  }

  // 1) Fresh start: menu.
  await page.goto(`${BASE}?debug=1&nofirst`);
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.waitForSelector('[data-testid=menu-play]');
  await shot(page, '01-menu');

  // 2) Level 1 tutorial: hand hint, lifted drag piece, hinted play to the end.
  await page.click('[data-testid=menu-play]');
  await page.waitForSelector('[data-testid=board]');
  await page.waitForSelector('[data-testid=howto-close]', { timeout: 2000 }).then(() => page.click('[data-testid=howto-close]')).catch(() => null);
  await page.waitForTimeout(700);
  const tutText = await page.locator('[data-testid=tutorial-text]').textContent().catch(() => null);
  log('tutorial text:', tutText);
  await shot(page, '02-tutorial-hand');
  const m0 = await page.evaluate(() => window.__kum.hint());
  await dragSlotToGrain(m0.slot, m0.x + 4, { hold: true });
  await page.waitForTimeout(100);
  const dragVisible = await page.locator('[data-testid=drag-piece].show').count();
  log('drag piece visible:', dragVisible);
  await shot(page, '03-drag-lifted');
  await page.mouse.up();
  await page.waitForTimeout(250);
  await settle();
  await page.waitForTimeout(300);
  await shot(page, '04-tutorial-step2');
  log('after first drop', JSON.stringify(await state()), 'text:', await page.locator('[data-testid=tutorial-text]').textContent().catch(() => null));
  await playHinted(12);
  await page.waitForTimeout(1500);
  const r1 = await page.locator('[data-testid^=result-]').first().getAttribute('data-testid').catch(() => null);
  log('level 1 result card:', r1);
  await page.waitForTimeout(300);
  await shot(page, '05-level1-result');

  // 3) Juice: force a double + chain on a fresh attempt (debug board edit) and capture the words.
  await page.goto(`${BASE}?debug=1&unlockAll&nodaily`);
  await page.waitForSelector('[data-testid=menu-levels]');
  await page.click('[data-testid=menu-levels]');
  await page.click('[data-testid=level-10]');
  await page.waitForSelector('[data-testid=intro-start]');
  await page.waitForTimeout(300); // overlay fade-in
  await shot(page, '06-intro-card');
  await page.click('[data-testid=intro-start]');
  await page.evaluate(() => {
    const s = window.__kum.session; const g = s.grid;
    for (let x = 0; x < g.w; x++) { g.set(x, g.h - 1, 1); g.set(x, g.h - 2, 2); g.set(x, g.h - 3, x === 0 ? 3 : 1); }
    g.set(0, g.h - 4, 1);
    s.wake();
  });
  await page.waitForSelector('[data-testid=fx-word].show', { timeout: 3000 }).catch(() => null);
  await page.waitForTimeout(150);
  log('word:', await page.locator('[data-testid=fx-word]').textContent());
  await shot(page, '07-double-chain-word');

  // Danger edge: a little sand resting on a stone ledge near the top (pieces still fit elsewhere).
  await settle();
  await page.evaluate(() => {
    const s = window.__kum.session; const g = s.grid;
    for (let x = 0; x < 8; x++) { g.set(x, 7, 255, 0, 1); g.set(x, 6, 2); }
    s.wake();
  });
  await page.waitForTimeout(900);
  log('danger:', await page.evaluate(() => window.__kum.session.danger));
  await shot(page, '08-danger');

  // Web back button path = Escape → pause (no native shell on the web).
  const handled = await page.evaluate(() => window.__app.scenes.back());
  await page.waitForSelector('[data-testid=pause-resume]');
  log('back() handled on play scene:', handled);
  await page.click('[data-testid=pause-exit]'); await page.click('[data-testid=confirm-yes]');

  // 4) Sack level (intro card with "Yeni!" mechanic card), joker and two-colour levels.
  for (const id of [16, 13, 22]) {
    await page.waitForSelector(`[data-testid=level-${id}]`);
    await page.click(`[data-testid=level-${id}]`);
    await page.waitForSelector('[data-testid=board]');
    if (await page.locator('[data-testid=intro-start]').count()) {
      await page.waitForTimeout(300);
      await shot(page, `09-intro-${id}`);
      await page.click('[data-testid=intro-start]');
    }
    await page.waitForTimeout(400);
    await playHinted(2);
    await shot(page, `10-level-${id}`);
    await page.click('[data-testid=pause]');
    await page.click('[data-testid=pause-exit]'); await page.click('[data-testid=confirm-yes]');
  }

  // 5) Endless mode from the menu, play a few moves, force game over → record.
  await page.click('.topbar .btn-icon');
  await page.waitForSelector('[data-testid=menu-endless]');
  await shot(page, '11-menu-endless');
  await page.click('[data-testid=menu-endless]');
  await page.waitForSelector('[data-testid=board]');
  await page.waitForTimeout(500);
  await shot(page, '12-endless-start');
  await playHinted(5);
  await shot(page, '13-endless-play');
  await page.evaluate(() => {
    const s = window.__kum.session; const g = s.grid;
    for (let x = 0; x < g.w; x += 3) g.set(x, 0, 255, 0, 1);
    s.wake();
  });
  await page.waitForSelector('[data-testid=result-endless]', { timeout: 5000 });
  await page.waitForTimeout(300);
  log('new best shown:', await page.locator('[data-testid=new-best]').count());
  await shot(page, '14-endless-over');
  await page.click('[data-testid=result-endless] .btn-ghost');
  await page.waitForSelector('[data-testid=menu-endless]');
  log('menu endless label:', (await page.locator('[data-testid=menu-endless]').textContent()).trim());
  const atMenu = await page.evaluate(() => window.__app.scenes.back());
  log('back() at main menu (native would exit):', atMenu);

  console.log('console errors/warnings:', errors.length ? errors : 'none');
  await browser.close();
  process.exit(errors.some((e) => e.startsWith('error') || e.startsWith('pageerror')) ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
