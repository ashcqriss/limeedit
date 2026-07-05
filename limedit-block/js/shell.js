/*
 * LIMEdit BLOCK — shell.js
 * limesh: the interactive shell that fronts the hybrid kernel.
 *
 * Every command is arbitrated by LIMAWEK before it runs — a DOS verb flips the
 * kernel to real-mode, a Linux verb flips it back — and the *prompt itself
 * changes* to show which personality is live:
 *
 *      C:\HOME\LIME>            (DOS real-mode)
 *      [lime@limebox ~]$        (Linux / Arch)
 *
 * limesh is also a real shell, not just a dispatcher:
 *
 *      help | grep pacman            pipes (grep · head · tail · wc · sort · uniq)
 *      ls > listing.txt              redirection (> and >>)
 *      mkdir demo && cd demo         command chaining
 */
'use strict';

const Shell = (() => {
  function tokenize(line) {
    const out = []; let cur = '', q = null;
    for (const ch of line) {
      if (q) { if (ch === q) q = null; else cur += ch; }
      else if (ch === '"' || ch === "'") q = ch;
      else if (ch === ' ') { if (cur) { out.push(cur); cur = ''; } }
      else cur += ch;
    }
    if (cur) out.push(cur);
    return out;
  }

  // Split on a top-level operator, respecting quotes.
  function splitOp(line, op) {
    const parts = []; let cur = '', q = null;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (q) { if (ch === q) q = null; cur += ch; continue; }
      if (ch === '"' || ch === "'") { q = ch; cur += ch; continue; }
      if (op === '&&' && ch === '&' && line[i + 1] === '&') { parts.push(cur); cur = ''; i++; continue; }
      if (op === '|' && ch === '|' && line[i + 1] !== '|' && line[i - 1] !== '|') { parts.push(cur); cur = ''; continue; }
      cur += ch;
    }
    parts.push(cur);
    return parts;
  }

  // Trailing `> file` / `>> file` (unquoted).
  function stripRedirect(line) {
    const m = line.match(/(>>?)\s*([^\s>]+)\s*$/);
    if (!m || line.slice(0, m.index).split('"').length % 2 === 0) return { line, mode: null };
    return { line: line.slice(0, m.index).trim(), mode: m[1], target: m[2] };
  }

  // Pipe filters operate on captured plain-text lines.
  function applyFilter(lines, seg, ctx) {
    const t = tokenize(seg);
    const f = (t[0] || '').toLowerCase();
    const nArg = () => { const i = t.indexOf('-n'); if (i >= 0) return Number(t[i + 1]) || 10; if (t[1] && /^\d+$/.test(t[1])) return +t[1]; return 10; };
    if (f === 'grep') {
      if (!t[1]) { ctx.print('grep: missing pattern', 'err'); return []; }
      let re; try { re = new RegExp(t[1], 'i'); } catch (_) { ctx.print('grep: invalid pattern', 'err'); return []; }
      return lines.filter((l) => re.test(l));
    }
    if (f === 'head') return lines.slice(0, nArg());
    if (f === 'tail') return lines.slice(-nArg());
    if (f === 'wc') {
      const text = lines.join('\n');
      const words = text.trim() ? text.trim().split(/\s+/).length : 0;
      return [`      ${lines.length}      ${words}      ${text.length}`];
    }
    if (f === 'sort') return [...lines].sort();
    if (f === 'uniq') return lines.filter((l, i) => l !== lines[i - 1]);
    ctx.print('limesh: unsupported pipe filter: ' + f + '  (grep|head|tail|wc|sort|uniq)', 'err');
    return lines;
  }

  // A ctx whose writers append plain text to a buffer (for pipes/redirects).
  function captureCtx(ctx, buf) {
    return {
      ...ctx,
      print: (t = '') => String(t).split('\n').forEach((l) => buf.push(l)),
      printHTML: (h = '') => { const d = document.createElement('div'); d.innerHTML = h; buf.push(d.textContent); },
      printEl: (elm) => String(elm.textContent || '').split('\n').forEach((l) => buf.push(l)),
      clear: () => { buf.length = 0; },
      registerAnim: (fn) => { try { fn(); } catch (_) {} },   // animations are meaningless in a pipe
    };
  }

  function dosPath(cwd) {
    const parts = cwd.split('/').filter(Boolean).map((s) => s.toUpperCase());
    return 'C:\\' + parts.join('\\') + '>';
  }

  // ------------------------------------------------------------ terminal
  function create(mountEl, gui, opts = {}) {
    const state = {
      cwd: '/home/lime',
      env: { USER: 'lime', HOME: '/home/lime', SHELL: '/bin/limesh', TERM: 'limeterm', PATH: '/bin:/usr/bin' },
      aliases: { ll: 'ls -l', la: 'ls -la', '..': 'cd ..' },
      history: [], histIdx: -1,
      isRoot: !!opts.root,
    };

    mountEl.classList.add('term');
    const output = document.createElement('div'); output.className = 'term-out';
    const inputLine = document.createElement('div'); inputLine.className = 'term-inputline';
    const promptEl = document.createElement('span'); promptEl.className = 'term-prompt';
    const input = document.createElement('input'); input.className = 'term-input';
    input.setAttribute('autocomplete', 'off'); input.setAttribute('spellcheck', 'false');
    inputLine.append(promptEl, input);
    mountEl.append(output, inputLine);

    const anims = [];
    const stopAnims = () => { while (anims.length) { try { anims.pop()(); } catch (_) {} } };

    function promptStr() {
      if (Kernel.LIMAWEK.personality().prompt === 'dos') return dosPath(state.cwd) + ' ';
      const cwd = state.cwd.replace('/home/lime', '~');
      return `[lime@limebox ${cwd.split('/').pop() || '/'}]$ `;
    }
    const refreshPrompt = () => { promptEl.textContent = promptStr(); promptEl.className = 'term-prompt ' + Kernel.LIMAWEK.personality().prompt; };
    const scroll = () => { mountEl.scrollTop = mountEl.scrollHeight; };

    const ctx = {
      shell: state, gui,
      registerAnim: (fn) => anims.push(fn),
      print(text = '', cls = '') { const pre = document.createElement('pre'); pre.className = 'term-line' + (cls ? ' ' + cls : ''); pre.textContent = String(text); output.appendChild(pre); scroll(); },
      printHTML(html, cls = '') { const pre = document.createElement('pre'); pre.className = 'term-line' + (cls ? ' ' + cls : ''); pre.innerHTML = html; output.appendChild(pre); scroll(); },
      printEl(elm) { output.appendChild(elm); scroll(); },
      clear() { output.innerHTML = ''; },
    };

    function echoCommand(line) {
      const esc = (s) => s.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
      const pre = document.createElement('pre');
      pre.className = 'term-line term-echo';
      pre.innerHTML = `<span class="term-prompt ${Kernel.LIMAWEK.personality().prompt}">${esc(promptStr())}</span>${esc(line)}`;
      output.appendChild(pre);
    }

    function execute(line) { stopAnims(); run(line, ctx); refreshPrompt(); scroll(); }

    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        const line = input.value; echoCommand(line); input.value = '';
        if (line.trim()) { state.history.push(line); state.histIdx = state.history.length; }
        execute(line);
      } else if (e.key === 'ArrowUp') { if (state.histIdx > 0) { state.histIdx--; input.value = state.history[state.histIdx] || ''; } e.preventDefault(); }
      else if (e.key === 'ArrowDown') { if (state.histIdx < state.history.length - 1) { state.histIdx++; input.value = state.history[state.histIdx] || ''; } else { state.histIdx = state.history.length; input.value = ''; } e.preventDefault(); }
      else if (e.key === 'Tab') { e.preventDefault(); completeTab(); }
      else if (e.key === 'l' && e.ctrlKey) { e.preventDefault(); ctx.clear(); }
      else if (e.key === 'u' && e.ctrlKey) { e.preventDefault(); input.value = ''; }
      else if (e.key === 'c' && e.ctrlKey && !window.getSelection().toString()) { echoCommand(input.value + '^C'); input.value = ''; }
    });

    function completeTab() {
      const parts = tokenize(input.value);
      if (parts.length <= 1 && !input.value.endsWith(' ')) {
        const frag = (parts[0] || '').toLowerCase();
        const hits = Object.keys(Commands.table).filter((c) => c.startsWith(frag));
        if (hits.length === 1) input.value = hits[0] + ' ';
        else if (hits.length > 1) ctx.print(hits.join('  '), 'dim');
      } else {
        const frag = parts[parts.length - 1] || '';
        const base = frag.includes('/') ? frag.slice(0, frag.lastIndexOf('/') + 1) : '';
        const seek = frag.slice(base.length);
        const dirAbs = Kernel.fs.normalize(state.cwd, base || '.');
        if (Kernel.fs.isDir(dirAbs)) {
          const hits = Object.keys(Kernel.fs.list(dirAbs)).filter((n) => n.startsWith(seek));
          if (hits.length === 1) { parts[parts.length - 1] = base + hits[0] + (Kernel.fs.isDir(dirAbs + '/' + hits[0]) ? '/' : ''); input.value = parts.join(' '); }
          else if (hits.length > 1) ctx.print(hits.join('  '), 'dim');
        }
      }
    }

    mountEl.addEventListener('mousedown', () => setTimeout(() => input.focus(), 0));

    refreshPrompt();
    ctx.print(Kernel.fs.read('/etc/motd').replace(/\n$/, ''), 'accent');
    setTimeout(() => input.focus(), 30);

    Kernel.LIMAWEK.onChange(() => refreshPrompt());

    return { state, ctx, focus: () => input.focus(), execute };
  }

  // ------------------------------------------------------------ dispatch
  /* Run a single simple command (no operators). Kernel-switch messages go to
     msgCtx (the live terminal) even when output is being captured. */
  function dispatch(line, ctx, msgCtx) {
    msgCtx = msgCtx || ctx;
    line = String(line).trim();
    if (!line || line.startsWith('#') || /^rem\s/i.test(line)) return;

    let tokens = tokenize(line);
    const first = tokens[0];
    if (ctx.shell.aliases[first]) { tokens = tokenize(ctx.shell.aliases[first]).concat(tokens.slice(1)); line = tokens.join(' '); }

    const name = (tokens[0] || '').toLowerCase();
    const args = tokens.slice(1);
    const cmd = Commands.table[name];

    if (!cmd) {
      if (Kernel.LIMAWEK.personality().prompt === 'dos') { ctx.print('Bad command or file name', 'err'); return; }
      ctx.print(`limesh: command not found: ${tokens[0]}`, 'err');
      const guess = Object.keys(Commands.table).find((c) => c.startsWith(name.slice(0, 3)));
      if (guess) ctx.print('  did you mean `' + guess + '`?  (try `help`)', 'dim');
      return;
    }

    // LIMAWEK arbitrates: present the personality this workload's ABI needs.
    const switchLine = Kernel.LIMAWEK.require(Commands.abi(name), tokens[0]);
    if (switchLine) msgCtx.print(switchLine, 'kmsg');

    try { cmd.run(ctx, args, line); }
    catch (e) { ctx.print('limesh: ' + name + ': ' + e.message, 'err'); }
  }

  // One `&&` segment: handle redirection + pipes.
  function runSingle(line, ctx) {
    const red = stripRedirect(line);
    const stages = splitOp(red.line, '|').map((s) => s.trim()).filter(Boolean);
    if (!stages.length) return;

    if (stages.length === 1 && !red.mode) return dispatch(stages[0], ctx);

    const buf = [];
    dispatch(stages[0], captureCtx(ctx, buf), ctx);
    let lines = buf;
    for (let i = 1; i < stages.length; i++) lines = applyFilter(lines, stages[i], ctx);

    if (red.mode) {
      try {
        const abs = Kernel.fs.normalize(ctx.shell.cwd, red.target);
        const text = lines.join('\n') + (lines.length ? '\n' : '');
        if (red.mode === '>>' && Kernel.fs.isFile(abs)) Kernel.fs.write(abs, Kernel.fs.read(abs) + text);
        else Kernel.fs.write(abs, text);
      } catch (e) { ctx.print('limesh: redirect: ' + e.message, 'err'); }
    } else {
      lines.forEach((l) => ctx.print(l));
    }
  }

  // Public entry: full command line with && chaining.
  function run(line, ctx) {
    for (const seg of splitOp(String(line), '&&')) {
      const s = seg.trim();
      if (s) runSingle(s, ctx);
    }
  }

  return { create, run, tokenize };
})();
window.Shell = Shell;
