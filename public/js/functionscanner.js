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
  swift: [
    { re: /^\s*(?:public\s+|private\s+|internal\s+|fileprivate\s+|open\s+|final\s+|static\s+|class\s+|override\s+|mutating\s+)*func\s+([A-Za-z_]\w*)/, kind: 'func' },
    { re: /^\s*(?:public\s+|private\s+|final\s+|open\s+)*(?:class|struct|enum|protocol|extension|actor)\s+([A-Za-z_]\w*)/, kind: 'type' },
  ],
  kotlin: [
    { re: /^\s*(?:public\s+|private\s+|internal\s+|protected\s+|override\s+|open\s+|suspend\s+|inline\s+)*fun\s+(?:<[^>]*>\s*)?([A-Za-z_]\w*)/, kind: 'fun' },
    { re: /^\s*(?:public\s+|private\s+|sealed\s+|data\s+|abstract\s+|open\s+)*(?:class|interface|object|enum\s+class)\s+([A-Za-z_]\w*)/, kind: 'class' },
  ],
  scala: [
    { re: /^\s*(?:override\s+|final\s+|private\s+|protected\s+)*def\s+([A-Za-z_]\w*)/, kind: 'def' },
    { re: /^\s*(?:sealed\s+|final\s+|abstract\s+|case\s+)*(?:class|object|trait)\s+([A-Za-z_]\w*)/, kind: 'type' },
  ],
  dart: [
    { re: /^\s*(?:[\w<>,?[\] ]+\s+)?([A-Za-z_]\w*)\s*\([^;{]*\)\s*(?:async\s*)?\{/, kind: 'method' },
    { re: /^\s*(?:abstract\s+)?(?:class|mixin|enum|extension)\s+([A-Za-z_]\w*)/, kind: 'class' },
  ],
  lua: [
    { re: /^\s*(?:local\s+)?function\s+([\w.:]+)/, kind: 'function' },
    { re: /^\s*([\w.]+)\s*=\s*function\b/, kind: 'function' },
  ],
  perl: [{ re: /^\s*sub\s+([A-Za-z_]\w*)/, kind: 'sub' }, { re: /^\s*package\s+([\w:]+)/, kind: 'package' }],
  r: [{ re: /^\s*([A-Za-z._][\w.]*)\s*(?:<-|=)\s*function\b/, kind: 'function' }],
  julia: [
    { re: /^\s*function\s+([\w.!]+)/, kind: 'function' },
    { re: /^\s*(?:mutable\s+)?struct\s+([A-Za-z_]\w*)/, kind: 'struct' },
    { re: /^\s*(?:module|macro)\s+([A-Za-z_]\w*)/, kind: 'module' },
  ],
  elixir: [
    { re: /^\s*def(?:p|macro|module)?\s+([A-Za-z_]\w*[?!]?)/, kind: 'def' },
    { re: /^\s*defmodule\s+([\w.]+)/, kind: 'module' },
  ],
  powershell: [{ re: /^\s*function\s+([\w-]+)/i, kind: 'function' }, { re: /^\s*class\s+([A-Za-z_]\w*)/, kind: 'class' }],
  sql: [
    { re: /^\s*(?:create|alter)\s+(?:or\s+replace\s+)?(?:table|view|function|procedure|trigger|index)\s+(?:if\s+not\s+exists\s+)?[`"[]?([\w.]+)/i, kind: 'object' },
  ],
  yaml: [{ re: /^([A-Za-z_][\w-]*):\s*(?:$|[#&*!|>].*$)/, kind: 'key' }],
  toml: [{ re: /^\s*\[\[?([\w.\- "]+)\]\]?/, kind: 'table' }],
  ini: [{ re: /^\s*\[([^\]]+)\]/, kind: 'section' }],
  vb: [
    { re: /^\s*(?:Public\s+|Private\s+|Friend\s+|Protected\s+|Shared\s+)*(?:Sub|Function)\s+([A-Za-z_]\w*)/i, kind: 'method' },
    { re: /^\s*(?:Public\s+|Private\s+)*(?:Class|Module|Structure|Interface)\s+([A-Za-z_]\w*)/i, kind: 'type' },
  ],
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
  kotlin: 'kotlin',
  swift: 'swift',
  scala: 'scala',
  dart: 'dart',
  lua: 'lua',
  perl: 'perl',
  r: 'r',
  julia: 'julia',
  elixir: 'elixir',
  powershell: 'powershell',
  sql: 'sql',
  mysql: 'sql',
  pgsql: 'sql',
  redshift: 'sql',
  yaml: 'yaml',
  toml: 'toml',
  ini: 'ini',
  vb: 'vb',
  solidity: 'clike',
  cypher: 'clike',
  css: 'css',
  scss: 'css',
  less: 'css',
  markdown: 'markdown',
  mdx: 'markdown',
  shell: 'shell',
  bat: 'shell',
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
