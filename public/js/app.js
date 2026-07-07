/*
 * app.js — LimeEdit main application.
 *
 * A BBEdit-style shell (sidebar of open documents, Text menu tools,
 * multi-file search, function popup, status bar) wrapped around Monaco,
 * the editor core of microsoft/vscode.
 */

import * as texttools from './texttools.js';
import { scanFunctions } from './functionscanner.js';
import { ExtensionHost, BUILTIN_EXTENSIONS, compileRawExtension } from './extensions.js';
import { registerExtraLanguages, FILENAME_LANGUAGE, EXT_LANGUAGE } from './languages.js';

const monaco = await window.monacoReady;

// Register the config/build languages Monaco doesn't bundle (TOML, .env, Make).
registerExtraLanguages(monaco);

// ---------------------------------------------------------------- themes

monaco.editor.defineTheme('lime-light', {
  base: 'vs',
  inherit: true,
  rules: [
    { token: 'comment', foreground: 'b22222' },
    { token: 'keyword', foreground: '0f30c4' },
    { token: 'string', foreground: '6b2fb2' },
    { token: 'number', foreground: '1a6f1a' },
    { token: 'type', foreground: '3f6e74' },
  ],
  colors: {
    'editor.background': '#ffffff',
    'editor.lineHighlightBackground': '#f2f7e8',
    'editorLineNumber.foreground': '#b0b0b0',
    'editorCursor.foreground': '#333333',
  },
});

monaco.editor.defineTheme('lime-dark', {
  base: 'vs-dark',
  inherit: true,
  rules: [
    { token: 'comment', foreground: 'd98a8a' },
    { token: 'keyword', foreground: '82aaff' },
    { token: 'string', foreground: 'c792ea' },
    { token: 'number', foreground: '9ccc65' },
  ],
  colors: {
    'editor.background': '#1e1e1e',
    'editor.lineHighlightBackground': '#26301a',
  },
});

// Zed's identity: the "One" themes. Zed itself is a native Rust editor and has
// no web-embeddable core, so we can't run its engine here — but we can dress
// Monaco in Zed's signature One Dark / One Light palettes.
monaco.editor.defineTheme('zed-one-dark', {
  base: 'vs-dark',
  inherit: true,
  rules: [
    { token: 'comment', foreground: '5c6370', fontStyle: 'italic' },
    { token: 'keyword', foreground: 'c678dd' },
    { token: 'string', foreground: '98c379' },
    { token: 'number', foreground: 'd19a66' },
    { token: 'type', foreground: 'e5c07b' },
    { token: 'delimiter', foreground: 'abb2bf' },
    { token: 'operator', foreground: '56b6c2' },
  ],
  colors: {
    'editor.background': '#282c34',
    'editor.foreground': '#abb2bf',
    'editor.lineHighlightBackground': '#2c313a',
    'editorLineNumber.foreground': '#4b5263',
    'editorCursor.foreground': '#528bff',
    'editor.selectionBackground': '#3e4451',
  },
});

monaco.editor.defineTheme('zed-one-light', {
  base: 'vs',
  inherit: true,
  rules: [
    { token: 'comment', foreground: 'a0a1a7', fontStyle: 'italic' },
    { token: 'keyword', foreground: 'a626a4' },
    { token: 'string', foreground: '50a14f' },
    { token: 'number', foreground: '986801' },
    { token: 'type', foreground: 'c18401' },
    { token: 'operator', foreground: '0184bc' },
  ],
  colors: {
    'editor.background': '#fafafa',
    'editor.foreground': '#383a42',
    'editor.lineHighlightBackground': '#f0f0f0',
    'editorLineNumber.foreground': '#9d9d9f',
    'editorCursor.foreground': '#526fff',
    'editor.selectionBackground': '#e5e5e6',
  },
});

// Modern Zed's own default look: clean white, flat (no shadows), with a glossy
// blue accent and a blue caret. The dark sibling keeps the same flat, minimal
// feel on Zed's near-black slate.
monaco.editor.defineTheme('zed-flat-light', {
  base: 'vs',
  inherit: true,
  rules: [
    { token: 'comment', foreground: '9aa0a6' },
    { token: 'keyword', foreground: '2472f8' },
    { token: 'string', foreground: '3f8f3f' },
    { token: 'number', foreground: 'c2410c' },
    { token: 'type', foreground: '0e7490' },
    { token: 'operator', foreground: '2472f8' },
  ],
  colors: {
    'editor.background': '#ffffff',
    'editor.foreground': '#1f2023',
    'editor.lineHighlightBackground': '#f4f7ff',
    'editorLineNumber.foreground': '#c3c7cd',
    'editorCursor.foreground': '#2472f8',
    'editor.selectionBackground': '#cfe0ff',
  },
});

monaco.editor.defineTheme('zed-flat-dark', {
  base: 'vs-dark',
  inherit: true,
  rules: [
    { token: 'comment', foreground: '5a6069' },
    { token: 'keyword', foreground: '7aa2f7' },
    { token: 'string', foreground: '9ece6a' },
    { token: 'number', foreground: 'ff9e64' },
    { token: 'type', foreground: '7dcfff' },
    { token: 'operator', foreground: '7aa2f7' },
  ],
  colors: {
    'editor.background': '#131417',
    'editor.foreground': '#d5d8de',
    'editor.lineHighlightBackground': '#1a1c22',
    'editorLineNumber.foreground': '#3a3d45',
    'editorCursor.foreground': '#7aa2f7',
    'editor.selectionBackground': '#26314d',
  },
});

// BBEdit Liquid Glass — a classic BBEdit palette on a lightly translucent
// editor surface, so the frosted-glass wallpaper shows faintly through. The
// glass chrome itself lives in the CSS (backdrop-filter over a wallpaper).
monaco.editor.defineTheme('bbedit-glass-light', {
  base: 'vs',
  inherit: true,
  rules: [
    { token: 'comment', foreground: '6f8b6f', fontStyle: 'italic' },
    { token: 'keyword', foreground: '1d3fbb' },
    { token: 'string', foreground: 'b02a37' },
    { token: 'number', foreground: '7a3ea0' },
    { token: 'type', foreground: '0d7a7a' },
    { token: 'delimiter', foreground: '5a5a5f' },
  ],
  colors: {
    'editor.background': '#ffffffe6', // ~90% so the wallpaper hints through
    'editor.foreground': '#2a2a2c',
    'editor.lineHighlightBackground': '#00000008',
    'editorLineNumber.foreground': '#b3b3b8',
    'editorCursor.foreground': '#2a2a2c',
    'editor.selectionBackground': '#a8c7ff66',
  },
});

monaco.editor.defineTheme('bbedit-glass-dark', {
  base: 'vs-dark',
  inherit: true,
  rules: [
    { token: 'comment', foreground: '7f9b7f', fontStyle: 'italic' },
    { token: 'keyword', foreground: '9db4ff' },
    { token: 'string', foreground: 'e58f8f' },
    { token: 'number', foreground: 'c9a2e8' },
    { token: 'type', foreground: '6fc2c2' },
  ],
  colors: {
    'editor.background': '#1e2126e6',
    'editor.foreground': '#e2e4ea',
    'editor.lineHighlightBackground': '#ffffff0d',
    'editorLineNumber.foreground': '#5b616d',
    'editorCursor.foreground': '#e2e4ea',
    'editor.selectionBackground': '#5a8cff44',
  },
});

// Edemint Liquid Glass — the blue-led Edemint palette (docs/palette.md) on a
// flat, pure-white or pure-black editor surface. Syntax leads with the L1
// families (ultramarine C1, azure C8a), anchored by navy (C6) and plant green
// (C4), with turquoise (C7) and eco green (C3) as supporting accents. The
// caret is azure, like the glass chrome's cool accent.
monaco.editor.defineTheme('edemint-glass-light', {
  base: 'vs',
  inherit: true,
  rules: [
    { token: 'comment', foreground: '79808c', fontStyle: 'italic' },
    { token: 'keyword', foreground: '2001ff' },
    { token: 'string', foreground: '0d6300' },
    { token: 'number', foreground: '007c76' },
    { token: 'type', foreground: '002c89' },
    { token: 'operator', foreground: '0080ff' },
    { token: 'delimiter', foreground: '5a5e68' },
  ],
  colors: {
    'editor.background': '#ffffff',
    'editor.foreground': '#16181d',
    'editor.lineHighlightBackground': '#2001ff08',
    'editorLineNumber.foreground': '#b6bac4',
    'editorCursor.foreground': '#0080ff',
    'editor.selectionBackground': '#2001ff26',
    'editor.findMatchHighlightBackground': '#1ee5ce4d',
  },
});

