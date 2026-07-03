/*
 * app.js — LimeEdit main application.
 *
 * A BBEdit-style shell (sidebar of open documents, Text menu tools,
 * multi-file search, function popup, status bar) wrapped around Monaco,
 * the editor core of microsoft/vscode.
 */

import * as texttools from './texttools.js';
import { scanFunctions } from './functionscanner.js';

const monaco = await window.monacoReady;

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

// ---------------------------------------------------------------- state

const state = {
  docs: [], // { id, path, name, model, savedVersionId, viewState }
  activeId: null,
  untitledCounter: 0,
  theme: localStorage.getItem('limeedit.theme') || 'light',
  softWrap: localStorage.getItem('limeedit.softWrap') === 'true',
  animations: localStorage.getItem('limeedit.animations') !== 'false',
  showInvisibles: false,
  tabWidth: Number(localStorage.getItem('limeedit.tabWidth')) || 4,
  workspaceName: '',
};

const $ = (id) => document.getElementById(id);

document.documentElement.dataset.theme = state.theme;
document.documentElement.classList.toggle('no-motion', !state.animations);

const editor = monaco.editor.create($('editor'), {
  model: null,
  theme: state.theme === 'dark' ? 'lime-dark' : 'lime-light',
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
  for (const lang of monaco.languages.getLanguages()) {
    if (lang.filenames && lang.filenames.some((f) => f.toLowerCase() === name)) return lang.id;
    if (ext && lang.extensions && lang.extensions.some((e) => e.toLowerCase() === ext)) return lang.id;
  }
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
      }
      body.appendChild(wrap);
    }

    overlay.classList.remove('hidden');
    const firstInput = body.querySelector('input[type=text], input[type=number], select');
    if (firstInput) {
      firstInput.focus();
      if (firstInput.select) firstInput.select();
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
      if (e.key === 'Enter' && e.target.tagName !== 'SELECT') onOk();
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
  return str.replace('Mod+', MOD).replace('Shift+', isMac ? '⇧' : 'Shift+').replace('Alt+', isMac ? '⌥' : 'Alt+');
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
        { sep: true },
        { label: 'Toggle Sidebar', accel: 'Mod+0', action: toggleSidebar },
        { sep: true },
        { label: 'Smooth Animations', checked: state.animations, action: () => setAnimations(!state.animations) },
        { label: 'Dark Mode', checked: state.theme === 'dark', action: toggleTheme },
      ],
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

function toggleTheme() {
  state.theme = state.theme === 'dark' ? 'light' : 'dark';
  localStorage.setItem('limeedit.theme', state.theme);
  document.documentElement.dataset.theme = state.theme;
  monaco.editor.setTheme(state.theme === 'dark' ? 'lime-dark' : 'lime-light');
  rebuildMenus();
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
  }
  const mod = isMac ? e.metaKey : e.ctrlKey;
  if (!mod) return;
  const key = e.key.toLowerCase();
  if (key === 'n' && !e.shiftKey && !e.altKey) { e.preventDefault(); newDocument(); }
  else if (key === 'p' && !e.shiftKey && !e.altKey) { e.preventDefault(); showQuickOpen(); }
  else if (key === 's' && !e.altKey) { e.preventDefault(); saveDoc(activeDoc(), { saveAs: e.shiftKey }); }
  else if (key === 'w' && !e.shiftKey && !e.altKey) { e.preventDefault(); closeDoc(activeDoc()); }
  else if (key === 'f' && e.shiftKey && !e.altKey) { e.preventDefault(); toggleSearchDrawer(true); }
  else if (key === '0' && !e.shiftKey && !e.altKey) { e.preventDefault(); toggleSidebar(); }
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
  try {
    const res = await fetch('/api/workspace');
    const info = await res.json();
    state.workspaceName = info.name;
    $('workspace-name').textContent = info.name;
  } catch {
    /* server info is cosmetic */
  }
  await refreshTree();
  activateDoc(null);
}

boot();
