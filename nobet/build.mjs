// Tek dosyalık derleme: dist/index.html (web ve ileride Capacitor) ve
// dist/nobet-artifact.html (claude.ai sayfası için, html/head/body etiketsiz).
import { build, transform } from 'esbuild';
import { mkdir, readFile, writeFile } from 'node:fs/promises';

const js = await build({
  entryPoints: ['src/main.ts'],
  bundle: true,
  minify: true,
  format: 'iife',
  target: 'es2019',
  write: false,
  legalComments: 'none',
});
const script = js.outputFiles[0].text;
const css = (await transform(await readFile('src/style.css', 'utf8'), { loader: 'css', minify: true })).code;
const body = await readFile('src/body.html', 'utf8');

if (/<\/script/i.test(script)) throw new Error('script içinde </script> var');

const fonts =
  '<link rel="preconnect" href="https://fonts.googleapis.com">' +
  '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>' +
  '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Chakra+Petch:wght@600;700&family=Rubik:wght@400;500;600;700&display=swap">';
const head = `<title>Nöbet</title>\n<meta name="claude:viewport-fit-sides" content="cover">\n<meta name="theme-color" content="#0b1d22">\n${fonts}`;

const full = `<!doctype html>
<html lang="tr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
${head}
<style>:root{padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}[hidden]{display:none!important}${css}</style>
</head>
<body>
${body}
<script>${script}</script>
</body>
</html>
`;

const fragment = `${head}\n<style>${css}</style>\n${body}\n<script>${script}</script>\n`;

await mkdir('dist', { recursive: true });
await writeFile('dist/index.html', full);
await writeFile('dist/nobet-artifact.html', fragment);
console.log(`dist/index.html ${(full.length / 1024).toFixed(1)} KB`);
