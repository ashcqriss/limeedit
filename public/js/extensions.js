/*
 * extensions.js — a small but real extension system for LimeEdit.
 *
 * This is not the VS Code Marketplace (that's a cloud service outside Monaco).
 * It's a local extension host, modelled on the shape of the VS Code extension
 * API: each extension has an `activate(api, context)` and an optional
 * `deactivate()`. The host tracks everything an extension registers during
 * activation and tears it all down on deactivation, so enabling/disabling is
 * clean and reversible.
 *
 * `api` gives an extension:
 *   monaco                         the Monaco namespace
 *   getEditor()                    the live editor instance
 *   getModel()                     the active model (or null)
 *   onActiveDocument(cb)           fires when the user switches documents
 *   onContentChange(cb)            fires (debounced) when the active doc changes
 *   addStatusItem({...})           add a status-bar item -> { update, dispose }
 *   registerCommand({...})         add a command (F1 palette + Extensions view)
 *   showPanel({title, html})       open a preview overlay -> { update, close }
 *   storage                        namespaced { get, set } over localStorage
 *   showMessage(text)              transient status-bar message
 */

export class ExtensionHost {
  /**
   * @param {object} deps injected by app.js
   *   deps.monaco, deps.getEditor, deps.addStatusItem, deps.registerCommand,
   *   deps.showPanel, deps.showMessage
   */
  constructor(deps) {
    this.deps = deps;
    this.active = new Map(); // id -> { ext, context }
    this._docListeners = new Set();
    this._contentListeners = new Set();
  }

  /** Called by app.js when the active document changes. */
  emitActiveDocument(model) {
    for (const cb of this._docListeners) safe(() => cb(model));
  }

  /** Called by app.js (debounced) when the active document's content changes. */
  emitContentChange(model) {
    for (const cb of this._contentListeners) safe(() => cb(model));
  }

  isActive(id) {
    return this.active.has(id);
  }

  activate(ext) {
    if (this.active.has(ext.id)) return;
    const subscriptions = [];
    const context = { subscriptions, storageKey: `limeedit.ext.${ext.id}` };
    const api = this._makeApi(ext, subscriptions);
    safe(() => ext.activate && ext.activate(api, context));
    this.active.set(ext.id, { ext, context });
  }

  deactivate(ext) {
    const entry = this.active.get(ext.id);
    if (!entry) return;
    safe(() => entry.ext.deactivate && entry.ext.deactivate());
    for (const dispose of entry.context.subscriptions.reverse()) safe(dispose);
    this.active.delete(ext.id);
  }

  _makeApi(ext, subscriptions) {
    const self = this;
    return {
      monaco: this.deps.monaco,
      getEditor: () => this.deps.getEditor(),
      getModel: () => {
        const ed = this.deps.getEditor();
        return ed ? ed.getModel() : null;
      },
      onActiveDocument(cb) {
        self._docListeners.add(cb);
        const off = () => self._docListeners.delete(cb);
        subscriptions.push(off);
        return off;
      },
      onContentChange(cb) {
        self._contentListeners.add(cb);
        const off = () => self._contentListeners.delete(cb);
        subscriptions.push(off);
        return off;
      },
      addStatusItem(spec) {
        const item = self.deps.addStatusItem({ ...spec, owner: ext.id });
        subscriptions.push(() => item.dispose());
        return item;
      },
      registerCommand(spec) {
        const cmd = self.deps.registerCommand({ ...spec, owner: ext.id });
        subscriptions.push(() => cmd.dispose());
        return cmd;
      },
      showPanel(spec) {
        return self.deps.showPanel(spec);
      },
      showMessage(text) {
        self.deps.showMessage(text);
      },
      storage: {
        get(key, fallback = null) {
          const raw = localStorage.getItem(`limeedit.ext.${ext.id}.${key}`);
          return raw === null ? fallback : JSON.parse(raw);
        },
        set(key, value) {
          localStorage.setItem(`limeedit.ext.${ext.id}.${key}`, JSON.stringify(value));
        },
      },
    };
  }
}

function safe(fn) {
  try {
    return fn();
  } catch (err) {
    console.error('[limeedit extension]', err);
  }
}

// ==================================================================
// Built-in extensions
// ==================================================================

