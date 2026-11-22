// Browser smoke test (Playwright, 390x844): menu -> level 1 -> drag/drop pieces -> pause -> result.
// Usage: npm run build && npx vite preview --port 4173 &  then  node scripts/smoke.cjs <screenshotDir> [url]
// Exits non-zero on console errors / page errors.
const { chromium } = require('playwright');
const OUT = process.argv[2] || '.';
const URL = process.argv[3] || 'http://localhost:4173/?debug=1&nofirst&nohowto';
(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errors.push(`${m.type()}: ${m.text()}`); });
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  await page.goto(URL);
  await page.waitForSelector('[data-testid=menu-play]');
  await page.screenshot({ path: `${OUT}/01-menu.png` });

  await page.click('[data-testid=menu-levels]');
  await page.waitForSelector('[data-testid=level-1]');
  await page.screenshot({ path: `${OUT}/02-levels.png` });
  await page.click('[data-testid=level-1]');
  await page.waitForSelector('[data-testid=board]');
  // First lesson opens the "Nasıl oynanır?" card first.
  await page.waitForSelector('[data-testid=howto-close]', { timeout: 2000 }).then(() => page.click('[data-testid=howto-close]')).catch(() => null);
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${OUT}/03-play-start.png` });

  const board = await page.locator('[data-testid=board]').boundingBox();
  console.log('board box', board);
  const piecesText = async () => (await page.locator('[data-testid=hud-pieces]').textContent()).trim();
  const before = await piecesText();

  // Touch-like drag via mouse pointer events: tray slot -> board.
  async function dragSlotTo(slot, fx) {
    const s = await page.locator(`[data-testid=slot-${slot}]`).boundingBox();
    if (!s) return false;
    await page.mouse.move(s.x + s.width / 2, s.y + s.height / 2);
    await page.mouse.down();
    const tx = board.x + board.width * fx, ty = board.y + board.height * 0.3;
    for (let i = 1; i <= 8; i++) await page.mouse.move(s.x + s.width / 2 + (tx - s.x - s.width / 2) * i / 8, s.y + s.height / 2 + (ty - s.y - s.height / 2) * i / 8);
    await page.mouse.up();
    return true;
  }
  const state = () => page.evaluate(() => { const s = window.__kum.session; return { placed: s.placed, score: s.score, state: s.state, tray: s.tray.map((t) => t && t.kind) }; });

  await dragSlotTo(0, 0.2);
  await page.waitForTimeout(250);
  await page.screenshot({ path: `${OUT}/04-falling.png` });
  await page.waitForTimeout(1200);
  // Tap selected slot again to rotate, then drag it.
  const st1 = await state();
  const sel = st1.tray.findIndex((t) => t);
  const sb = await page.locator(`[data-testid=slot-${sel}]`).boundingBox();
  await page.mouse.click(sb.x + sb.width / 2, sb.y + sb.height / 2);
  await page.waitForTimeout(100);
  await dragSlotTo(sel, 0.75);
  await page.waitForTimeout(1500);
  // Touch the board directly to aim + release to drop (selected piece).
  await page.touchscreen.tap(board.x + board.width * 0.5, board.y + board.height * 0.4);
  await page.waitForTimeout(1500);
  // Rotate + drag remaining pieces.
  for (const fx of [0.15, 0.85, 0.5]) {
    const st = await state();
    const i = st.tray.findIndex((t) => t);
    if (i < 0 || st.state !== 'playing') break;
    // Tap the selected slot to rotate (no separate rotate button by default).
    const rb = await page.locator(`[data-testid=slot-${i}]`).boundingBox();
    await page.mouse.click(rb.x + rb.width / 2, rb.y + rb.height / 2);
    await page.mouse.click(rb.x + rb.width / 2, rb.y + rb.height / 2);
    await dragSlotTo(i, fx);
    await page.waitForTimeout(1500);
  }
  const after = await piecesText();
  const st = await state();
  console.log('pieces before/after', before, after, 'state', JSON.stringify(st));
  await page.screenshot({ path: `${OUT}/05-after-drops.png` });

  // Pause and resume.
  if (st.state === 'playing') {
    await page.click('[data-testid=pause]');
    await page.waitForSelector('[data-testid=pause-resume]');
    await page.screenshot({ path: `${OUT}/06-pause.png` });
    await page.click('[data-testid=pause-resume]');
  }

  // Finish the level quickly with keyboard drops guided by the board state, to reach a result card.
  for (let n = 0; n < 40; n++) {
    const s = await state();
    if (s.state !== 'playing') break;
    await page.evaluate((n) => { const sc = window.__kum.scene; sc.ghostX = (n * 12) % 40; }, n);
    await page.keyboard.press('Space');
    await page.waitForTimeout(900);
  }
  await page.waitForTimeout(1200);
  const final = await state();
  console.log('final', JSON.stringify(final));
  const result = await page.locator('[data-testid^=result-]').first().isVisible().catch(() => false);
  console.log('result card visible', result);
  await page.screenshot({ path: `${OUT}/07-result.png` });

  console.log('console errors/warnings:', errors.length ? errors : 'none');
  await browser.close();
  process.exit(errors.some((e) => e.startsWith('error') || e.startsWith('pageerror')) ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
