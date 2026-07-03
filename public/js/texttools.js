/*
 * texttools.js — BBEdit-style Text menu transformations.
 *
 * Every tool follows BBEdit's rule: operate on the selection if there is one,
 * otherwise on the entire document. All edits go through executeEdits so
 * undo/redo works as expected.
 */

/** Get the range a transformation applies to (selection, or whole document). */
function targetRange(editor, monaco, wholeLines = true) {
  const model = editor.getModel();
  const sel = editor.getSelection();
  if (!sel || sel.isEmpty()) {
    return model.getFullModelRange();
  }
  if (!wholeLines) return sel;
  // Expand to whole lines, the way BBEdit line-based tools behave.
  const endLine = sel.endColumn === 1 && sel.endLineNumber > sel.startLineNumber
    ? sel.endLineNumber - 1
    : sel.endLineNumber;
  return new monaco.Range(sel.startLineNumber, 1, endLine, model.getLineMaxColumn(endLine));
}

/** Replace the target range using a string -> string transform. */
function applyTransform(editor, monaco, fn, { wholeLines = true, source = 'limeedit.texttools' } = {}) {
  const model = editor.getModel();
  if (!model) return;
  const range = targetRange(editor, monaco, wholeLines);
  const original = model.getValueInRange(range);
  const replaced = fn(original, editor);
  if (replaced === original) return;
  editor.pushUndoStop();
  editor.executeEdits(source, [{ range, text: replaced, forceMoveMarkers: true }]);
  editor.pushUndoStop();
}

/** Line-based transform helper: string[] -> string[]. */
function applyLineTransform(editor, monaco, fn, opts) {
  applyTransform(editor, monaco, (text) => {
    const trailingNewline = /\r?\n$/.exec(text);
    const body = trailingNewline ? text.slice(0, -trailingNewline[0].length) : text;
    const eol = editor.getModel().getEOL();
    const out = fn(body.split(/\r\n|\r|\n/)).join(eol);
    return trailingNewline ? out + trailingNewline[0] : out;
  }, opts);
}

// ---------------------------------------------------------------- case

export function upperCase(editor, monaco) {
  applyTransform(editor, monaco, (t) => t.toUpperCase(), { wholeLines: false });
}

export function lowerCase(editor, monaco) {
  applyTransform(editor, monaco, (t) => t.toLowerCase(), { wholeLines: false });
}