monaco.editor.defineTheme('edemint-glass-dark', {
  base: 'vs-dark',
  inherit: true,
  rules: [
    { token: 'comment', foreground: '6b7280', fontStyle: 'italic' },
    { token: 'keyword', foreground: '6d58ff' },
    { token: 'string', foreground: '45e289' },
    { token: 'number', foreground: '1ee5ce' },
    { token: 'type', foreground: '74fbea' },
    { token: 'operator', foreground: '0080ff' },
    { token: 'delimiter', foreground: '9aa0ac' },
  ],
  colors: {
    'editor.background': '#000000',
    'editor.foreground': '#e8eaf2',
    'editor.lineHighlightBackground': '#6d58ff14',
    'editorLineNumber.foreground': '#3c4048',
    'editorCursor.foreground': '#0080ff',
    'editor.selectionBackground': '#2001ff66',
    'editor.findMatchHighlightBackground': '#04a89d59',
  },
});

// ---------------------------------------------------------------- state

const state = {
  docs: [], // { id, path, name, model, savedVersionId, viewState }
  activeId: null,
  untitledCounter: 0,
  theme: localStorage.getItem('limeedit.theme') || 'edemint-glass-light',
  softWrap: localStorage.getItem('limeedit.softWrap') === 'true',
  animations: localStorage.getItem('limeedit.animations') !== 'false',
  showInvisibles: false,
  tabWidth: Number(localStorage.getItem('limeedit.tabWidth')) || 4,
  workspaceName: '',
  account: null,
  rawMode: false,
  enabledExtensions: loadEnabledExtensions(),
  rawExtensions: [], // compiled from pasted source, this session only
};

function loadEnabledExtensions() {
  try {
    const saved = JSON.parse(localStorage.getItem('limeedit.extensions'));
    if (saved && typeof saved === 'object') return saved;
  } catch {
    /* fall through to defaults */
  }
  // Sensible defaults: the two ambient status items on, the rest off.
  return { 'limeedit.word-count': true, 'limeedit.reading-time': true };
}

// Theme registry. `base` drives the light/dark chrome fallback (data-theme);
// `id` drives the specific chrome overrides (data-app-theme); `monaco` is the
// editor theme; `sibling` is what the Dark Mode toggle flips to; `glass`
// stamps data-glass on <html>, which turns on the Liquid Glass chrome.
const THEMES = {
  'edemint-glass-light': { id: 'edemint-glass-light', label: 'Edemint Liquid Glass', base: 'light', monaco: 'edemint-glass-light', sibling: 'edemint-glass-dark', glass: true },
  'edemint-glass-dark': { id: 'edemint-glass-dark', label: 'Edemint Liquid Glass (Dark)', base: 'dark', monaco: 'edemint-glass-dark', sibling: 'edemint-glass-light', glass: true },
  'bbedit-glass-light': { id: 'bbedit-glass-light', label: 'BBEdit Liquid Glass', base: 'light', monaco: 'bbedit-glass-light', sibling: 'bbedit-glass-dark', glass: true },
  'bbedit-glass-dark': { id: 'bbedit-glass-dark', label: 'BBEdit Liquid Glass (Dark)', base: 'dark', monaco: 'bbedit-glass-dark', sibling: 'bbedit-glass-light', glass: true },
  light: { id: 'light', label: 'LimeEdit Light', base: 'light', monaco: 'lime-light', sibling: 'dark' },
  dark: { id: 'dark', label: 'LimeEdit Dark', base: 'dark', monaco: 'lime-dark', sibling: 'light' },
  zed: { id: 'zed', label: 'Zed', base: 'light', monaco: 'zed-flat-light', sibling: 'zed-dark' },
  'zed-dark': { id: 'zed-dark', label: 'Zed (Dark)', base: 'dark', monaco: 'zed-flat-dark', sibling: 'zed' },
  'zed-one-dark': { id: 'zed-one-dark', label: 'Zed — One Dark', base: 'dark', monaco: 'zed-one-dark', sibling: 'zed-one-light' },
  'zed-one-light': { id: 'zed-one-light', label: 'Zed — One Light', base: 'light', monaco: 'zed-one-light', sibling: 'zed-one-dark' },
};

function themeFor(id) {
  return THEMES[id] || THEMES.light;
}

function applyThemeAttributes(t) {
  document.documentElement.dataset.theme = t.base;
  document.documentElement.dataset.appTheme = t.id;
  if (t.glass) document.documentElement.setAttribute('data-glass', '');
  else document.documentElement.removeAttribute('data-glass');
}

const $ = (id) => document.getElementById(id);

applyThemeAttributes(themeFor(state.theme));
document.documentElement.classList.toggle('no-motion', !state.animations);

const editor = monaco.editor.create($('editor'), {
  model: null,
  theme: themeFor(state.theme).monaco,
  fontFamily: "'SF Mono', Menlo, Monaco, Consolas, 'Liberation Mono', monospace",
  fontSize: 13,
  lineHeight: 19,
  minimap: { enabled: false }, // BBEdit has no minimap; toggle it in View
  wordWrap: state.softWrap ? 'on' : 'off',
  renderWhitespace: 'none',
  automaticLayout: true,
  scrollBeyondLastLine: false,
  tabSize: state.tabWidth,
  renderLineHighlight: 'line',
  fixedOverflowWidgets: true,
  padding: { top: 4 },
  // vscode's smooth-motion feel
  smoothScrolling: state.animations,
  cursorSmoothCaretAnimation: state.animations ? 'on' : 'off',
  cursorBlinking: state.animations ? 'smooth' : 'blink',
});
window.__limeeditEditor = editor; // referenced by extension teardown

// ---------------------------------------------------------------- documents

function activeDoc() {
  return state.docs.find((d) => d.id === state.activeId) || null;
}

function isDirty(doc) {
  return doc.model.getAlternativeVersionId() !== doc.savedVersionId;
}

function languageForPath(filePath) {
  const name = filePath.split('/').pop().toLowerCase();
  const ext = name.includes('.') ? '.' + name.split('.').pop() : '';
  // Our own associations first, for files Monaco won't infer on its own.
  if (FILENAME_LANGUAGE[name]) return FILENAME_LANGUAGE[name];
  if (name.startsWith('dockerfile')) return 'dockerfile';
  if (name.startsWith('.env')) return 'dotenv';
  for (const lang of monaco.languages.getLanguages()) {
    if (lang.filenames && lang.filenames.some((f) => f.toLowerCase() === name)) return lang.id;
    if (ext && lang.extensions && lang.extensions.some((e) => e.toLowerCase() === ext)) return lang.id;
  }
  if (ext && EXT_LANGUAGE[ext]) return EXT_LANGUAGE[ext];
  return 'plaintext';
}

let nextDocId = 1;

function createDoc({ path = null, name = null, content = '' }) {
  const language = path ? languageForPath(path) : 'plaintext';
  const model = monaco.editor.createModel(content, language);
  const doc = {
    id: nextDocId++,
    path,
    name: name || (path ? path.split('/').pop() : `untitled ${++state.untitledCounter}`),
    model,
    savedVersionId: model.getAlternativeVersionId(),
    viewState: null,
  };
  model.onDidChangeContent(() => {
    renderOpenDocs();
    updateDirtyDot();
    scheduleFunctionScan();
    if (doc.id === state.activeId) scheduleExtContentEmit(model);
    scheduleBackup(doc);
  });
  state.docs.push(doc);
  return doc;
}

function activateDoc(doc) {
  const prev = activeDoc();
  if (prev) prev.viewState = editor.saveViewState();
  state.activeId = doc ? doc.id : null;
  if (doc) {
    editor.setModel(doc.model);
    if (doc.viewState) editor.restoreViewState(doc.viewState);
    editor.focus();
    $('no-doc').classList.add('hidden');
  } else {
    editor.setModel(null);
    $('no-doc').classList.remove('hidden');
  }
  renderOpenDocs();
  updateNavbar();
  updateStatusBar();
  scheduleFunctionScan();
  applyRawMode();
  extHost.emitActiveDocument(doc ? doc.model : null);
}

async function openFile(relPath, { line = null, column = null } = {}) {
  const existing = state.docs.find((d) => d.path === relPath);
  if (existing) {
    activateDoc(existing);
  } else {
    const res = await fetch(`/api/file?path=${encodeURIComponent(relPath)}`);
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      statusMessage(`Can’t open ${relPath}: ${err.error || res.statusText}`);
      return null;
    }
    const data = await res.json();
    activateDoc(createDoc({ path: relPath, content: data.content }));
  }
  if (line) {
    editor.revealLineInCenter(line);
    editor.setPosition({ lineNumber: line, column: column || 1 });
    editor.focus();
  }
  return activeDoc();
}

function newDocument() {
  activateDoc(createDoc({}));
}

