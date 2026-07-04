/*
 * LimeEdit server — serves the BBEdit-style frontend, the Monaco editor
 * (the editor core of microsoft/vscode), and a small file-system API.
 *
 * Usage:  node server.js [workspace-dir] [--port N]
 */
'use strict';

const express = require('express');
const fs = require('fs');
const fsp = require('fs/promises');
const path = require('path');

const args = process.argv.slice(2);
let workspaceArg = null;
let port = Number(process.env.PORT) || 3000;
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--port' && args[i + 1]) {
    port = Number(args[++i]);
  } else if (!workspaceArg) {
    workspaceArg = args[i];
  }
}

const ROOT = fs.realpathSync(path.resolve(workspaceArg || process.env.LIMEEDIT_DIR || process.cwd()));
const SKIP_DIRS = new Set(['.git', 'node_modules', '.hg', '.svn', '__pycache__', '.cache']);
const MAX_SEARCH_FILE_SIZE = 1.5 * 1024 * 1024; // skip huge files in multi-file search
const MAX_SEARCH_MATCHES = 2000;
const MAX_QUICKOPEN_RESULTS = 200;

// Account + synced settings live outside the workspace so they don't pollute
// the user's project. LIMEEDIT_DATA overrides the location (tests use it).
const DATA_DIR = process.env.LIMEEDIT_DATA || path.join(__dirname, '.limeedit-data');
const ACCOUNT_FILE = path.join(DATA_DIR, 'account.json');

const app = express();
app.use(express.json({ limit: '64mb' }));

/** Resolve a workspace-relative path, refusing anything that escapes ROOT. */
function resolveSafe(relPath) {
  const abs = path.resolve(ROOT, relPath || '.');
  if (abs !== ROOT && !abs.startsWith(ROOT + path.sep)) {
    const err = new Error('Path is outside the workspace');
    err.status = 403;
    throw err;
  }
  return abs;
}

function looksBinary(buf) {
  const len = Math.min(buf.length, 8000);
  for (let i = 0; i < len; i++) {
    if (buf[i] === 0) return true;
  }
  return false;
}