export function titleCase(editor, monaco) {
  applyTransform(
    editor,
    monaco,
    (t) => t.replace(/[A-Za-zÀ-ÖØ-öø-ÿ0-9'’]+/g, (w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()),
    { wholeLines: false }
  );
}

export function sentenceCase(editor, monaco) {
  applyTransform(
    editor,
    monaco,
    (t) =>
      t.toLowerCase().replace(/(^\s*|[.!?]\s+)([a-zà-öø-ÿ])/g, (_, pre, ch) => pre + ch.toUpperCase()),
    { wholeLines: false }
  );
}

export function toggleCase(editor, monaco) {
  applyTransform(
    editor,
    monaco,
    (t) =>
      Array.from(t)
        .map((ch) => (ch === ch.toUpperCase() ? ch.toLowerCase() : ch.toUpperCase()))
        .join(''),
    { wholeLines: false }
  );
}

// ---------------------------------------------------------------- lines

export function sortLines(editor, monaco, { descending = false, caseSensitive = false, unique = false } = {}) {
  applyLineTransform(editor, monaco, (lines) => {
    const collator = new Intl.Collator(undefined, { sensitivity: caseSensitive ? 'variant' : 'base', numeric: true });
    let out = [...lines].sort((a, b) => collator.compare(a, b));
    if (descending) out.reverse();
    if (unique) {
      const seen = new Set();
      out = out.filter((l) => {
        const key = caseSensitive ? l : l.toLowerCase();
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
    }
    return out;
  });
}

export function reverseLines(editor, monaco) {
  applyLineTransform(editor, monaco, (lines) => [...lines].reverse());
}

export function processDuplicateLines(editor, monaco, { caseSensitive = true } = {}) {
  applyLineTransform(editor, monaco, (lines) => {
    const seen = new Set();
    return lines.filter((l) => {
      const key = caseSensitive ? l : l.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  });
}

export function deleteBlankLines(editor, monaco) {
  applyLineTransform(editor, monaco, (lines) => lines.filter((l) => l.trim() !== ''));
}

export function prefixSuffixLines(editor, monaco, { prefix = '', suffix = '', remove = false } = {}) {
  applyLineTransform(editor, monaco, (lines) =>
    lines.map((l) => {
      if (remove) {
        let out = l;
        if (prefix && out.startsWith(prefix)) out = out.slice(prefix.length);
        if (suffix && out.endsWith(suffix)) out = out.slice(0, out.length - suffix.length);
        return out;
      }
      return prefix + l + suffix;
    })
  );
}

export function addLineNumbers(editor, monaco) {
  applyLineTransform(editor, monaco, (lines) => {
    const width = String(lines.length).length;
    return lines.map((l, i) => `${String(i + 1).padStart(width)}\t${l}`);
  });
}

export function removeLineNumbers(editor, monaco) {
  applyLineTransform(editor, monaco, (lines) => lines.map((l) => l.replace(/^\s*\d+[.:)]?[\t ]/, '')));
}

// ---------------------------------------------------------------- whitespace

export function stripTrailingWhitespace(editor, monaco) {
  applyLineTransform(editor, monaco, (lines) => lines.map((l) => l.replace(/[ \t]+$/, '')));
}

export function detab(editor, monaco, tabWidth = 4) {
  applyLineTransform(editor, monaco, (lines) =>
    lines.map((line) => {
      let out = '';
      for (const ch of line) {
        if (ch === '\t') {
          out += ' '.repeat(tabWidth - (out.length % tabWidth));
        } else {
          out += ch;
        }
      }
      return out;
    })
  );
}

export function entab(editor, monaco, tabWidth = 4) {
  applyLineTransform(editor, monaco, (lines) =>
    lines.map((line) => {
      const m = /^[ \t]*/.exec(line)[0];
      let col = 0;
      for (const ch of m) col += ch === '\t' ? tabWidth - (col % tabWidth) : 1;
      const tabs = Math.floor(col / tabWidth);
      return '\t'.repeat(tabs) + ' '.repeat(col % tabWidth) + line.slice(m.length);
    })
  );
}

// ---------------------------------------------------------------- gremlins & quotes

const GREMLIN_RE = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F\u200B\u200C\u200D\u2060\uFEFF]/g;

export function zapGremlins(editor, monaco, { replaceWith = '' } = {}) {
  applyTransform(
    editor,
    monaco,
    (t) => t.replace(GREMLIN_RE, replaceWith).replace(/\u00A0/g, ' '),
    { wholeLines: false }
  );
}

export function straightenQuotes(editor, monaco) {
  applyTransform(
    editor,
    monaco,
    (t) => t.replace(/[‘’‚]/g, "'").replace(/[“”„]/g, '"'),
    { wholeLines: false }
  );
}

export function educateQuotes(editor, monaco) {
  applyTransform(
    editor,
    monaco,
    (t) =>
      t
        .replace(/(^|[\s([{<])"/g, '$1“')
        .replace(/"/g, '”')
        .replace(/(^|[\s([{<])'/g, '$1‘')
        .replace(/'/g, '’'),
    { wholeLines: false }
  );
}

// ---------------------------------------------------------------- hard wrap

export function hardWrap(editor, monaco, width = 80) {
  applyLineTransform(editor, monaco, (lines) => {
    const out = [];
    for (const line of lines) {
      if (line.length <= width) {
        out.push(line);
        continue;
      }
      const indent = /^[ \t]*/.exec(line)[0];
      let current = '';
      for (const word of line.trim().split(/\s+/)) {
        if (current && (indent + current + ' ' + word).length > width) {
          out.push(indent + current);
          current = word;
        } else {
          current = current ? current + ' ' + word : word;
        }
      }
      if (current) out.push(indent + current);
    }
    return out;
  });
}