async function saveDoc(doc, { saveAs = false } = {}) {
  if (!doc) return false;
  let targetPath = doc.path;
  if (!targetPath || saveAs) {
    const result = await showDialog('Save As', [
      { type: 'text', name: 'path', label: 'File path (relative to workspace)', value: doc.path || doc.name.replace(/\s+/g, '-') + '.txt' },
    ]);
    if (!result) return false;
    targetPath = result.path.trim();
    if (!targetPath) return false;
  }
  const res = await fetch('/api/file', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path: targetPath, content: doc.model.getValue() }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    statusMessage(`Save failed: ${err.error || res.statusText}`);
    return false;
  }
  const hadPath = !!doc.path;
  doc.path = targetPath;
  doc.name = targetPath.split('/').pop();
  doc.savedVersionId = doc.model.getAlternativeVersionId();
  if (!hadPath || saveAs) {
    monaco.editor.setModelLanguage(doc.model, languageForPath(targetPath));
  }
  renderOpenDocs();
  updateNavbar();
  updateStatusBar();
  statusMessage(`Saved ${doc.name}`);
  refreshTree();
  return true;
}

async function closeDoc(doc) {
  if (!doc) return;
  if (isDirty(doc)) {
    const result = await showDialog(`Save changes to “${doc.name}”?`, [
      { type: 'radio', name: 'choice', options: [
        { value: 'save', label: 'Save', checked: true },
        { value: 'discard', label: 'Don’t Save' },
      ] },
    ]);
    if (!result) return; // cancelled
    if (result.choice === 'save') {
      const saved = await saveDoc(doc);
      if (!saved) return;
    }
  }
  const idx = state.docs.indexOf(doc);
  state.docs.splice(idx, 1);
  doc.model.dispose();
  if (state.activeId === doc.id) {
    const next = state.docs[Math.min(idx, state.docs.length - 1)] || null;
    state.activeId = null;
    activateDoc(next);
  } else {
    renderOpenDocs();
  }
}

// ---------------------------------------------------------------- sidebar: open docs

function renderOpenDocs() {
  const ul = $('open-docs');
  ul.textContent = '';
  for (const doc of state.docs) {
    const li = document.createElement('li');
    li.classList.toggle('active', doc.id === state.activeId);
    li.title = doc.path || doc.name;

    const dot = document.createElement('span');
    dot.className = 'doc-dirty';
    dot.textContent = isDirty(doc) ? '•' : '';
    li.appendChild(dot);

    const nameSpan = document.createElement('span');
    nameSpan.className = 'doc-name';
    nameSpan.textContent = doc.name;
    li.appendChild(nameSpan);

    const close = document.createElement('button');
    close.className = 'doc-close';
    close.textContent = '✕';
    close.title = 'Close document';
    close.addEventListener('click', (e) => {
      e.stopPropagation();
      closeDoc(doc);
    });
    li.appendChild(close);

    li.addEventListener('click', () => activateDoc(doc));
    ul.appendChild(li);
  }
  $('open-count').textContent = state.docs.length ? `(${state.docs.length})` : '';
}

// ---------------------------------------------------------------- sidebar: file tree

const expandedDirs = new Set(['']);

async function fetchTree(relPath) {
  const res = await fetch(`/api/tree?path=${encodeURIComponent(relPath)}`);
  if (!res.ok) return [];
  const data = await res.json();
  return data.entries;
}

async function renderTreeLevel(container, relPath, depth) {
  const entries = await fetchTree(relPath);
  for (const entry of entries) {
    const entryPath = relPath ? `${relPath}/${entry.name}` : entry.name;
    const row = document.createElement('div');
    row.className = 'tree-row';
    row.style.paddingLeft = `${6 + depth * 14}px`;

    const twisty = document.createElement('span');
    twisty.className = 'twisty';
    twisty.textContent = entry.type === 'dir' ? (expandedDirs.has(entryPath) ? '▼' : '▶') : '';
    row.appendChild(twisty);

    const icon = document.createElement('span');
    icon.className = 'icon';
    icon.textContent = entry.type === 'dir' ? '📁' : '📄';
    row.appendChild(icon);

    const label = document.createElement('span');
    label.textContent = entry.name;
    row.appendChild(label);

    container.appendChild(row);

    if (entry.type === 'dir') {
      row.addEventListener('click', () => {
        if (expandedDirs.has(entryPath)) expandedDirs.delete(entryPath);
        else expandedDirs.add(entryPath);
        refreshTree();
      });
      if (expandedDirs.has(entryPath)) {
        await renderTreeLevel(container, entryPath, depth + 1);
      }
    } else {
      row.addEventListener('click', () => openFile(entryPath));
    }
  }
}

let treeRefreshQueued = false;
async function refreshTree() {
  if (treeRefreshQueued) return;
  treeRefreshQueued = true;
  try {
    const tree = $('file-tree');
    const fresh = document.createElement('div');
    await renderTreeLevel(fresh, '', 0);
    tree.textContent = '';
    while (fresh.firstChild) tree.appendChild(fresh.firstChild);
  } finally {
    treeRefreshQueued = false;
  }
}

// ---------------------------------------------------------------- navbar

function updateNavbar() {
  const doc = activeDoc();
  $('doc-path').textContent = doc ? (doc.path ? `${state.workspaceName}/${doc.path}` : '(not saved)') : '';
  updateDirtyDot();
  $('wrap-toggle').classList.toggle('on', state.softWrap);
}

function updateDirtyDot() {
  const doc = activeDoc();
  $('dirty-dot').classList.toggle('dirty', !!doc && isDirty(doc));
}

// function popup ---------------------------------------------------

let functionScanTimer = null;
let currentFunctions = [];

function scheduleFunctionScan() {
  clearTimeout(functionScanTimer);
  functionScanTimer = setTimeout(runFunctionScan, 400);
}

function runFunctionScan() {
  const doc = activeDoc();
  if (!doc) {
    currentFunctions = [];
    $('function-popup-label').textContent = '(no document)';
    return;
  }
  currentFunctions = scanFunctions(doc.model, doc.model.getLanguageId());
  updateFunctionLabel();
}

function updateFunctionLabel() {
  const pos = editor.getPosition();
  let label = currentFunctions.length ? `${currentFunctions.length} symbols` : '(no symbols)';
  if (pos && currentFunctions.length) {
    let current = null;
    for (const fn of currentFunctions) {
      if (fn.line <= pos.lineNumber) current = fn;
      else break;
    }
    if (current) label = current.name;
  }
  $('function-popup-label').textContent = label;
}

function showFunctionMenu() {
  closeFunctionMenu();
  runFunctionScan();
  const menu = document.createElement('div');
  menu.id = 'function-menu';
  if (!currentFunctions.length) {
    const item = document.createElement('div');
    item.className = 'menu-item';
    item.textContent = 'No functions found';
    menu.appendChild(item);
  }
  for (const fn of currentFunctions) {
    const item = document.createElement('div');
    item.className = 'menu-item';
    const kind = document.createElement('span');
    kind.className = 'fn-kind';
    kind.textContent = fn.kind;
    const label = document.createElement('span');
    label.className = 'menu-label';
    label.textContent = fn.name;
    const lineNo = document.createElement('span');
    lineNo.className = 'menu-accel';
    lineNo.textContent = String(fn.line);
    item.append(kind, label, lineNo);
    item.addEventListener('click', () => {
      closeFunctionMenu();
      editor.revealLineInCenter(fn.line);
      editor.setPosition({ lineNumber: fn.line, column: 1 });
      editor.focus();
    });
    menu.appendChild(item);
  }
  const rect = $('function-popup').getBoundingClientRect();
  menu.style.left = `${rect.left}px`;
  menu.style.top = `${rect.bottom + 2}px`;
  document.body.appendChild(menu);
  setTimeout(() => document.addEventListener('mousedown', functionMenuDismiss), 0);
}

function functionMenuDismiss(e) {
  const menu = document.getElementById('function-menu');
  if (menu && !menu.contains(e.target)) closeFunctionMenu();
}

function closeFunctionMenu() {
  document.getElementById('function-menu')?.remove();
  document.removeEventListener('mousedown', functionMenuDismiss);
}

$('function-popup').addEventListener('click', (e) => {
  e.stopPropagation();
  if (document.getElementById('function-menu')) closeFunctionMenu();
  else showFunctionMenu();
});

// ---------------------------------------------------------------- status bar

function updateStatusBar() {
  const doc = activeDoc();
  const model = doc ? doc.model : null;
  const pos = editor.getPosition();
  $('status-position').textContent = pos ? `Ln ${pos.lineNumber}, Col ${pos.column}` : '—';
  $('status-language').textContent = model ? languageDisplayName(model.getLanguageId()) : '—';
  $('status-eol').textContent = model ? (model.getEOL() === '\n' ? 'LF (Unix)' : 'CRLF (Windows)') : '—';
  $('status-tab').textContent = `Tab: ${state.tabWidth}`;
}

function languageDisplayName(id) {
  const lang = monaco.languages.getLanguages().find((l) => l.id === id);
  const alias = lang && lang.aliases && lang.aliases[0];
  return alias || id;
}

editor.onDidChangeCursorPosition(() => {
  updateStatusBar();
  updateFunctionLabel();
});