// ---------------------------------------------------------------- tree
app.get('/api/tree', async (req, res) => {
  try {
    const abs = resolveSafe(req.query.path || '');
    const dirents = await fsp.readdir(abs, { withFileTypes: true });
    const entries = dirents
      .filter((d) => d.isFile() || d.isDirectory())
      .map((d) => ({ name: d.name, type: d.isDirectory() ? 'dir' : 'file' }))
      .sort((a, b) =>
        a.type === b.type ? a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }) : a.type === 'dir' ? -1 : 1
      );
    res.json({ root: path.basename(ROOT), entries });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

// ---------------------------------------------------------------- read file
app.get('/api/file', async (req, res) => {
  try {
    const abs = resolveSafe(req.query.path);
    const buf = await fsp.readFile(abs);
    if (looksBinary(buf)) {
      return res.status(415).json({ error: 'File appears to be binary' });
    }
    res.json({ path: req.query.path, content: buf.toString('utf8') });
  } catch (err) {
    res.status(err.status || (err.code === 'ENOENT' ? 404 : 500)).json({ error: err.message });
  }
});

// ---------------------------------------------------------------- write file
app.post('/api/file', async (req, res) => {
  try {
    const { path: relPath, content } = req.body || {};
    if (typeof relPath !== 'string' || typeof content !== 'string') {
      return res.status(400).json({ error: 'Expected { path, content }' });
    }
    const abs = resolveSafe(relPath);
    await fsp.mkdir(path.dirname(abs), { recursive: true });
    await fsp.writeFile(abs, content, 'utf8');
    res.json({ ok: true, path: relPath });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

// ---------------------------------------------------------------- walk helper
async function* walk(dir, rel = '') {
  let dirents;
  try {
    dirents = await fsp.readdir(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const d of dirents) {
    if (d.isDirectory()) {
      if (SKIP_DIRS.has(d.name)) continue;
      yield* walk(path.join(dir, d.name), rel ? `${rel}/${d.name}` : d.name);
    } else if (d.isFile()) {
      yield rel ? `${rel}/${d.name}` : d.name;
    }
  }
}

// ---------------------------------------------------------------- quick open
app.get('/api/files', async (req, res) => {
  try {
    const q = String(req.query.q || '').toLowerCase();
    const results = [];
    for await (const relPath of walk(ROOT)) {
      if (q && !fuzzyMatch(q, relPath.toLowerCase())) continue;
      results.push(relPath);
      if (results.length >= MAX_QUICKOPEN_RESULTS) break;
    }
    res.json({ files: results });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/** Subsequence match, like editor quick-open filters. */
function fuzzyMatch(query, target) {
  let qi = 0;
  for (let ti = 0; ti < target.length && qi < query.length; ti++) {
    if (target[ti] === query[qi]) qi++;
  }
  return qi === query.length;
}

// ---------------------------------------------------------------- multi-file search
app.post('/api/search', async (req, res) => {
  try {
    const { query, isRegex = false, caseSensitive = false, wholeWord = false } = req.body || {};
    if (!query) return res.status(400).json({ error: 'Missing search query' });

    let source = isRegex ? query : query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    if (wholeWord) source = `\\b(?:${source})\\b`;
    let re;
    try {
      re = new RegExp(source, caseSensitive ? 'g' : 'gi');
    } catch (e) {
      return res.status(400).json({ error: `Invalid pattern: ${e.message}` });
    }

    const matches = [];
    let filesSearched = 0;
    outer: for await (const relPath of walk(ROOT)) {
      const abs = path.join(ROOT, relPath);
      let stat;
      try {
        stat = await fsp.stat(abs);
      } catch {
        continue;
      }
      if (stat.size > MAX_SEARCH_FILE_SIZE) continue;
      const buf = await fsp.readFile(abs);
      if (looksBinary(buf)) continue;
      filesSearched++;
      const lines = buf.toString('utf8').split(/\r\n|\r|\n/);
      for (let i = 0; i < lines.length; i++) {
        re.lastIndex = 0;
        const m = re.exec(lines[i]);
        if (m) {
          matches.push({
            file: relPath,
            line: i + 1,
            column: m.index + 1,
            length: m[0].length || 1,
            text: lines[i].length > 400 ? lines[i].slice(0, 400) : lines[i],
          });
          if (matches.length >= MAX_SEARCH_MATCHES) break outer;
        }
      }
    }
    res.json({ matches, filesSearched, limited: matches.length >= MAX_SEARCH_MATCHES });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ---------------------------------------------------------------- workspace info
app.get('/api/workspace', (_req, res) => {
  res.json({ root: ROOT, name: path.basename(ROOT) });
});

// ---------------------------------------------------------------- account + sync
// A lightweight single-user profile, persisted server-side. There is no real
// authentication here — it's a local editor — so this is a stored identity plus
// a home for VS Code-style settings sync, not a security boundary.

async function readAccount() {
  try {
    return JSON.parse(await fsp.readFile(ACCOUNT_FILE, 'utf8'));
  } catch {
    return null;
  }
}

app.get('/api/account', async (_req, res) => {
  res.json({ account: await readAccount() });
});

app.post('/api/account', async (req, res) => {
  const { name, email, settings } = req.body || {};
  if (typeof name !== 'string' || !name.trim()) {
    return res.status(400).json({ error: 'A display name is required' });
  }
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: 'That email address looks invalid' });
  }
  const existing = await readAccount();
  const account = {
    name: name.trim().slice(0, 80),
    email: (email || '').trim().slice(0, 120),
    // Avatar is a deterministic colour derived from the name, HSL as a hex-ish string.
    color: existing && existing.name === name.trim() ? existing.color : avatarColor(name),
    settings: settings && typeof settings === 'object' ? settings : (existing && existing.settings) || {},
    signedInAt: new Date().toISOString(),
  };
  await fsp.mkdir(DATA_DIR, { recursive: true });
  await fsp.writeFile(ACCOUNT_FILE, JSON.stringify(account, null, 2), 'utf8');
  res.json({ account });
});

// Persist just the synced settings blob for the signed-in account.
app.put('/api/account/settings', async (req, res) => {
  const account = await readAccount();
  if (!account) return res.status(401).json({ error: 'Not signed in' });
  account.settings = req.body && typeof req.body === 'object' ? req.body : {};
  account.syncedAt = new Date().toISOString();
  await fsp.writeFile(ACCOUNT_FILE, JSON.stringify(account, null, 2), 'utf8');
  res.json({ account });
});

app.delete('/api/account', async (_req, res) => {
  await fsp.rm(ACCOUNT_FILE, { force: true });
  res.json({ ok: true });
});

function avatarColor(name) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  return `hsl(${hash % 360}, 55%, 45%)`;
}

// ---------------------------------------------------------------- backups
// Automatic snapshots of open documents, stored server-side (outside the
// workspace). Each backup is one JSON file; we keep the most recent
// BACKUPS_PER_KEY per document and BACKUPS_TOTAL overall.
const BACKUP_DIR = path.join(DATA_DIR, 'backups');
const BACKUPS_PER_KEY = 25;
const BACKUPS_TOTAL = 400;

function sanitizeKey(key) {
  return String(key).replace(/[^A-Za-z0-9._-]/g, '_').slice(0, 120) || 'untitled';
}

async function listBackupFiles() {
  try {
    const names = await fsp.readdir(BACKUP_DIR);
    return names.filter((n) => n.endsWith('.bak.json'));
  } catch {
    return [];
  }
}

app.post('/api/backup', async (req, res) => {
  try {
    const { key, path: docPath = null, name = 'untitled', content } = req.body || {};
    if (typeof key !== 'string' || !key || typeof content !== 'string') {
      return res.status(400).json({ error: 'Expected { key, content }' });
    }
    await fsp.mkdir(BACKUP_DIR, { recursive: true });
    const safe = sanitizeKey(key);
    const time = Date.now();
    const file = `${safe}__${time}.bak.json`;
    await fsp.writeFile(
      path.join(BACKUP_DIR, file),
      JSON.stringify({ key, path: docPath, name, content, time }),
      'utf8'
    );

    // Prune: keep newest BACKUPS_PER_KEY for this key, then a global cap.
    const files = await listBackupFiles();
    const mine = files.filter((f) => f.startsWith(safe + '__')).sort().reverse();
    for (const stale of mine.slice(BACKUPS_PER_KEY)) {
      await fsp.rm(path.join(BACKUP_DIR, stale), { force: true });
    }
    const all = (await listBackupFiles()).sort().reverse();
    for (const stale of all.slice(BACKUPS_TOTAL)) {
      await fsp.rm(path.join(BACKUP_DIR, stale), { force: true });
    }
    res.json({ ok: true, time });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/backups', async (_req, res) => {
  const files = await listBackupFiles();
  const entries = [];
  for (const file of files) {
    try {
      const meta = JSON.parse(await fsp.readFile(path.join(BACKUP_DIR, file), 'utf8'));
      entries.push({
        file,
        key: meta.key,
        path: meta.path,
        name: meta.name,
        time: meta.time,
        size: (meta.content || '').length,
      });
    } catch {
      /* skip corrupt backup */
    }
  }
  entries.sort((a, b) => b.time - a.time);
  res.json({ backups: entries });
});

app.get('/api/backup', async (req, res) => {
  const file = String(req.query.file || '');
  if (!/^[A-Za-z0-9._-]+\.bak\.json$/.test(file)) {
    return res.status(400).json({ error: 'Bad backup id' });
  }
  try {
    const meta = JSON.parse(await fsp.readFile(path.join(BACKUP_DIR, file), 'utf8'));
    res.json(meta);
  } catch {
    res.status(404).json({ error: 'Backup not found' });
  }
});

// ---------------------------------------------------------------- static assets
// Monaco — the editor of microsoft/vscode — served straight from the npm package.
app.use('/vs', express.static(path.join(__dirname, 'node_modules', 'monaco-editor', 'min', 'vs')));
app.use(express.static(path.join(__dirname, 'public')));

const server = app.listen(port, () => {
  console.log(`LimeEdit serving ${ROOT}`);
  console.log(`  → http://localhost:${server.address().port}`);
});

module.exports = { app, server };
