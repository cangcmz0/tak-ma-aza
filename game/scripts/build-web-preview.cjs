#!/usr/bin/env node
// Inlines the Vite build (dist/) into one HTML body fragment that can be
// published as a single-page web preview (Claude artifact).
// Usage: npm run build && node scripts/build-web-preview.cjs <output.html>
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const dist = path.join(root, 'dist');
const out = process.argv[2] || path.join(root, 'web-preview', 'kum-akisi.html');

const html = fs.readFileSync(path.join(dist, 'index.html'), 'utf8');
const read = (href) => fs.readFileSync(path.join(dist, href.replace(/^\.?\//, '')), 'utf8');

const css = [...html.matchAll(/<link[^>]+rel="stylesheet"[^>]+href="([^"]+)"[^>]*>/g)].map((m) => read(m[1]));
const js = [...html.matchAll(/<script[^>]+type="module"[^>]+src="([^"]+)"[^>]*><\/script>/g)].map((m) => read(m[1]));
if (!js.length) throw new Error('No module script found in dist/index.html — run `npm run build` first.');

const title = (html.match(/<title>([^<]*)<\/title>/) || [, 'Kum Akışı'])[1];
const safe = (s) => s.replace(/<\/(script|style)/gi, '<\\/$1');

const page = [
  `<title>${title}</title>`,
  `<meta name="theme-color" content="#14112b">`,
  `<style>${safe(css.join('\n'))}</style>`,
  `<main id="app"></main>`,
  ...js.map((s) => `<script type="module">${safe(s)}</script>`),
].join('\n');

fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, page);
console.log(`Web preview written: ${out} (${(page.length / 1024).toFixed(1)} KB)`);