let statusTimer = null;
function statusMessage(msg) {
  $('status-message').textContent = msg;
  clearTimeout(statusTimer);
  statusTimer = setTimeout(() => {
    $('status-message').textContent = '';
  }, 4000);
}

$('status-eol').addEventListener('click', () => {
  const doc = activeDoc();
  if (!doc) return;
  const eol = doc.model.getEOL() === '\n' ? monaco.editor.EndOfLineSequence.CRLF : monaco.editor.EndOfLineSequence.LF;
  doc.model.pushEOL(eol);
  updateStatusBar();
});

$('status-tab').addEventListener('click', () => {
  state.tabWidth = state.tabWidth === 2 ? 4 : state.tabWidth === 4 ? 8 : 2;
  localStorage.setItem('limeedit.tabWidth', String(state.tabWidth));
  editor.updateOptions({ tabSize: state.tabWidth });
  for (const doc of state.docs) doc.model.updateOptions({ tabSize: state.tabWidth });
  updateStatusBar();
});

$('status-position').addEventListener('click', () => {
  editor.focus();
  editor.getAction('editor.action.gotoLine')?.run();
});

$('status-language').addEventListener('click', async () => {
  const doc = activeDoc();
  if (!doc) return;
  const languages = monaco.languages.getLanguages().map((l) => ({
    value: l.id,
    label: (l.aliases && l.aliases[0]) || l.id,
  }));
  languages.sort((a, b) => a.label.localeCompare(b.label));
  const result = await showDialog('Language Mode', [
    { type: 'select', name: 'language', label: 'Treat this document as:', options: languages, value: doc.model.getLanguageId() },
  ]);
  if (result) {
    monaco.editor.setModelLanguage(doc.model, result.language);
    updateStatusBar();
    scheduleFunctionScan();
  }
});

// ---------------------------------------------------------------- extension host

// Status-bar items contributed by extensions live in #status-ext-items.
function makeStatusItem({ id, text = '', tooltip = '', onClick, owner }) {
  const el = document.createElement(onClick ? 'button' : 'span');
  el.className = 'status-item status-ext-item' + (onClick ? '' : ' static');
  el.dataset.owner = owner || '';
  el.textContent = text;
  if (tooltip) el.title = tooltip;
  if (onClick) el.addEventListener('click', onClick);
  if (!text) el.style.display = 'none';
  $('status-ext-items').appendChild(el);
  return {
    update(newText, newTooltip) {
      el.textContent = newText || '';
      el.style.display = newText ? '' : 'none';
      if (newTooltip !== undefined) el.title = newTooltip;
    },
    dispose() {
      el.remove();
    },
  };
}

// Commands contributed by extensions: registered as Monaco actions (so they
// appear in the F1 palette) and tracked for the Extensions view.
const extensionCommands = [];
function makeCommand({ id, title, run, owner }) {
  const action = editor.addAction({
    id: `limeedit.ext.${id}`,
    label: title,
    run: () => run(),
  });
  const record = { id, title, run, owner };
  extensionCommands.push(record);
  return {
    dispose() {
      action.dispose();
      const i = extensionCommands.indexOf(record);
      if (i >= 0) extensionCommands.splice(i, 1);
    },
  };
}

// A preview panel (used by e.g. the Markdown Preview extension).
function showExtPanel({ title = 'Preview', html = '' }) {
  $('ext-panel-title').textContent = title;
  $('ext-panel-body').innerHTML = html;
  $('ext-panel').classList.remove('hidden');
  return {
    update(newHtml) {
      $('ext-panel-body').innerHTML = newHtml;
    },
    close() {
      $('ext-panel').classList.add('hidden');
    },
  };
}
$('ext-panel-close').addEventListener('click', () => $('ext-panel').classList.add('hidden'));

const extHost = new ExtensionHost({
  monaco,
  // The editor is a persistent singleton (it outlives any single model), so
  // always hand it back; extensions detect "no document" via getModel() === null.
  getEditor: () => editor,
  addStatusItem: makeStatusItem,
  registerCommand: makeCommand,
  showPanel: showExtPanel,
  showMessage: statusMessage,
});

let extContentTimer = null;
function scheduleExtContentEmit(model) {
  clearTimeout(extContentTimer);
  extContentTimer = setTimeout(() => extHost.emitContentChange(model), 250);
}

// ---------------------------------------------------------------- backups
// Automatic, silent snapshots of dirty documents to the server, so unsaved work
// survives a crash, a closed tab, or a reclaimed container. Debounced per edit,
// with a periodic safety sweep and a minimum interval between snapshots.
const BACKUP_DEBOUNCE_MS = 4000;
const BACKUP_MIN_INTERVAL_MS = 15000;
const backupTimers = new Map(); // doc.id -> timeout
const lastBackupAt = new Map(); // doc.id -> ms

function backupKeyFor(doc) {
  return doc.path ? `file:${doc.path}` : `untitled:${doc.name}`;
}

async function backupDoc(doc) {
  if (!doc || !isDirty(doc)) return;
  lastBackupAt.set(doc.id, Date.now());
  try {
    await fetch('/api/backup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        key: backupKeyFor(doc),
        path: doc.path,
        name: doc.name,
        content: doc.model.getValue(),
      }),
    });
  } catch {
    /* backups are best-effort; never interrupt editing */
  }
}

function scheduleBackup(doc) {
  clearTimeout(backupTimers.get(doc.id));
  backupTimers.set(
    doc.id,
    setTimeout(() => {
      const since = Date.now() - (lastBackupAt.get(doc.id) || 0);
      if (since < BACKUP_MIN_INTERVAL_MS) {
        scheduleBackup(doc); // too soon — try again after the debounce window
        return;
      }
      backupDoc(doc);
    }, BACKUP_DEBOUNCE_MS)
  );
}

// Safety net: snapshot every dirty document once a minute regardless of typing.
setInterval(() => {
  for (const doc of state.docs) {
    if (isDirty(doc) && Date.now() - (lastBackupAt.get(doc.id) || 0) >= 60000) backupDoc(doc);
  }
}, 60000);

async function showBackups() {
  const list = $('backups-list');
  list.textContent = 'Loading…';
  $('backups').classList.remove('hidden');
  let data;
  try {
    data = await (await fetch('/api/backups')).json();
  } catch {
    list.textContent = 'Could not load backups.';
    return;
  }
  list.textContent = '';
  if (!data.backups.length) {
    const empty = document.createElement('div');
    empty.className = 'ext-desc';
    empty.style.padding = '16px';
    empty.textContent = 'No backups yet. Edited documents are snapshotted here automatically.';
    list.appendChild(empty);
    return;
  }
  for (const b of data.backups) {
    const card = document.createElement('div');
    card.className = 'ext-card';
    const main = document.createElement('div');
    main.className = 'ext-main';
    const title = document.createElement('div');
    title.className = 'ext-title';
    title.textContent = b.name || '(untitled)';
    const desc = document.createElement('div');
    desc.className = 'ext-desc';
    desc.textContent = b.path || 'unsaved document';
    const meta = document.createElement('div');
    meta.className = 'ext-meta';
    meta.textContent = `${new Date(b.time).toLocaleString()} · ${b.size.toLocaleString()} chars`;
    main.append(title, desc, meta);
    const restore = document.createElement('button');
    restore.className = 'btn';
    restore.textContent = 'Restore';
    restore.addEventListener('click', () => restoreBackup(b));
    card.append(main, restore);
    list.appendChild(card);
  }
}

async function restoreBackup(b) {
  try {
    const meta = await (await fetch(`/api/backup?file=${encodeURIComponent(b.file)}`)).json();
    // Restore into a NEW document so nothing open is clobbered.
    const stamp = new Date(meta.time).toLocaleString();
    const doc = createDoc({ path: null, name: `${meta.name} (backup ${stamp})`, content: meta.content });
    if (meta.path) monaco.editor.setModelLanguage(doc.model, languageForPath(meta.path));
    $('backups').classList.add('hidden');
    activateDoc(doc);
    statusMessage(`Restored backup of ${meta.name} into a new document`);
  } catch {
    statusMessage('Could not restore that backup');
  }
}

$('backups-close').addEventListener('click', () => $('backups').classList.add('hidden'));
$('backups').addEventListener('mousedown', (e) => {
  if (e.target === $('backups')) $('backups').classList.add('hidden');
});

function allExtensions() {
  return [...BUILTIN_EXTENSIONS, ...state.rawExtensions];
}

function isExtensionEnabled(id) {
  return !!state.enabledExtensions[id];
}

function setExtensionEnabled(ext, enabled) {
  const wasEnabled = extHost.isActive(ext.id);
  if (enabled && !wasEnabled) extHost.activate(ext);
  else if (!enabled && wasEnabled) extHost.deactivate(ext);
  state.enabledExtensions[ext.id] = enabled;
  persistEnabledExtensions();
}