/** Word / character / line counts in the status bar, live. */
const wordCount = {
  id: 'limeedit.word-count',
  name: 'Word Count',
  description: 'Live word, character, and line counts for the active document.',
  version: '1.0.0',
  author: 'LimeEdit',
  activate(api) {
    const item = api.addStatusItem({ id: 'word-count', text: '', tooltip: 'Words · Characters · Lines' });
    const refresh = () => {
      const model = api.getModel();
      if (!model) {
        item.update('');
        return;
      }
      const text = model.getValue();
      const words = (text.match(/\S+/g) || []).length;
      item.update(`${words} words · ${text.length} chars · ${model.getLineCount()} lines`);
    };
    api.onActiveDocument(refresh);
    api.onContentChange(refresh);
    refresh();
  },
};

/** Estimated reading time in the status bar. */
const readingTime = {
  id: 'limeedit.reading-time',
  name: 'Reading Time',
  description: 'Estimates how long the document takes to read (~200 wpm).',
  version: '1.0.0',
  author: 'LimeEdit',
  activate(api) {
    const item = api.addStatusItem({ id: 'reading-time', text: '', tooltip: 'Estimated reading time' });
    const refresh = () => {
      const model = api.getModel();
      if (!model) return item.update('');
      const words = (model.getValue().match(/\S+/g) || []).length;
      const minutes = Math.max(1, Math.round(words / 200));
      item.update(words ? `⏱ ${minutes} min read` : '');
    };
    api.onActiveDocument(refresh);
    api.onContentChange(refresh);
    refresh();
  },
};

/** Highlight trailing whitespace with a Monaco decoration. */
const trailingWhitespace = {
  id: 'limeedit.trailing-whitespace',
  name: 'Trailing Whitespace',
  description: 'Highlights trailing spaces and tabs at the ends of lines.',
  version: '1.0.0',
  author: 'LimeEdit',
  activate(api) {
    ensureStyle(
      'ext-trailing-ws',
      `.limeedit-trailing-ws { background: rgba(255, 90, 90, 0.35); }`
    );
    let collection = null;
    const refresh = () => {
      const ed = api.getEditor();
      const model = api.getModel();
      if (!ed || !model) return;
      const ranges = [];
      const lineCount = model.getLineCount();
      for (let i = 1; i <= Math.min(lineCount, 50000); i++) {
        const content = model.getLineContent(i);
        const m = /[ \t]+$/.exec(content);
        if (m) {
          ranges.push({
            range: new api.monaco.Range(i, m.index + 1, i, content.length + 1),
            options: { className: 'limeedit-trailing-ws' },
          });
        }
      }
      if (collection) collection.set(ranges);
      else collection = ed.createDecorationsCollection(ranges);
    };
    api.onActiveDocument(() => {
      if (collection) collection.clear();
      refresh();
    });
    api.onContentChange(refresh);
    refresh();
    return { dispose: () => collection && collection.clear() };
  },
  deactivate() {
    /* decoration collection is cleared via the host's subscription teardown */
  },
};

/** Toggle Monaco's bracket-pair colorization + indent guides. */
const bracketGuides = {
  id: 'limeedit.bracket-guides',
  name: 'Rainbow Brackets & Guides',
  description: 'Turns on bracket-pair colorization and active indent guides.',
  version: '1.0.0',
  author: 'LimeEdit',
  activate(api) {
    const ed = api.getEditor();
    ed.updateOptions({
      bracketPairColorization: { enabled: true },
      guides: { bracketPairs: 'active', indentation: true, highlightActiveIndentation: true },
    });
  },
  deactivate() {
    // app.js owns the editor; reset to defaults on disable.
    if (window.__limeeditEditor) {
      window.__limeeditEditor.updateOptions({
        bracketPairColorization: { enabled: false },
        guides: { bracketPairs: false, indentation: true, highlightActiveIndentation: false },
      });
    }
  },
};

/** Live Markdown preview in an overlay panel. */
const markdownPreview = {
  id: 'limeedit.markdown-preview',
  name: 'Markdown Preview',
  description: 'Renders the current Markdown document in a live side panel.',
  version: '1.0.0',
  author: 'LimeEdit',
  activate(api) {
    let panel = null;
    const render = () => {
      const model = api.getModel();
      if (!model) return;
      const html = markdownToHtml(model.getValue());
      if (panel) panel.update(html);
    };
    api.registerCommand({
      id: 'markdown.preview',
      title: 'Markdown: Open Preview',
      run: () => {
        const model = api.getModel();
        if (!model) return api.showMessage('Open a Markdown document first');
        panel = api.showPanel({ title: 'Markdown Preview', html: markdownToHtml(model.getValue()) });
      },
    });
    api.onContentChange(render);
    api.onActiveDocument(render);
  },
};

