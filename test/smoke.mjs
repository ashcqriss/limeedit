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

// Keep account/settings data out of the repo during tests.
const dataDir = await fs.mkdtemp(path.join(os.tmpdir(), 'limeedit-data-'));

const server = spawn(process.execPath, [path.join(here, '..', 'server.js'), workspace, '--port', String(PORT)], {
  stdio: ['ignore', 'pipe', 'inherit'],
  env: { ...process.env, LIMEEDIT_DATA: dataDir },
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
  // the extensions module is served to the browser
  res = await fetch(`${BASE}/js/extensions.js`);
  assert.equal(res.status, 200);

  // account: starts empty
  res = await fetch(`${BASE}/api/account`);
  assert.deepEqual(await res.json(), { account: null });

  // account: a name is required
  res = await fetch(`${BASE}/api/account`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: '' }),
  });
  assert.equal(res.status, 400);

  // account: invalid email is rejected
  res = await fetch(`${BASE}/api/account`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Ada', email: 'not-an-email' }),
  });
  assert.equal(res.status, 400);

  // account: sign in, then read it back
  res = await fetch(`${BASE}/api/account`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Ada Lovelace', email: 'ada@example.com', settings: { theme: 'dark' } }),
  });
  assert.equal(res.status, 200);
  data = await res.json();
  assert.equal(data.account.name, 'Ada Lovelace');
  assert.ok(data.account.color.startsWith('hsl('));
  res = await fetch(`${BASE}/api/account`);
  assert.equal((await res.json()).account.email, 'ada@example.com');

  // account: settings sync updates the stored blob
  res = await fetch(`${BASE}/api/account/settings`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ theme: 'light', tabWidth: 2 }),
  });
  assert.equal((await res.json()).account.settings.tabWidth, 2);

  // account: sign out clears it
  res = await fetch(`${BASE}/api/account`, { method: 'DELETE' });
  assert.equal(res.status, 200);
  res = await fetch(`${BASE}/api/account`);
  assert.deepEqual(await res.json(), { account: null });

  // backups: none to start
  res = await fetch(`${BASE}/api/backups`);
  assert.deepEqual((await res.json()).backups, []);

  // backups: a key + content are required
  res = await fetch(`${BASE}/api/backup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ key: 'file:a.txt' }),
  });
  assert.equal(res.status, 400);

  // backups: snapshot a document, then read it back by id
  res = await fetch(`${BASE}/api/backup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ key: 'file:notes.txt', path: 'notes.txt', name: 'notes.txt', content: 'draft one' }),
  });
  assert.equal(res.status, 200);
  res = await fetch(`${BASE}/api/backups`);
  data = await res.json();
  assert.equal(data.backups.length, 1);
  assert.equal(data.backups[0].name, 'notes.txt');
  assert.equal(data.backups[0].size, 'draft one'.length);
  res = await fetch(`${BASE}/api/backup?file=${encodeURIComponent(data.backups[0].file)}`);
  assert.equal((await res.json()).content, 'draft one');

  // backups: a second snapshot of the same key is kept as a distinct entry
  await fetch(`${BASE}/api/backup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ key: 'file:notes.txt', path: 'notes.txt', name: 'notes.txt', content: 'draft two' }),
  });
  res = await fetch(`${BASE}/api/backups`);
  assert.equal((await res.json()).backups.length, 2);

  // backups: a bad id is rejected (no path traversal)
  res = await fetch(`${BASE}/api/backup?file=../account.json`);
  assert.equal(res.status, 400);

  console.log('✓ all smoke tests passed');
} finally {
  server.kill();
  await fs.rm(workspace, { recursive: true, force: true });
  await fs.rm(dataDir, { recursive: true, force: true });
}
