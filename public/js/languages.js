/*
 * languages.js — register languages Monaco doesn't bundle.
 *
 * Monaco ships ~80 languages, but a few very common config/build formats are
 * missing: TOML (Cargo.toml, pyproject.toml), dotenv (.env), and Makefiles.
 * We register compact Monarch grammars for those, plus a handful of filename
 * and extension associations so files land on the right mode.
 */

export function registerExtraLanguages(monaco) {
  const existing = new Set(monaco.languages.getLanguages().map((l) => l.id));

  if (!existing.has('toml')) {
    monaco.languages.register({ id: 'toml', extensions: ['.toml'], filenames: ['Cargo.lock', 'poetry.lock'], aliases: ['TOML', 'toml'] });
    monaco.languages.setMonarchTokensProvider('toml', {
      tokenizer: {
        root: [
          [/^\s*#.*$/, 'comment'],
          [/^\s*\[\[?[^\]]*\]\]?/, 'type'], // [table] / [[array-of-tables]]
          [/[A-Za-z0-9_.-]+(?=\s*=)/, 'key'],
          [/=/, 'operator'],
          [/"""/, { token: 'string', next: '@mstring' }],
          [/"/, { token: 'string', next: '@string' }],
          [/'/, { token: 'string', next: '@sstring' }],
          [/\b(true|false)\b/, 'keyword'],
          [/\b\d{4}-\d{2}-\d{2}([T ]\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})?)?/, 'number'], // dates
          [/[+-]?(\d[\d_]*\.?[\d_]*([eE][+-]?\d+)?|0x[0-9a-fA-F_]+|0o[0-7_]+|0b[01_]+)/, 'number'],
        ],
        string: [[/[^"]+/, 'string'], [/"/, { token: 'string', next: '@pop' }]],
        sstring: [[/[^']+/, 'string'], [/'/, { token: 'string', next: '@pop' }]],
        mstring: [[/[^"]+/, 'string'], [/"""/, { token: 'string', next: '@pop' }], [/"/, 'string']],
      },
    });
    monaco.languages.setLanguageConfiguration('toml', {
      comments: { lineComment: '#' },
      brackets: [['[', ']'], ['{', '}']],
      autoClosingPairs: [{ open: '"', close: '"' }, { open: "'", close: "'" }, { open: '[', close: ']' }],
    });
  }

  if (!existing.has('dotenv')) {
    monaco.languages.register({ id: 'dotenv', extensions: ['.env'], filenames: ['.env', '.env.local', '.env.example'], aliases: ['dotenv', 'Env File'] });
    monaco.languages.setMonarchTokensProvider('dotenv', {
      tokenizer: {
        root: [
          [/^\s*#.*$/, 'comment'],
          [/^\s*(?:export\s+)?[A-Za-z_][A-Za-z0-9_]*(?=\s*=)/, 'key'],
          [/=/, 'operator'],
          [/"[^"]*"/, 'string'],
          [/'[^']*'/, 'string'],
          [/\$\{?[A-Za-z_][A-Za-z0-9_]*\}?/, 'variable'],
        ],
      },
    });
    monaco.languages.setLanguageConfiguration('dotenv', { comments: { lineComment: '#' } });
  }

  if (!existing.has('makefile')) {
    monaco.languages.register({ id: 'makefile', extensions: ['.mk', '.mak'], filenames: ['Makefile', 'makefile', 'GNUmakefile'], aliases: ['Makefile', 'make'] });
    monaco.languages.setMonarchTokensProvider('makefile', {
      tokenizer: {
        root: [
          [/^\s*#.*$/, 'comment'],
          [/^\.[A-Z]+\b/, 'keyword'], // .PHONY, .DEFAULT ...
          [/^[A-Za-z0-9_./%$()-]+(?=\s*:(?!=))/, 'type'], // targets
          [/\b[A-Za-z_][A-Za-z0-9_]*(?=\s*[:?+]?=)/, 'key'], // variables
          [/\$[({][A-Za-z_][\w]*[)}]/, 'variable'],
          [/[:?+]?=/, 'operator'],
          [/"[^"]*"/, 'string'],
        ],
      },
    });
    monaco.languages.setLanguageConfiguration('makefile', { comments: { lineComment: '#' } });
  }
}

/**
 * Filename/extension associations for files whose mode Monaco won't infer.
 * Maps a lower-cased filename or ".ext" to a registered language id. Consulted
 * by languageForPath() before falling back to plaintext.
 */
export const FILENAME_LANGUAGE = {
  dockerfile: 'dockerfile',
  'dockerfile.dev': 'dockerfile',
  '.gitignore': 'ini',
  '.gitattributes': 'ini',
  '.npmrc': 'ini',
  '.editorconfig': 'ini',
  '.babelrc': 'json',
  '.eslintrc': 'json',
  '.prettierrc': 'json',
  'tsconfig.json': 'json',
  'jsconfig.json': 'json',
  '.bashrc': 'shell',
  '.zshrc': 'shell',
  '.bash_profile': 'shell',
  '.profile': 'shell',
};

export const EXT_LANGUAGE = {
  '.toml': 'toml',
  '.env': 'dotenv',
  '.mk': 'makefile',
  '.mjs': 'javascript',
  '.cjs': 'javascript',
  '.cts': 'typescript',
  '.mts': 'typescript',
  '.jsonc': 'json',
  '.json5': 'json',
  '.tf': 'hcl',
  '.tfvars': 'hcl',
  '.gradle': 'java',
  '.pyi': 'python',
  '.zsh': 'shell',
  '.bash': 'shell',
  '.command': 'shell',
  '.h': 'cpp',
  '.hpp': 'cpp',
  '.cc': 'cpp',
  '.cxx': 'cpp',
  '.ino': 'cpp',
};
