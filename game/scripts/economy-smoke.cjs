// Economy smoke test (Playwright, 390x844): daily reward popup, shop (fake note, free gold ad,
// fake purchase), booster bar (Yenile / Kepçe column pick + confirm / Elek grain pick),
// booster "bitti" offer, lose → continue with the fake rewarded ad, 2nd continue for 600 gold.
// Usage: npm run build && npx vite preview --port 4173 &
//        NODE_PATH=$(npm root -g) node scripts/economy-smoke.cjs <screenshotDir> [baseUrl]
// Exits non-zero on console errors / page errors / failed checks.
const { chromium } = require('playwright');
const OUT = process.argv[2] || '.';
const BASE = process.argv[3] || 'http://localhost:4173/';
const shot = (page, name) => page.screenshot({ path: `${OUT}/wave2b-economy-${name}.png` });

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  const errors = [];
  const failures = [];
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(`console.error: ${m.text()}`);
    else if (m.type() === 'warning') console.log('  (warning)', m.text());
  });
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  const log = (...a) => console.log('·', ...a);
  const check = (cond, msg) => {
    log(cond ? 'OK  ' : 'FAIL', msg);
    if (!cond) failures.push(msg);
  };
  const gold = () => page.evaluate(() => window.__app.meta.economy.gold);
  const count = (id) => page.evaluate((id) => window.__app.meta.economy.count(id), id);
  const settle = async () => {
    for (let i = 0; i < 80; i++) {
      const ok = await page.evaluate(() => { const s = window.__kum.session; return !s.isPlaying || (s.settled && !s.clearPending); });
      if (ok) return;
      await page.waitForTimeout(100);
    }
  };
  /** Fill the board with 2-grain vertical stripes (no wall-to-wall path) up to `top`. */
  const fillStripes = (top) =>
    page.evaluate((top) => {
      const s = window.__kum.session; const g = s.grid;
      for (let y = top; y < g.h; y++) for (let x = 0; x < g.w; x++) if (!(g.flags[y * g.w + x] & 1)) g.set(x, y, (x >> 1) % 2 ? s.level.colors[0] : s.level.colors[1]);
      s.wake();
    }, top);

  // 1) Progress save: levels 1–12 won → daily popup on the menu, all boosters unlocked.
  await page.goto(`${BASE}?debug=1`);
  await page.evaluate(() => {
    localStorage.clear();
    const levels = {};
    for (let i = 1; i <= 12; i++) levels[i] = { stars: 3, best: 3000, completed: true, attempts: 1, lossStreak: 0 };
    localStorage.setItem('kumakisi.save.v1', JSON.stringify({ version: 1, levels, settings: { sound: false, haptics: true, volume: 1 } }));
  });
  await page.reload();
  await page.waitForSelector('[data-testid=daily]', { timeout: 5000 });
  await page.waitForTimeout(300);
  await shot(page, '01-daily');
  const g0 = await gold();
  check(g0 === 200, `starting gold 200 (got ${g0})`);
  await page.click('[data-testid=daily-claim]');
  await page.waitForSelector('[data-testid=daily]', { state: 'detached' });
  check((await gold()) === g0 + 25, 'daily day 1 gave 25 gold');
  await page.waitForTimeout(200);
  await shot(page, '02-menu-gold');

  // 2) Shop: fake note, free gold ad, fake purchase.
  await page.click('[data-testid=menu-shop]');
  await page.waitForSelector('[data-testid=shop]');
  check((await page.locator('[data-testid=shop-fake-note]').textContent()).includes('gerçek ödeme yok'), 'shop shows the "Deneme sürümü: gerçek ödeme yok" note');
  await page.waitForTimeout(250);
  await shot(page, '03-shop');
  const g1 = await gold();
  await page.click('[data-testid=shop-free-gold]');
  await page.waitForSelector('[data-testid=fake-ad-rewarded]');
  await page.waitForTimeout(500);
  await shot(page, '04-fake-rewarded-ad');
  await page.waitForSelector('[data-testid=fake-ad-rewarded]', { state: 'detached', timeout: 4000 });
  check((await gold()) === g1 + 30, 'free gold ad gave 30');
  await page.click('[data-testid=shop-buy-gold_small]');
  await page.waitForSelector('[data-testid=fake-purchase]');
  await shot(page, '05-fake-purchase');
  await page.click('[data-testid=fake-purchase-ok]');
  await page.waitForTimeout(200);
  check((await gold()) === g1 + 1030, 'fake gold pack delivered 1000');
  await page.click('[data-testid=shop-close]');

  // 3) Level 13: booster bar (gifts: 2 of each).
  await page.click('[data-testid=menu-play]'); // current level = 13
  await page.waitForSelector('[data-testid=intro-start]');
  await page.waitForTimeout(300);
  await page.click('[data-testid=intro-start]');
  await page.waitForSelector('[data-testid=booster-bar]');
  await page.waitForTimeout(400);
  check((await count('shuffle')) === 2 && (await count('scoop')) === 2 && (await count('sieve')) === 2, 'unlock gifts: 2 of each booster');
  await shot(page, '06-play-boosters');

  // Yenile
  const trayBefore = await page.evaluate(() => JSON.stringify(window.__kum.session.tray));
  await page.click('[data-testid=booster-shuffle]');
  await page.waitForTimeout(150);
  const trayAfter = await page.evaluate(() => JSON.stringify(window.__kum.session.tray));
  check(trayBefore !== trayAfter && (await count('shuffle')) === 1, 'Tezgâhı Yenile rerolled the tray (count 2 → 1)');

  // Kepçe: some sand, pick a column, confirm.
  await fillStripes(60);
  await settle();
  await page.click('[data-testid=booster-scoop]');
  await page.waitForSelector('[data-testid=booster-target]');
  const board = await page.locator('[data-testid=board]').boundingBox();
  await page.mouse.click(board.x + board.width * 0.5, board.y + board.height * 0.8);
  await page.waitForTimeout(150);
  await shot(page, '07-scoop-target');
  const grainsBefore = await page.evaluate(() => window.__kum.session.grid.color.filter((c) => c > 0 && c < 15).length);
  await page.click('[data-testid=booster-confirm]');
  await page.waitForTimeout(150);
  const grainsAfter = await page.evaluate(() => window.__kum.session.grid.color.filter((c) => c > 0 && c < 15).length);
  check(grainsBefore - grainsAfter >= 60 && (await count('scoop')) === 1, `Kepçe emptied a 4-grain column (${grainsBefore - grainsAfter} grains)`);
  await settle();

  // Elek: tap a grain → that colour disappears.
  await page.click('[data-testid=booster-sieve]');
  await page.waitForSelector('[data-testid=booster-target]');
  const target = await page.evaluate(() => { const g = window.__kum.session.grid; for (let i = g.size - 1; i >= 0; i--) if (g.color[i] > 0 && g.color[i] < 15 && !(g.flags[i] & 1)) return { x: i % g.w, y: Math.floor(i / g.w), c: g.color[i] }; return null; });
  await page.mouse.click(board.x + ((target.x + 0.5) / (await page.evaluate(() => window.__kum.session.grid.w))) * board.width, board.y + ((target.y + 0.5) / (await page.evaluate(() => window.__kum.session.grid.h))) * board.height);
  await page.waitForTimeout(150);
  const left = await page.evaluate((c) => window.__kum.session.grid.color.filter((v) => v === c).length, target.c);
  check(left === 0 && (await count('sieve')) === 1, `Elek removed every grain of colour ${target.c}`);
  await settle();

  // Booster "bitti" offer: use the last Elek, then tap again.
  await fillStripes(70);
  await settle();
  await page.evaluate(() => (window.__app.meta.economy.consumeBooster('sieve', 'smoke')));
  await page.click('[data-testid=booster-sieve]');
  await page.waitForSelector('[data-testid=booster-offer]');
  await page.waitForTimeout(250);
  await shot(page, '08-booster-offer');
  await page.click('[data-testid=offer-cancel]');

  // 4) Lose (no space) → continue with the fake rewarded ad.
  await fillStripes(0);
  await page.waitForSelector('[data-testid=result-lost]', { timeout: 6000 });
  await page.waitForTimeout(300);
  await shot(page, '09-lost-continue');
  check((await page.locator('[data-testid=continue-ad]').count()) === 1, 'lose card offers "Reklam izle"');
  check((await page.locator('[data-testid=continue-gold]').textContent()).includes('300'), 'lose card offers 300 gold');
  const before = await page.evaluate(() => ({ left: window.__kum.session.piecesLeft, attempts: window.__app.save.level(13).attempts }));
  await page.click('[data-testid=continue-ad]');
  await page.waitForSelector('[data-testid=fake-ad-rewarded]');
  await page.waitForTimeout(400);
  await shot(page, '10-continue-ad');
  await page.waitForSelector('[data-testid=result-lost]', { state: 'detached', timeout: 4000 });
  await page.waitForTimeout(200);
  const after = await page.evaluate(() => { const s = window.__kum.session; return { state: s.state, left: s.piecesLeft, top: s.topSandRow(), continues: s.continues, attempts: window.__app.save.level(13).attempts }; });
  check(after.state === 'playing' && after.left === before.left + 5 && after.top >= 20 && after.continues === 1, `continue: playing, +5 pieces, top 20 rows cleared (${JSON.stringify(after)})`);
  check(after.attempts === before.attempts - 1, 'continued run is the same attempt (loss taken back)');
  await shot(page, '11-after-continue');

  // 2nd continue: 600 gold, no ad.
  await fillStripes(0);
  await page.waitForSelector('[data-testid=result-lost]', { timeout: 6000 });
  check((await page.locator('[data-testid=continue-ad]').count()) === 0, '2nd continue: no ad option');
  const g2 = await gold();
  await page.click('[data-testid=continue-gold]');
  await page.waitForTimeout(200);
  check((await gold()) === g2 - 600, '2nd continue cost 600 gold');
  await fillStripes(0);
  await page.waitForSelector('[data-testid=result-lost]', { timeout: 6000 });
  check((await page.locator('[data-testid=continue-offer]').count()) === 0, 'no 3rd continue');
  await page.waitForTimeout(200);
  await shot(page, '12-no-third-continue');

  await browser.close();
  if (errors.length) console.log('ERRORS:\n' + errors.join('\n'));
  if (failures.length) console.log('FAILED CHECKS:\n' + failures.join('\n'));
  console.log(errors.length || failures.length ? 'SMOKE FAILED' : 'SMOKE OK (no console errors)');
  process.exit(errors.length || failures.length ? 1 : 0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
