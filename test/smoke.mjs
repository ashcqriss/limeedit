/*
 * Smoke test: boots the server against a temp workspace and exercises
 * every API endpoint plus the static Monaco/frontend routes.
 */
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const PORT = 3999;
const BASE = `http://127.0.0.1:${PORT}`;

const workspace = await fs.mkdtemp(path.join(os.tmpdir(), 'limeedit-test-'));
await fs.mkdir(path.join(workspace, 'src'));
await fs.writeFile(path.join(workspace, 'hello.txt'), 'hello world\nsecond line\n');
await fs.writeFile(path.join(workspace, 'src', 'main.js'), 'function greet() {\n  return "hello";\n}\n');

const server = spawn(process.execPath, [path.join(here, '..', 'server.js'), workspace, '--port', String(PORT)], {
  stdio: ['ignore', 'pipe', 'inherit'],
});

try {
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('server did not start')), 10000);
    server.stdout.on('data', (chunk) => {
      if (String(chunk).includes('http://')) {
        clearTimeout(timer);
        resolve();
      }
    });
    server.on('exit', (code) => reject(new Error(`server exited early (${code})`)));
  });

  // workspace info
  let res = await fetch(`${BASE}/api/workspace`);
  assert.equal(res.status, 200);
  assert.equal((await res.json()).root, await fs.realpath(workspace));

  // tree
  res = await fetch(`${BASE}/api/tree?path=`);
  let data = await res.json();
  assert.deepEqual(
    data.entries.map((e) => `${e.type}:${e.name}`),
    ['dir:src', 'file:hello.txt']
  );

  // read file
  res = await fetch(`${BASE}/api/file?path=hello.txt`);
  data = await res.json();
  assert.equal(data.content, 'hello world\nsecond line\n');

  // path traversal is refused
  res = await fetch(`${BASE}/api/file?path=../../etc/passwd`);
  assert.equal(res.status, 403);

  // write file
  res = await fetch(`${BASE}/api/file`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path: 'new/created.txt', content: 'made by test\n' }),
  });
  assert.equal(res.status, 200);
  assert.equal(await fs.readFile(path.join(workspace, 'new', 'created.txt'), 'utf8'), 'made by test\n');

  // multi-file search (plain)
  res = await fetch(`${BASE}/api/search`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: 'hello' }),
  });
  data = await res.json();
  assert.equal(data.matches.length, 2);
  assert.ok(data.matches.some((m) => m.file === 'hello.txt' && m.line === 1));
  assert.ok(data.matches.some((m) => m.file === 'src/main.js' && m.line === 2));

  // multi-file search (grep)
  res = await fetch(`${BASE}/api/search`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: 'function\\s+\\w+', isRegex: true }),
  });
  data = await res.json();
  assert.equal(data.matches.length, 1);
  assert.equal(data.matches[0].file, 'src/main.js');

  // quick open
  res = await fetch(`${BASE}/api/files?q=mnjs`);
  data = await res.json();
  assert.deepEqual(data.files, ['src/main.js']);

  // frontend + Monaco (the vscode editor core) are served
  res = await fetch(`${BASE}/`);
  assert.equal(res.status, 200);
  assert.ok((await res.text()).includes('LimeEdit'));
  res = await fetch(`${BASE}/vs/loader.js`);
  assert.equal(res.status, 200);
  res = await fetch(`${BASE}/vs/editor/editor.main.js`);
  assert.equal(res.status, 200);

  console.log('✓ all smoke tests passed');
} finally {
  server.kill();
  await fs.rm(workspace, { recursive: true, force: true });
}