function persistEnabledExtensions() {
  // Persist only built-ins; raw extensions are session-scoped by design.
  const persistable = {};
  for (const ext of BUILTIN_EXTENSIONS) {
    if (state.enabledExtensions[ext.id]) persistable[ext.id] = true;
  }
  localStorage.setItem('limeedit.extensions', JSON.stringify(persistable));
}

function activateEnabledExtensions() {
  for (const ext of allExtensions()) {
    if (isExtensionEnabled(ext.id) && !extHost.isActive(ext.id)) extHost.activate(ext);
  }
}

// ---- Extensions manager overlay ----

function showExtensions() {
  renderExtensionList();
  $('extensions').classList.remove('hidden');
}
function hideExtensions() {
  $('extensions').classList.add('hidden');
  editor.focus();
}

function renderExtensionList() {
  const list = $('ext-list');
  list.textContent = '';
  for (const ext of allExtensions()) {
    const enabled = isExtensionEnabled(ext.id);
    const card = document.createElement('div');
    card.className = 'ext-card';

    const main = document.createElement('div');
    main.className = 'ext-main';
    const title = document.createElement('div');
    title.className = 'ext-title';
    title.textContent = ext.name;
    if (ext.raw) {
      const badge = document.createElement('span');
      badge.className = 'ext-badge';
      badge.textContent = 'raw';
      title.appendChild(badge);
    }
    const desc = document.createElement('div');
    desc.className = 'ext-desc';
    desc.textContent = ext.description || '';
    const meta = document.createElement('div');
    meta.className = 'ext-meta';
    meta.textContent = `v${ext.version} · ${ext.author}`;
    // list any commands this extension contributes
    const cmds = extensionCommands.filter((c) => c.owner === ext.id);
    if (cmds.length) meta.textContent += ` · commands: ${cmds.map((c) => c.title).join(', ')}`;
    main.append(title, desc, meta);

    const toggle = document.createElement('button');
    toggle.className = 'ext-toggle btn' + (enabled ? ' primary' : '');
    toggle.textContent = enabled ? 'Enabled' : 'Disabled';
    toggle.addEventListener('click', () => {
      setExtensionEnabled(ext, !enabled);
      renderExtensionList();
    });

    card.append(main, toggle);
    list.appendChild(card);
  }
}

$('ext-close').addEventListener('click', hideExtensions);
$('extensions').addEventListener('mousedown', (e) => {
  if (e.target === $('extensions')) hideExtensions();
});
$('ext-install').addEventListener('click', installRawExtension);

async function installRawExtension() {
  const result = await showDialog('Install Extension from Source', [
    {
      type: 'note',
      text: 'Paste an extension object with an activate(api) function. It runs in this page — only install code you trust (usually your own).',
    },
    {
      type: 'textarea',
      name: 'source',
      label: 'Extension source',
      value:
        '{\n  id: "my.hello",\n  name: "Hello",\n  activate(api) {\n    const item = api.addStatusItem({ id: "hello", text: "👋 hello" });\n    api.onActiveDocument(() => item.update("👋 " + (api.getModel() ? "editing" : "idle")));\n  }\n}',
    },
  ]);
  if (!result) return;
  const { ext, error } = compileRawExtension(result.source);
  if (error) {
    statusMessage(`Extension error: ${error}`);
    return;
  }
  state.rawExtensions.push(ext);
  setExtensionEnabled(ext, true);
  renderExtensionList();
  statusMessage(`Installed “${ext.name}”`);
}

// ---------------------------------------------------------------- raw mode

function setRawMode(on) {
  state.rawMode = on;
  applyRawMode();
  rebuildMenus();
}

// Raw mode: show the document as plain, unhighlighted text with all
// invisibles visible and wrapping off — the raw bytes, essentially.
function applyRawMode() {
  const doc = activeDoc();
  $('status-raw').classList.toggle('hidden', !state.rawMode);
  if (!doc) return;
  if (state.rawMode) {
    if (doc._realLanguage === undefined) doc._realLanguage = doc.model.getLanguageId();
    monaco.editor.setModelLanguage(doc.model, 'plaintext');
    editor.updateOptions({ renderWhitespace: 'all', renderControlCharacters: true, wordWrap: 'off' });
  } else {
    if (doc._realLanguage !== undefined) {
      monaco.editor.setModelLanguage(doc.model, doc._realLanguage);
      doc._realLanguage = undefined;
    }
    editor.updateOptions({
      renderWhitespace: state.showInvisibles ? 'all' : 'none',
      renderControlCharacters: state.showInvisibles,
      wordWrap: state.softWrap ? 'on' : 'off',
    });
  }
  updateStatusBar();
  scheduleFunctionScan();
}

$('status-raw').addEventListener('click', () => setRawMode(false));

// ---------------------------------------------------------------- account

function renderAvatar() {
  const avatar = $('account-avatar');
  if (state.account) {
    avatar.textContent = state.account.name.trim().charAt(0).toUpperCase() || '?';
    avatar.style.background = state.account.color || '#888';
    avatar.style.color = '#fff';
    $('account-btn').title = `Signed in as ${state.account.name}`;
  } else {
    avatar.textContent = '?';
    avatar.style.background = '';
    avatar.style.color = '';
    $('account-btn').title = 'Sign in';
  }
}

async function loadAccount() {
  try {
    const res = await fetch('/api/account');
    const data = await res.json();
    state.account = data.account || null;
    if (state.account && state.account.settings) applySyncedSettings(state.account.settings);
  } catch {
    state.account = null;
  }
  renderAvatar();
}

function currentSettings() {
  return {
    theme: state.theme,
    animations: state.animations,
    softWrap: state.softWrap,
    tabWidth: state.tabWidth,
    extensions: JSON.parse(localStorage.getItem('limeedit.extensions') || '{}'),
  };
}

// Apply an account's synced settings, but only for preferences this browser
// hasn't set locally. Settings Sync seeds a fresh environment; it never
// clobbers newer local changes (same as VS Code — local edits win and are
// pushed back up via "Sync Settings Now").
function applySyncedSettings(s) {
  if (!s || typeof s !== 'object') return;
  const unset = (key) => localStorage.getItem(key) === null;

  if (s.theme && unset('limeedit.theme')) applyTheme(s.theme);
  if (typeof s.animations === 'boolean' && unset('limeedit.animations')) setAnimations(s.animations);
  if (typeof s.softWrap === 'boolean' && unset('limeedit.softWrap')) setSoftWrap(s.softWrap);
  if (s.tabWidth && unset('limeedit.tabWidth')) {
    state.tabWidth = s.tabWidth;
    localStorage.setItem('limeedit.tabWidth', String(s.tabWidth));
    editor.updateOptions({ tabSize: s.tabWidth });
  }
  if (s.extensions && typeof s.extensions === 'object' && unset('limeedit.extensions')) {
    localStorage.setItem('limeedit.extensions', JSON.stringify(s.extensions));
    state.enabledExtensions = { ...state.enabledExtensions, ...s.extensions };
    activateEnabledExtensions();
  }
  updateStatusBar();
}

function showAccount() {
  const body = $('account-body');
  body.textContent = '';

  if (state.account) {
    const head = document.createElement('div');
    head.className = 'account-head';
    const av = document.createElement('span');
    av.className = 'account-avatar big';
    av.textContent = state.account.name.charAt(0).toUpperCase();
    av.style.background = state.account.color || '#888';
    av.style.color = '#fff';
    const info = document.createElement('div');
    const nm = document.createElement('div');
    nm.className = 'account-name';
    nm.textContent = state.account.name;
    const em = document.createElement('div');
    em.className = 'account-email dim';
    em.textContent = state.account.email || 'no email';
    info.append(nm, em);
    head.append(av, info);
    body.appendChild(head);

    const note = document.createElement('p');
    note.className = 'dim account-note';
    note.textContent =
      'Signed in locally. Settings Sync stores your theme, animations, tab width, and enabled extensions with this profile.';
    body.appendChild(note);

    const row = document.createElement('div');
    row.className = 'dialog-buttons';
    const syncBtn = mkBtn('Sync Settings Now', 'primary', async () => {
      await fetch('/api/account/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(currentSettings()),
      });
      statusMessage('Settings synced to your account');
      $('account').classList.add('hidden');
    });
    const outBtn = mkBtn('Sign Out', '', async () => {
      await fetch('/api/account', { method: 'DELETE' });
      state.account = null;
      renderAvatar();
      $('account').classList.add('hidden');
      statusMessage('Signed out');
    });
    const closeBtn = mkBtn('Close', 'subtle', () => $('account').classList.add('hidden'));
    row.append(syncBtn, outBtn, closeBtn);
    body.appendChild(row);
  } else {
    const h = document.createElement('h3');
    h.textContent = 'Sign in to LimeEdit';
    body.appendChild(h);
    const p = document.createElement('p');
    p.className = 'dim account-note';
    p.textContent =
      'A local profile for this editor — no password, no cloud. It gives you an avatar and enables Settings Sync across your sessions on this machine.';
    body.appendChild(p);

    const nameField = mkField('Display name', 'text', 'account-name-input');
    const emailField = mkField('Email (optional)', 'text', 'account-email-input');
    body.append(nameField.wrap, emailField.wrap);

    const row = document.createElement('div');
    row.className = 'dialog-buttons';
    const inBtn = mkBtn('Sign In', 'primary', async () => {
      const name = nameField.input.value.trim();
      if (!name) {
        statusMessage('A display name is required');
        return;
      }
      const res = await fetch('/api/account', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email: emailField.input.value.trim(), settings: currentSettings() }),
      });
      const data = await res.json();
      if (!res.ok) {
        statusMessage(data.error || 'Sign in failed');
        return;
      }
      state.account = data.account;
      renderAvatar();
      $('account').classList.add('hidden');
      statusMessage(`Signed in as ${data.account.name}`);
    });
    const cancelBtn = mkBtn('Cancel', 'subtle', () => $('account').classList.add('hidden'));
    row.append(inBtn, cancelBtn);
    body.appendChild(row);
    setTimeout(() => nameField.input.focus(), 0);
  }

  $('account').classList.remove('hidden');
}

