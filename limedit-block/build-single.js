/*
 * LIMEdit BLOCK — build-single.js
 * Inlines the CSS and all JS into one self-contained HTML file:
 *
 *   node limedit-block/build-single.js     →  limedit-block/dist/limedit-block.html
 *
 * The output runs from anywhere — double-click it, e-mail it, drop it on any
 * static host (GitHub Pages, Netlify Drop, …). That single file IS the
 * internet-distributable version of the OS.
 */
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');

const SCRIPTS = ['js/kernel.js', 'js/neofetch.js', 'js/commands.js', 'js/shell.js', 'js/apps.js', 'js/gui.js', 'js/boot.js'];

let html = read('index.html');

// Inline the stylesheet.
html = html.replace(/<link rel="stylesheet" href="css\/block\.css" \/>/,
  () => '<style>\n' + read('css/block.css') + '\n</style>');

// Inline every script (guard any "</script" inside the sources).
for (const src of SCRIPTS) {
  const js = read(src).replace(/<\/script/gi, '<\\/script');
  html = html.replace(new RegExp(`<script src="${src.replace('/', '\\/')}"></script>`),
    () => `<script>\n${js}\n</script>`);
}

if (/src="js\//.test(html) || /href="css\//.test(html)) {
  console.error('build-single: some assets were not inlined — aborting');
  process.exit(1);
}

fs.mkdirSync(path.join(ROOT, 'dist'), { recursive: true });
const out = path.join(ROOT, 'dist', 'limedit-block.html');
fs.writeFileSync(out, html);
console.log('built ' + out + '  (' + (html.length / 1024).toFixed(0) + ' KB, fully self-contained)');
