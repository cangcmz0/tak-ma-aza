// Uygulama ikonu + açılış (splash) görselleri üretici.
// HTML canvas'ta koyu mor zemin üzerine piksel kum tepeciği (baharat renkleri) çizer,
// Playwright/Chromium ile PNG'ye çevirir ve Android kaynak klasörlerine yazar.
//
// Kullanım (game/ içinden; Playwright global kurulu, `playwright install` gerekmez):
//   NODE_PATH=$(npm root -g) node scripts/make-icons.cjs
//
// Çıktılar:
//   android/app/src/main/res/mipmap-<dpi>/ic_launcher.png             (eski tip kare ikon, 48dp)
//   android/app/src/main/res/mipmap-<dpi>/ic_launcher_round.png       (eski tip yuvarlak ikon, 48dp)
//   android/app/src/main/res/mipmap-<dpi>/ic_launcher_foreground.png  (adaptive ön plan, 108dp, şeffaf)
//   android/app/src/main/res/drawable*/splash.png                     (Android < 12 açılış ekranı)
//   store/icon-512.png                                                (Play Store ikonu, 512×512)
// Adaptive arka plan rengi: android/app/src/main/res/values/ic_launcher_background.xml (BG_MID).
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');

const ROOT = path.resolve(__dirname, '..');
const RES = path.join(ROOT, 'android/app/src/main/res');

// Renkler: src/render/theme.ts ile uyumlu.
const COLORS = {
  appBg: '#14112b', // theme css --bg (splash zemini)
  bgTop: '#3a2b7d', // ikon zemini (koyu mor degrade)
  bgBottom: '#1f1748',
  bgMid: '#2a1f5c', // adaptive icon arka plan rengi (düz)
  sand: [
    // [base, light, dark] — theme.ts sand
    ['#4f6fe0', '#7189ec', '#3a56c2'], // çivit
    ['#4fb874', '#6fcf8f', '#3a9a5c'], // nane
    ['#e8553f', '#f27a5f', '#c9412e'], // pul biber
    ['#f2c230', '#f7d65e', '#d9a816'], // zerdeçal
  ],
};

const DENSITIES = [
  ['mdpi', 1],
  ['hdpi', 1.5],
  ['xhdpi', 2],
  ['xxhdpi', 3],
  ['xxxhdpi', 4],
];

const SPLASH = [
  ['drawable', 480, 320],
  ['drawable-port-mdpi', 320, 480],
  ['drawable-port-hdpi', 480, 800],
  ['drawable-port-xhdpi', 720, 1280],
  ['drawable-port-xxhdpi', 960, 1600],
  ['drawable-port-xxxhdpi', 1280, 1920],
  ['drawable-land-mdpi', 480, 320],
  ['drawable-land-hdpi', 800, 480],
  ['drawable-land-xhdpi', 1280, 720],
  ['drawable-land-xxhdpi', 1600, 960],
  ['drawable-land-xxxhdpi', 1920, 1280],
];

