/*
 * functionscanner.js — powers the BBEdit-style function popup.
 *
 * Lightweight regex scanners per language family. This mirrors how BBEdit's
 * language modules feed its function popup: fast, line-oriented, good enough
 * to navigate real files.
 */

const SCANNERS = {
  javascript: [
    { re: /^\s*(?:export\s+)?(?:default\s+)?(?:async\s+)?function\s*\*?\s*([A-Za-z_$][\w$]*)/, kind: 'function' },
    { re: /^\s*(?:export\s+)?(?:abstract\s+)?class\s+([A-Za-z_$][\w$]*)/, kind: 'class' },
    { re: /^\s*(?:export\s+)?(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:async\s*)?(?:\([^)]*\)|[A-Za-z_$][\w$]*)\s*=>/, kind: 'function' },
    { re: /^\s{2,}(?:static\s+)?(?:async\s+)?(?:get\s+|set\s+)?\*?([A-Za-z_$][\w$]*)\s*\([^)]*\)\s*\{/, kind: 'method' },
  ],
  python: [
    { re: /^\s*(?:async\s+)?def\s+([A-Za-z_]\w*)/, kind: 'def' },
    { re: /^\s*class\s+([A-Za-z_]\w*)/, kind: 'class' },
  ],
  clike: [
    { re: /^(?:[\w:*&<>,~\s]+?)\b([A-Za-z_]\w*)\s*\([^;]*\)\s*(?:const\s*)?\{?\s*$/, kind: 'function' },
    { re: /^\s*(?:typedef\s+)?(?:struct|class|enum|union)\s+([A-Za-z_]\w*)/, kind: 'type' },
  ],
  go: [
    { re: /^func\s+(?:\([^)]*\)\s+)?([A-Za-z_]\w*)/, kind: 'func' },
    { re: /^type\s+([A-Za-z_]\w*)/, kind: 'type' },
  ],
  ruby: [
    { re: /^\s*def\s+([\w.?!=\[\]<>+*\/%-]+)/, kind: 'def' },
    { re: /^\s*(?:class|module)\s+([A-Z]\w*)/, kind: 'class' },
  ],
  rust: [
    { re: /^\s*(?:pub\s+)?(?:async\s+)?(?:unsafe\s+)?fn\s+([A-Za-z_]\w*)/, kind: 'fn' },
    { re: /^\s*(?:pub\s+)?(?:struct|enum|trait|impl)\s+([A-Za-z_][\w<>, ]*)/, kind: 'type' },
  ],
  php: [
    { re: /^\s*(?:public\s+|private\s+|protected\s+|static\s+)*function\s+([A-Za-z_]\w*)/, kind: 'function' },
    { re: /^\s*(?:abstract\s+|final\s+)?(?:class|interface|trait)\s+([A-Za-z_]\w*)/, kind: 'class' },
  ],
  java: [
    { re: /^\s*(?:public\s+|private\s+|protected\s+|static\s+|final\s+|abstract\s+|synchronized\s+)*[\w<>\[\], ]+\s+([A-Za-z_]\w*)\s*\([^;]*\)\s*(?:throws [\w, ]+)?\{/, kind: 'method' },
    { re: /^\s*(?:public\s+|private\s+|abstract\s+|final\s+)*(?:class|interface|enum|record)\s+([A-Za-z_]\w*)/, kind: 'class' },
  ],
  css: [{ re: /^([.#]?[\w-]+(?:\s*[,>+~]\s*[.#]?[\w-]+)*)\s*\{/, kind: 'rule' }],
  markdown: [{ re: /^(#{1,6})\s+(.*)/, kind: 'heading', group: 2 }],
  shell: [{ re: /^\s*(?:function\s+)?([A-Za-z_]\w*)\s*\(\)\s*\{?/, kind: 'function' }],
};

const LANGUAGE_FAMILY = {
  javascript: 'javascript',
  typescript: 'javascript',
  python: 'python',
  c: 'clike',
  cpp: 'clike',
  'objective-c': 'clike',
  csharp: 'java',
  go: 'go',
  ruby: 'ruby',
  rust: 'rust',
  php: 'php',
  java: 'java',
  kotlin: 'java',
  swift: 'go',
  css: 'css',
  scss: 'css',
  less: 'css',
  markdown: 'markdown',
  shell: 'shell',
};

/**
 * Scan a Monaco model for functions/headings.
 * @returns {{ name: string, kind: string, line: number }[]}
 */
export function scanFunctions(model, languageId) {
  const family = LANGUAGE_FAMILY[languageId];
  const scanners = family ? SCANNERS[family] : null;
  if (!scanners) return [];
  const results = [];
  const lineCount = model.getLineCount();
  const max = Math.min(lineCount, 20000);
  for (let i = 1; i <= max; i++) {
    const line = model.getLineContent(i);
    if (!line || line.length > 500) continue;
    for (const scanner of scanners) {
      const m = scanner.re.exec(line);
      if (m) {
        const name = m[scanner.group || 1];
        if (name && !isKeyword(name)) {
          results.push({ name: name.trim(), kind: scanner.kind, line: i });
        }
        break;
      }
    }
    if (results.length >= 500) break;
  }
  return results;
}

const KEYWORDS = new Set([
  'if', 'else', 'for', 'while', 'switch', 'return', 'catch', 'do', 'new', 'delete',
  'sizeof', 'typeof', 'case', 'break', 'continue', 'throw', 'try', 'in', 'of',
]);

function isKeyword(name) {
  return KEYWORDS.has(name);
}