export const BUILTIN_EXTENSIONS = [
  wordCount,
  readingTime,
  trailingWhitespace,
  bracketGuides,
  markdownPreview,
];

// ------------------------------------------------------------------ raw install

/**
 * Compile a "raw" extension from pasted source. The source must evaluate to an
 * extension object (via a trailing expression or `return`). This runs code the
 * user themselves supplied, in their own editor — the LimeEdit analogue of
 * writing a VS Code extension by hand.
 * @returns {{ ext?: object, error?: string }}
 */
export function compileRawExtension(source) {
  try {
    // Allow either "return {...}" or a bare trailing object/expression.
    const body = /(^|\n)\s*return[\s({]/.test(source) ? source : `return (${source})`;
    const factory = new Function('monaco', body); // eslint-disable-line no-new-func
    const ext = factory(window.monaco);
    if (!ext || typeof ext !== 'object' || typeof ext.activate !== 'function') {
      return { error: 'Extension must be an object with an activate(api) function' };
    }
    if (!ext.id) ext.id = `raw.${Date.now()}`;
    ext.name = ext.name || ext.id;
    ext.description = ext.description || 'Installed from source';
    ext.version = ext.version || '0.0.0';
    ext.author = ext.author || 'you';
    ext.raw = true;
    return { ext };
  } catch (err) {
    return { error: err.message };
  }
}

// ------------------------------------------------------------------ helpers

function ensureStyle(id, css) {
  if (document.getElementById(id)) return;
  const style = document.createElement('style');
  style.id = id;
  style.textContent = css;
  document.head.appendChild(style);
}

/** Minimal, self-contained Markdown -> HTML. Escapes first, so content is safe. */
export function markdownToHtml(md) {
  const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const lines = md.replace(/\r\n?/g, '\n').split('\n');
  const out = [];
  let inCode = false;
  let listType = null;

  const closeList = () => {
    if (listType) {
      out.push(listType === 'ul' ? '</ul>' : '</ol>');
      listType = null;
    }
  };

  const inline = (s) =>
    esc(s)
      .replace(/`([^`]+)`/g, '<code>$1</code>')
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
      .replace(/\*([^*]+)\*/g, '<em>$1</em>')
      .replace(/\b_([^_]+)_\b/g, '<em>$1</em>')
      .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');

  for (const raw of lines) {
    const line = raw;
    if (/^```/.test(line)) {
      if (inCode) {
        out.push('</code></pre>');
        inCode = false;
      } else {
        closeList();
        out.push('<pre><code>');
        inCode = true;
      }
      continue;
    }
    if (inCode) {
      out.push(esc(line) + '\n');
      continue;
    }
    const heading = /^(#{1,6})\s+(.*)$/.exec(line);
    if (heading) {
      closeList();
      const level = heading[1].length;
      out.push(`<h${level}>${inline(heading[2])}</h${level}>`);
      continue;
    }
    if (/^\s*[-*+]\s+/.test(line)) {
      if (listType !== 'ul') {
        closeList();
        out.push('<ul>');
        listType = 'ul';
      }
      out.push(`<li>${inline(line.replace(/^\s*[-*+]\s+/, ''))}</li>`);
      continue;
    }
    if (/^\s*\d+\.\s+/.test(line)) {
      if (listType !== 'ol') {
        closeList();
        out.push('<ol>');
        listType = 'ol';
      }
      out.push(`<li>${inline(line.replace(/^\s*\d+\.\s+/, ''))}</li>`);
      continue;
    }
    if (/^\s*>\s?/.test(line)) {
      closeList();
      out.push(`<blockquote>${inline(line.replace(/^\s*>\s?/, ''))}</blockquote>`);
      continue;
    }
    if (/^\s*(---|\*\*\*|___)\s*$/.test(line)) {
      closeList();
      out.push('<hr />');
      continue;
    }
    if (line.trim() === '') {
      closeList();
      continue;
    }
    out.push(`<p>${inline(line)}</p>`);
  }
  closeList();
  if (inCode) out.push('</code></pre>');
  return out.join('\n');
}