function mkBtn(label, variant, onClick) {
  const b = document.createElement('button');
  b.className = 'btn' + (variant ? ' ' + variant : '');
  b.textContent = label;
  b.addEventListener('click', onClick);
  return b;
}

function mkField(label, type, id) {
  const wrap = document.createElement('div');
  wrap.className = 'dialog-field';
  const lab = document.createElement('label');
  lab.textContent = label;
  lab.htmlFor = id;
  const input = document.createElement('input');
  input.type = type;
  input.id = id;
  wrap.append(lab, input);
  return { wrap, input };
}

$('account-btn').addEventListener('click', showAccount);
$('account').addEventListener('mousedown', (e) => {
  if (e.target === $('account')) $('account').classList.add('hidden');
});

// ---------------------------------------------------------------- soft wrap toggle

function setSoftWrap(on) {
  state.softWrap = on;
  localStorage.setItem('limeedit.softWrap', String(on));
  editor.updateOptions({ wordWrap: on ? 'on' : 'off' });
  updateNavbar();
  rebuildMenus();
}

$('wrap-toggle').addEventListener('click', () => setSoftWrap(!state.softWrap));

// ---------------------------------------------------------------- dialogs

function showDialog(title, fields) {
  return new Promise((resolve) => {
    const overlay = $('dialog');
    const body = $('dialog-body');
    $('dialog-title').textContent = title;
    body.textContent = '';
    const inputs = {};

    for (const field of fields) {
      const wrap = document.createElement('div');
      wrap.className = 'dialog-field';
      if (field.type === 'text' || field.type === 'number') {
        const label = document.createElement('label');
        label.textContent = field.label;
        const input = document.createElement('input');
        input.type = field.type;
        input.value = field.value ?? '';
        wrap.append(label, input);
        inputs[field.name] = () => (field.type === 'number' ? Number(input.value) : input.value);
      } else if (field.type === 'checkbox') {
        wrap.classList.add('checkbox');
        const input = document.createElement('input');
        input.type = 'checkbox';
        input.checked = !!field.value;
        input.id = `dlg-${field.name}`;
        const label = document.createElement('label');
        label.htmlFor = input.id;
        label.textContent = field.label;
        wrap.append(input, label);
        inputs[field.name] = () => input.checked;
      } else if (field.type === 'radio') {
        const row = document.createElement('div');
        row.className = 'radio-row';
        for (const opt of field.options) {
          const optLabel = document.createElement('label');
          const input = document.createElement('input');
          input.type = 'radio';
          input.name = `dlg-radio-${field.name}`;
          input.value = opt.value;
          input.checked = !!opt.checked;
          optLabel.append(input, document.createTextNode(' ' + opt.label));
          row.appendChild(optLabel);
        }
        wrap.appendChild(row);
        inputs[field.name] = () => {
          const checked = row.querySelector('input:checked');
          return checked ? checked.value : null;
        };
      } else if (field.type === 'select') {
        const label = document.createElement('label');
        label.textContent = field.label;
        const select = document.createElement('select');
        select.style.width = '100%';
        for (const opt of field.options) {
          const o = document.createElement('option');
          o.value = opt.value;
          o.textContent = opt.label;
          if (opt.value === field.value) o.selected = true;
          select.appendChild(o);
        }
        wrap.append(label, select);
        inputs[field.name] = () => select.value;
      } else if (field.type === 'textarea') {
        const label = document.createElement('label');
        label.textContent = field.label;
        const area = document.createElement('textarea');
        area.className = 'dialog-textarea';
        area.spellcheck = false;
        area.rows = field.rows || 10;
        area.value = field.value ?? '';
        wrap.append(label, area);
        inputs[field.name] = () => area.value;
      } else if (field.type === 'note') {
        wrap.className = 'dialog-note';
        wrap.textContent = field.text;
      }
      body.appendChild(wrap);
    }

    overlay.classList.remove('hidden');
    const firstInput = body.querySelector('input[type=text], input[type=number], textarea, select');
    if (firstInput) {
      firstInput.focus();
      if (firstInput.select && firstInput.tagName !== 'TEXTAREA') firstInput.select();
    }

    function finish(result) {
      overlay.classList.add('hidden');
      $('dialog-ok').removeEventListener('click', onOk);
      $('dialog-cancel').removeEventListener('click', onCancel);
      overlay.removeEventListener('keydown', onKey);
      resolve(result);
    }
    function collect() {
      const out = {};
      for (const [name, get] of Object.entries(inputs)) out[name] = get();
      return out;
    }
    const onOk = () => finish(collect());
    const onCancel = () => finish(null);
    function onKey(e) {
      if (e.key === 'Enter' && e.target.tagName !== 'SELECT' && e.target.tagName !== 'TEXTAREA') onOk();
      if (e.key === 'Escape') onCancel();
    }
    $('dialog-ok').addEventListener('click', onOk);
    $('dialog-cancel').addEventListener('click', onCancel);
    overlay.addEventListener('keydown', onKey);
  });
}

// ---------------------------------------------------------------- multi-file search

function toggleSearchDrawer(show) {
  const drawer = $('search-drawer');
  const shouldShow = show ?? drawer.classList.contains('hidden');
  drawer.classList.toggle('hidden', !shouldShow);
  if (shouldShow) {
    const sel = editor.getModel() ? editor.getModel().getValueInRange(editor.getSelection()) : '';
    if (sel && !sel.includes('\n')) $('search-input').value = sel;
    $('search-input').focus();
    $('search-input').select();
  } else {
    editor.focus();
  }
}

async function runMultiFileSearch() {
  const query = $('search-input').value;
  if (!query) return;
  $('search-status').textContent = 'Searching…';
  $('search-results').textContent = '';
  const res = await fetch('/api/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      query,
      isRegex: $('search-regex').checked,
      caseSensitive: $('search-case').checked,
      wholeWord: $('search-word').checked,
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    $('search-status').textContent = `Search failed: ${err.error || res.statusText}`;
    return;
  }
  const data = await res.json();
  const byFile = new Map();
  for (const m of data.matches) {
    if (!byFile.has(m.file)) byFile.set(m.file, []);
    byFile.get(m.file).push(m);
  }
  $('search-status').textContent =
    `${data.matches.length}${data.limited ? '+' : ''} matches in ${byFile.size} of ${data.filesSearched} files`;

  const results = $('search-results');
  for (const [file, hits] of byFile) {
    const fileRow = document.createElement('div');
    fileRow.className = 'search-file';
    fileRow.textContent = `${file} — ${hits.length}`;
    results.appendChild(fileRow);
    for (const hit of hits) {
      const row = document.createElement('div');
      row.className = 'search-hit';
      const lineNo = document.createElement('span');
      lineNo.className = 'hit-line';
      lineNo.textContent = String(hit.line);
      const text = document.createElement('span');
      const before = hit.text.slice(0, hit.column - 1);
      const match = hit.text.slice(hit.column - 1, hit.column - 1 + hit.length);
      const after = hit.text.slice(hit.column - 1 + hit.length);
      const mark = document.createElement('mark');
      mark.textContent = match;
      text.append(document.createTextNode(before), mark, document.createTextNode(after));
      row.append(lineNo, text);
      row.addEventListener('click', () => openFile(hit.file, { line: hit.line, column: hit.column }));
      results.appendChild(row);
    }
  }
}

$('search-go').addEventListener('click', runMultiFileSearch);
$('search-close').addEventListener('click', () => toggleSearchDrawer(false));
$('search-input').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') runMultiFileSearch();
  if (e.key === 'Escape') toggleSearchDrawer(false);
});

// ---------------------------------------------------------------- open quickly

let quickOpenSelection = 0;
let quickOpenFiles = [];
let quickOpenTimer = null;

function showQuickOpen() {
  $('quickopen').classList.remove('hidden');
  $('quickopen-input').value = '';
  $('quickopen-input').focus();
  queryQuickOpen('');
}