// Runs inside the browser page. Draws one image and returns a PNG data URL.
// kind: 'square' | 'round' | 'foreground' | 'store' | 'splash'
function render({ kind, w, h, colors }) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d');

  // Deterministic RNG (mulberry32) so every size gets the same shading pattern.
  function rng(seed) {
    return () => {
      seed |= 0;
      seed = (seed + 0x6d2b79f5) | 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function bgGradient(x, y, s) {
    const g = ctx.createLinearGradient(x, y, x + s * 0.4, y + s);
    g.addColorStop(0, colors.bgTop);
    g.addColorStop(1, colors.bgBottom);
    return g;
  }

  function roundRect(x, y, s, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + s, y, x + s, y + s, r);
    ctx.arcTo(x + s, y + s, x, y + s, r);
    ctx.arcTo(x, y + s, x, y, r);
    ctx.arcTo(x, y, x + s, y, r);
    ctx.closePath();
  }

  // Pixel sand mound in a square box (bx, by, size). 12×12 cell grid.
  function drawSand(bx, by, size) {
    const N = 12;
    const cell = size / N;
    const gap = cell >= 6 ? cell * 0.1 : 0;
    const rand = rng(20251120);
    // Column heights: a mound slightly off-centre, peak under the falling stream (col 6).
    const heights = [2, 3, 4, 5, 6, 7, 7, 6, 6, 4, 3, 2];
    // Wobble shifts the colour bands per column so layers look poured, not ruled.
    const wobble = [0, 1, 1, 0, 0, 1, 0, 0, 1, 1, 0, 0];
    const cells = [];
    for (let x = 0; x < N; x++) {
      for (let r = 0; r < heights[x]; r++) {
        const band = Math.min(colors.sand.length - 1, Math.floor((r + wobble[x]) / 2));
        cells.push([x, N - 1 - r, band]);
      }
    }
    // Falling stream above the peak (zerdeçal) + a couple of loose grains.
    const top = colors.sand.length - 1;
    for (const [x, y] of [[6, 4], [6, 3], [6, 1], [7, 0]]) cells.push([x, y, top]);
    cells.push([5, 2, 2]);

    for (const [x, y, band] of cells) {
      const v = rand();
      const shade = v < 0.2 ? 1 : v > 0.8 ? 2 : 0;
      ctx.fillStyle = colors.sand[band][shade];
      const px = bx + x * cell;
      const py = by + y * cell;
      ctx.fillRect(px + gap / 2, py + gap / 2, cell - gap, cell - gap);
    }
  }

  // Soft shadow under the mound for depth (only when big enough to read).
  function drawGround(bx, by, size) {
    // Elliptical radial gradient; the filled rect covers the whole gradient so no hard edges.
    const r = size * 0.62;
    ctx.save();
    ctx.translate(bx + size / 2, by + size * 0.98);
    ctx.scale(1, 0.22);
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, r);
    g.addColorStop(0, 'rgba(0,0,0,0.35)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(-r, -r, 2 * r, 2 * r);
    ctx.restore();
  }

  function art(cx, cy, box) {
    const bx = Math.round(cx - box / 2);
    const by = Math.round(cy - box / 2);
    drawGround(bx, by, box);
    drawSand(bx, by, box);
  }

  ctx.clearRect(0, 0, w, h);
  const s = Math.min(w, h);
  if (kind === 'square') {
    // Legacy launcher icon: 44/48 rounded square, content inside.
    const m = s * (2 / 48);
    const bs = s - 2 * m;
    roundRect(m, m, bs, bs * 0.18);
    ctx.fillStyle = bgGradient(m, m, bs);
    ctx.fill();
    ctx.save();
    ctx.clip();
    art(s / 2, s / 2, bs * 0.72);
    ctx.restore();
  } else if (kind === 'round') {
    const m = s * (2 / 48);
    const bs = s - 2 * m;
    ctx.beginPath();
    ctx.arc(s / 2, s / 2, bs / 2, 0, Math.PI * 2);
    ctx.fillStyle = bgGradient(m, m, bs);
    ctx.fill();
    ctx.save();
    ctx.clip();
    art(s / 2, s / 2, bs * 0.62);
    ctx.restore();
  } else if (kind === 'foreground') {
    // Adaptive icon foreground: 108dp canvas, keep art inside the 66dp safe zone.
    art(s / 2, s / 2, s * (60 / 108));
  } else if (kind === 'store') {
    // Play Store: full-bleed square; Play applies its own corner mask.
    ctx.fillStyle = bgGradient(0, 0, s);
    ctx.fillRect(0, 0, s, s);
    art(s / 2, s / 2, s * 0.7);
  } else if (kind === 'splash') {
    ctx.fillStyle = colors.appBg;
    ctx.fillRect(0, 0, w, h);
    const bs = Math.round(s * 0.34);
    const x = (w - bs) / 2;
    const y = (h - bs) / 2;
    roundRect(x, y, bs, bs * 0.18);
    ctx.fillStyle = bgGradient(x, y, bs);
    ctx.fill();
    ctx.save();
    ctx.clip();
    art(w / 2, h / 2, bs * 0.72);
    ctx.restore();
  }
  return c.toDataURL('image/png');
}

async function main() {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.setContent('<!doctype html><html><body></body></html>');
  const out = [];
  const write = async (file, opts) => {
    const url = await page.evaluate(render, { ...opts, colors: COLORS });
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, Buffer.from(url.split(',')[1], 'base64'));
    out.push(path.relative(ROOT, file));
  };

  for (const [dpi, k] of DENSITIES) {
    const dir = path.join(RES, `mipmap-${dpi}`);
    const legacy = Math.round(48 * k);
    const fg = Math.round(108 * k);
    await write(path.join(dir, 'ic_launcher.png'), { kind: 'square', w: legacy, h: legacy });
    await write(path.join(dir, 'ic_launcher_round.png'), { kind: 'round', w: legacy, h: legacy });
    await write(path.join(dir, 'ic_launcher_foreground.png'), { kind: 'foreground', w: fg, h: fg });
  }
  for (const [dir, w, h] of SPLASH) {
    await write(path.join(RES, dir, 'splash.png'), { kind: 'splash', w, h });
  }
  await write(path.join(ROOT, 'store/icon-512.png'), { kind: 'store', w: 512, h: 512 });

  await browser.close();
  console.log(`${out.length} dosya yazıldı:\n  ${out.join('\n  ')}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
