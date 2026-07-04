/*
 * LIMEdit BLOCK — server.js
 * A dependency-free static server so the OS can be served from anywhere. It
 * deliberately does NOT reuse the LimeEdit editor server; BLOCK stands alone.
 *
 *   node limedit-block/server.js [--port N]      (default 4000)
 *
 * You can also just open limedit-block/index.html directly in a browser — the
 * whole OS is client-side.
 */
'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);
let port = Number(process.env.PORT) || 4000;
for (let i = 0; i < args.length; i++) if (args[i] === '--port' && args[i + 1]) port = Number(args[++i]);

const ROOT = __dirname;
const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.json': 'application/json',
};

const server = http.createServer((req, res) => {
  let urlPath = decodeURIComponent(req.url.split('?')[0]);
  if (urlPath === '/') urlPath = '/index.html';
  const abs = path.normalize(path.join(ROOT, urlPath));
  if (!abs.startsWith(ROOT)) { res.writeHead(403); res.end('Forbidden'); return; }
  fs.readFile(abs, (err, data) => {
    if (err) { res.writeHead(404, { 'Content-Type': 'text/plain' }); res.end('Not found'); return; }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(abs)] || 'application/octet-stream' });
    res.end(data);
  });
});

server.listen(port, () => {
  console.log('LIMEdit BLOCK booting at http://localhost:' + port + '  (Ctrl+C to power off)');
});