function hideQuickOpen() {
  $('quickopen').classList.add('hidden');
  editor.focus();
}

function queryQuickOpen(q) {
  clearTimeout(quickOpenTimer);
  quickOpenTimer = setTimeout(async () => {
    const res = await fetch(`/api/files?q=${encodeURIComponent(q)}`);
    if (!res.ok) return;
    const data = await res.json();
    quickOpenFiles = data.files;
    quickOpenSelection = 0;
    renderQuickOpen();
  }, 80);
}

function renderQuickOpen() {
  const ul = $('quickopen-results');
  ul.textContent = '';
  quickOpenFiles.slice(0, 50).forEach((file, i) => {
    const li = document.createElement('li');
    li.classList.toggle('selected', i === quickOpenSelection);
    const base = document.createElement('span');
    base.textContent = file.split('/').pop();
    const dir = document.createElement('span');
    dir.className = 'qo-dir';
    dir.textContent = file.includes('/') ? file.slice(0, file.lastIndexOf('/')) : '';
    li.append(base, dir);
    li.addEventListener('click', () => {
      hideQuickOpen();
      openFile(file);
    });
    ul.appendChild(li);
  });
}

$('quickopen-input').addEventListener('input', (e) => queryQuickOpen(e.target.value));
$('quickopen-input').addEventListener('keydown', (e) => {
  if (e.key === 'Escape') hideQuickOpen();
  else if (e.key === 'ArrowDown') {
    quickOpenSelection = Math.min(quickOpenSelection + 1, Math.min(quickOpenFiles.length, 50) - 1);
    renderQuickOpen();
    e.preventDefault();
  } else if (e.key === 'ArrowUp') {
    quickOpenSelection = Math.max(quickOpenSelection - 1, 0);
    renderQuickOpen();
    e.preventDefault();
  } else if (e.key === 'Enter') {
    const file = quickOpenFiles[quickOpenSelection];
    if (file) {
      hideQuickOpen();
      openFile(file);
    }
  }
});
$('quickopen').addEventListener('mousedown', (e) => {
  if (e.target === $('quickopen')) hideQuickOpen();
});

// ---------------------------------------------------------------- menus

const isMac = /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);
const MOD = isMac ? '⌘' : 'Ctrl+';

function accel(str) {
  return str.replaceAll('Mod+', MOD).replaceAll('Shift+', isMac ? '⇧' : 'Shift+').replaceAll('Alt+', isMac ? '⌥' : 'Alt+');
}

function editorAction(id) {
  return () => {
    editor.focus();
    editor.getAction(id)?.run();
  };
}

function withEditor(fn) {
  return () => {
    if (!activeDoc()) return;
    fn(editor, monaco);
    editor.focus();
  };
}

function menuDefinitions() {
  return [
    {
      title: 'File',
      items: [
        { label: 'New Text Document', accel: 'Mod+N', action: newDocument },
        { label: 'Open Quickly…', accel: 'Mod+P', action: showQuickOpen },
        { sep: true },
        { label: 'Save', accel: 'Mod+S', action: () => saveDoc(activeDoc()) },
        { label: 'Save As…', accel: 'Shift+Mod+S', action: () => saveDoc(activeDoc(), { saveAs: true }) },
        { sep: true },
        { label: 'Browse Backups…', action: showBackups },
        { sep: true },
        { label: 'Close Document', accel: 'Mod+W', action: () => closeDoc(activeDoc()) },
      ],
    },
    {
      title: 'Edit',
      items: [
        { label: 'Undo', accel: 'Mod+Z', action: () => { editor.focus(); editor.trigger('menu', 'undo', null); } },
        { label: 'Redo', accel: 'Shift+Mod+Z', action: () => { editor.focus(); editor.trigger('menu', 'redo', null); } },
        { sep: true },
        { label: 'Select All', accel: 'Mod+A', action: editorAction('editor.action.selectAll') },
        { label: 'Select Line', accel: 'Mod+L', action: editorAction('expandLineSelection') },
        { label: 'Add Next Occurrence', accel: 'Mod+D', action: editorAction('editor.action.addSelectionToNextFindMatch') },
        { sep: true },
        { label: 'Command Palette…', accel: 'F1', action: editorAction('editor.action.quickCommand') },
      ],
    },
    {
      title: 'Text',
      items: [
        { label: 'Change Case: UPPERCASE', action: withEditor(texttools.upperCase) },
        { label: 'Change Case: lowercase', action: withEditor(texttools.lowerCase) },
        { label: 'Change Case: Title Case', action: withEditor(texttools.titleCase) },
        { label: 'Change Case: Sentence case', action: withEditor(texttools.sentenceCase) },
        { label: 'Change Case: tOGGLE', action: withEditor(texttools.toggleCase) },
        { sep: true },
        { label: 'Sort Lines…', action: sortLinesDialog },
        { label: 'Reverse Lines', action: withEditor(texttools.reverseLines) },
        { label: 'Process Duplicate Lines', action: withEditor((e, m) => texttools.processDuplicateLines(e, m)) },
        { label: 'Delete Blank Lines', action: withEditor(texttools.deleteBlankLines) },
        { label: 'Prefix/Suffix Lines…', action: prefixSuffixDialog },
        { label: 'Add Line Numbers', action: withEditor(texttools.addLineNumbers) },
        { label: 'Remove Line Numbers', action: withEditor(texttools.removeLineNumbers) },
        { sep: true },
        { label: 'Entab (spaces → tabs)', action: withEditor((e, m) => texttools.entab(e, m, state.tabWidth)) },
        { label: 'Detab (tabs → spaces)', action: withEditor((e, m) => texttools.detab(e, m, state.tabWidth)) },
        { label: 'Strip Trailing Whitespace', action: withEditor(texttools.stripTrailingWhitespace) },
        { label: 'Zap Gremlins', action: withEditor((e, m) => texttools.zapGremlins(e, m)) },
        { sep: true },
        { label: 'Educate Quotes (“smart”)', action: withEditor(texttools.educateQuotes) },
        { label: 'Straighten Quotes', action: withEditor(texttools.straightenQuotes) },
        { label: 'Hard Wrap…', action: hardWrapDialog },
        { sep: true },
        { label: 'Toggle Line Comment', accel: 'Mod+/', action: editorAction('editor.action.commentLine') },
        { label: 'Shift Right', accel: 'Mod+]', action: editorAction('editor.action.indentLines') },
        { label: 'Shift Left', accel: 'Mod+[', action: editorAction('editor.action.outdentLines') },
      ],
    },
    {
      title: 'Search',
      items: [
        { label: 'Find…', accel: 'Mod+F', action: editorAction('actions.find') },
        { label: 'Find & Replace…', accel: 'Alt+Mod+F', action: editorAction('editor.action.startFindReplaceAction') },
        { label: 'Find Next', accel: 'Mod+G', action: editorAction('editor.action.nextMatchFindAction') },
        { sep: true },
        { label: 'Multi-File Search…', accel: 'Shift+Mod+F', action: () => toggleSearchDrawer(true) },
      ],
    },
    {
      title: 'Go',
      items: [
        { label: 'Go to Line…', accel: 'Ctrl+G', action: editorAction('editor.action.gotoLine') },
        { label: 'Go to Matching Bracket', accel: 'Shift+Mod+\\', action: editorAction('editor.action.jumpToBracket') },
        { sep: true },
        { label: 'Next Document', accel: 'Alt+Mod+→', action: () => cycleDoc(1) },
        { label: 'Previous Document', accel: 'Alt+Mod+←', action: () => cycleDoc(-1) },
      ],
    },
    {
      title: 'View',
      items: [
        { label: 'Soft Wrap Text', checked: state.softWrap, action: () => setSoftWrap(!state.softWrap) },
        { label: 'Show Invisibles', checked: state.showInvisibles, action: toggleInvisibles },
        { label: 'Show Minimap', checked: !!editor.getOption(monaco.editor.EditorOption.minimap).enabled, action: toggleMinimap },
        { label: 'Raw Mode (plain text, show all)', checked: state.rawMode, action: () => setRawMode(!state.rawMode) },
        { sep: true },
        { label: 'Toggle Sidebar', accel: 'Mod+0', action: toggleSidebar },
        { sep: true },
        { label: 'Smooth Animations', checked: state.animations, action: () => setAnimations(!state.animations) },
        { label: 'Color Theme…', accel: 'Mod+K Mod+T', action: pickColorTheme },
        { label: 'Dark Mode', checked: themeFor(state.theme).base === 'dark', action: toggleTheme },
      ],
    },
    {
      title: 'Extensions',
      items: [
        { label: 'Manage Extensions…', accel: 'Shift+Mod+X', action: showExtensions },
        { label: 'Install from Source…', action: installRawExtension },
        { sep: true },
        { label: 'Command Palette (incl. extension commands)…', accel: 'Shift+Mod+P', action: editorAction('editor.action.quickCommand') },
      ],
    },
    {
      title: 'Account',
      items: [{ label: state.account ? `Signed in: ${state.account.name}` : 'Sign In…', action: showAccount }],
    },
  ];
}

let menubarOpen = false;

function rebuildMenus() {
  const nav = $('menus');
  nav.textContent = '';
  for (const menu of menuDefinitions()) {
    const title = document.createElement('div');
    title.className = 'menu-title';
    title.textContent = menu.title;

    const dropdown = document.createElement('div');
    dropdown.className = 'menu-dropdown hidden';
    for (const item of menu.items) {
      if (item.sep) {
        const sep = document.createElement('div');
        sep.className = 'menu-sep';
        dropdown.appendChild(sep);
        continue;
      }
      const el = document.createElement('div');
      el.className = 'menu-item';
      el.style.position = 'relative';
      if (item.checked) el.classList.add('checked');
      const label = document.createElement('span');
      label.className = 'menu-label';
      label.textContent = item.label;
      el.appendChild(label);
      if (item.accel) {
        const a = document.createElement('span');
        a.className = 'menu-accel';
        a.textContent = accel(item.accel);
        el.appendChild(a);
      }
      el.addEventListener('click', () => {
        closeAllMenus();
        item.action();
      });
      dropdown.appendChild(el);
    }
    title.appendChild(dropdown);

    title.addEventListener('mousedown', (e) => {
      if (e.target.closest('.menu-dropdown')) return; // let item clicks through
      e.preventDefault();
      e.stopPropagation();
      const wasOpen = !dropdown.classList.contains('hidden');
      closeAllMenus();
      if (!wasOpen) {
        dropdown.classList.remove('hidden');
        title.classList.add('open');
        menubarOpen = true;
      }
    });
    title.addEventListener('mouseenter', () => {
      if (menubarOpen) {
        closeAllMenus(true);
        dropdown.classList.remove('hidden');
        title.classList.add('open');
        menubarOpen = true;
      }
    });

    nav.appendChild(title);
  }
}

function closeAllMenus(keepOpenFlag = false) {
  document.querySelectorAll('.menu-dropdown').forEach((d) => d.classList.add('hidden'));
  document.querySelectorAll('.menu-title.open').forEach((t) => t.classList.remove('open'));
  if (!keepOpenFlag) menubarOpen = false;
}

document.addEventListener('mousedown', (e) => {
  if (!e.target.closest('#menus')) closeAllMenus();
});

// menu helper dialogs ----------------------------------------------

async function sortLinesDialog() {
  if (!activeDoc()) return;
  const result = await showDialog('Sort Lines', [
    { type: 'checkbox', name: 'descending', label: 'Descending order' },
    { type: 'checkbox', name: 'caseSensitive', label: 'Case sensitive' },
    { type: 'checkbox', name: 'unique', label: 'Delete duplicate lines' },
  ]);
  if (result) texttools.sortLines(editor, monaco, result);
}

async function prefixSuffixDialog() {
  if (!activeDoc()) return;
  const result = await showDialog('Prefix/Suffix Lines', [
    { type: 'text', name: 'prefix', label: 'Prefix', value: '' },
    { type: 'text', name: 'suffix', label: 'Suffix', value: '' },
    { type: 'checkbox', name: 'remove', label: 'Remove instead of insert' },
  ]);
  if (result) texttools.prefixSuffixLines(editor, monaco, result);
}

async function hardWrapDialog() {
  if (!activeDoc()) return;
  const result = await showDialog('Hard Wrap', [
    { type: 'number', name: 'width', label: 'Wrap to column', value: 80 },
  ]);
  if (result && result.width > 0) texttools.hardWrap(editor, monaco, result.width);
}

function toggleInvisibles() {
  state.showInvisibles = !state.showInvisibles;
  editor.updateOptions({
    renderWhitespace: state.showInvisibles ? 'all' : 'none',
    renderControlCharacters: state.showInvisibles,
  });
  rebuildMenus();
}

function toggleMinimap() {
  const enabled = !!editor.getOption(monaco.editor.EditorOption.minimap).enabled;
  editor.updateOptions({ minimap: { enabled: !enabled } });
  rebuildMenus();
}

function toggleSidebar() {
  const sidebar = $('sidebar');
  sidebar.style.display = sidebar.style.display === 'none' ? '' : 'none';
}

// Switch to a specific theme by id (from the registry).
function applyTheme(id, { silent = false } = {}) {
  const t = themeFor(id);
  state.theme = t.id;
  localStorage.setItem('limeedit.theme', t.id);
  applyThemeAttributes(t);
  monaco.editor.setTheme(t.monaco);
  if (!silent) rebuildMenus();
}

// Dark Mode toggle: flip to the current theme's light/dark sibling.
function toggleTheme() {
  applyTheme(themeFor(state.theme).sibling);
}

async function pickColorTheme() {
  const options = Object.values(THEMES).map((t) => ({ value: t.id, label: t.label }));
  const result = await showDialog('Color Theme', [
    { type: 'select', name: 'theme', label: 'Choose a color theme:', options, value: state.theme },
  ]);
  if (result) applyTheme(result.theme);
}

function setAnimations(on) {
  state.animations = on;
  localStorage.setItem('limeedit.animations', String(on));
  document.documentElement.classList.toggle('no-motion', !on);
  editor.updateOptions({
    smoothScrolling: on,
    cursorSmoothCaretAnimation: on ? 'on' : 'off',
    cursorBlinking: on ? 'smooth' : 'blink',
  });
  rebuildMenus();
}

function cycleDoc(delta) {
  if (state.docs.length < 2) return;
  const idx = state.docs.findIndex((d) => d.id === state.activeId);
  const next = state.docs[(idx + delta + state.docs.length) % state.docs.length];
  activateDoc(next);
}

// ---------------------------------------------------------------- global shortcuts

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    closeAllMenus();
    closeFunctionMenu();
    for (const id of ['extensions', 'account', 'backups']) {
      if (!$(id).classList.contains('hidden')) $(id).classList.add('hidden');
    }
    if (!$('ext-panel').classList.contains('hidden')) $('ext-panel').classList.add('hidden');
  }
  const mod = isMac ? e.metaKey : e.ctrlKey;
  if (!mod) return;
  const key = e.key.toLowerCase();
  if (key === 'n' && !e.shiftKey && !e.altKey) { e.preventDefault(); newDocument(); }
  else if (key === 'p' && e.shiftKey && !e.altKey) { e.preventDefault(); editor.focus(); editor.getAction('editor.action.quickCommand')?.run(); } // Zed/VS Code palette
  else if (key === 'p' && !e.shiftKey && !e.altKey) { e.preventDefault(); showQuickOpen(); }
  else if (key === 's' && !e.altKey) { e.preventDefault(); saveDoc(activeDoc(), { saveAs: e.shiftKey }); }
  else if (key === 'w' && !e.shiftKey && !e.altKey) { e.preventDefault(); closeDoc(activeDoc()); }
  else if (key === 'f' && e.shiftKey && !e.altKey) { e.preventDefault(); toggleSearchDrawer(true); }
  else if (key === 'x' && e.shiftKey && !e.altKey) { e.preventDefault(); showExtensions(); }
  else if (key === '0' && !e.shiftKey && !e.altKey) { e.preventDefault(); toggleSidebar(); }
});

// Color Theme picker as a Monaco action, so the VS Code chord (⌘K ⌘T) works
// reliably even with the editor focused, and it appears in the F1 palette.
editor.addAction({
  id: 'limeedit.colorTheme',
  label: 'Preferences: Color Theme',
  keybindings: [
    monaco.KeyMod.chord(
      monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyK,
      monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyT
    ),
  ],
  run: () => pickColorTheme(),
});

window.addEventListener('beforeunload', (e) => {
  if (state.docs.some(isDirty)) {
    e.preventDefault();
    e.returnValue = '';
  }
});

// ---------------------------------------------------------------- sidebar resizer

(() => {
  const resizer = $('sidebar-resizer');
  const sidebar = $('sidebar');
  let dragging = false;
  resizer.addEventListener('mousedown', (e) => {
    dragging = true;
    e.preventDefault();
  });
  document.addEventListener('mousemove', (e) => {
    if (!dragging) return;
    sidebar.style.width = `${Math.max(140, Math.min(480, e.clientX))}px`;
  });
  document.addEventListener('mouseup', () => {
    dragging = false;
  });
})();

// ---------------------------------------------------------------- boot

async function boot() {
  rebuildMenus();
  renderOpenDocs();
  updateNavbar();
  updateStatusBar();
  renderAvatar();
  activateEnabledExtensions();
  try {
    const res = await fetch('/api/workspace');
    const info = await res.json();
    state.workspaceName = info.name;
    $('workspace-name').textContent = info.name;
  } catch {
    /* server info is cosmetic */
  }
  await loadAccount();
  await refreshTree();
  activateDoc(null);
}

boot();
