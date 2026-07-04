/*
 * LIMEdit BLOCK — shell.js
 * limesh: the interactive shell that every Terminal window runs. It owns the
 * prompt, history, tab-completion, and dispatch into the command table. The
 * whole desktop is, at heart, one of these.
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

  // A terminal instance bound to a container element.
  function create(mountEl, gui) {
    const state = {
      cwd: '/home/lime',
      env: { USER: 'lime', HOME: '/home/lime', SHELL: '/bin/limesh', TERM: 'limeterm', PATH: '/bin:/usr/bin' },
      aliases: { ll: 'ls -l', la: 'ls -la', '..': 'cd ..', cls: 'clear' },
      history: [],
      histIdx: -1,
    };

    mountEl.classList.add('term');
    const output = document.createElement('div');
    output.className = 'term-out';
    const inputLine = document.createElement('div');
    inputLine.className = 'term-inputline';
    const promptEl = document.createElement('span');
    promptEl.className = 'term-prompt';
    const input = document.createElement('input');
    input.className = 'term-input';
    input.setAttribute('autocomplete', 'off'); input.setAttribute('spellcheck', 'false');
    inputLine.append(promptEl, input);
    mountEl.append(output, inputLine);

    const anims = [];
    function stopAnims() { while (anims.length) { try { anims.pop()(); } catch (_) {} } }

    function promptStr() {
      const cwd = state.cwd.replace('/home/lime', '~');
      return `lime@limebox:${cwd}$ `;
    }
    function refreshPrompt() { promptEl.textContent = promptStr(); }

    function scroll() { mountEl.scrollTop = mountEl.scrollHeight; }

    const ctx = {
      shell: state,
      gui,
      registerAnim: (fn) => anims.push(fn),
      print(text = '', cls = '') {
        const pre = document.createElement('pre');
        pre.className = 'term-line' + (cls ? ' ' + cls : '');
        pre.textContent = String(text);
        output.appendChild(pre); scroll();
      },
      printHTML(html, cls = '') {
        const pre = document.createElement('pre');
        pre.className = 'term-line' + (cls ? ' ' + cls : '');
        pre.innerHTML = html;
        output.appendChild(pre); scroll();
      },
      printEl(el) { output.appendChild(el); scroll(); },
      clear() { output.innerHTML = ''; },
    };

    function echoCommand(line) {
      const pre = document.createElement('pre');
      pre.className = 'term-line term-echo';
      pre.innerHTML = `<span class="term-prompt">${promptStr()}</span>${line.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]))}`;
      output.appendChild(pre);
    }

    function execute(line) {
      stopAnims();
      run(line, ctx);
      refreshPrompt();
      scroll();
    }

    // Input handling
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        const line = input.value;
        echoCommand(line);
        input.value = '';
        if (line.trim()) { state.history.push(line); state.histIdx = state.history.length; }
        execute(line);
      } else if (e.key === 'ArrowUp') {
        if (state.histIdx > 0) { state.histIdx--; input.value = state.history[state.histIdx] || ''; }
        e.preventDefault();
      } else if (e.key === 'ArrowDown') {
        if (state.histIdx < state.history.length - 1) { state.histIdx++; input.value = state.history[state.histIdx] || ''; }
        else { state.histIdx = state.history.length; input.value = ''; }
        e.preventDefault();
      } else if (e.key === 'Tab') {
        e.preventDefault();
        completeTab();
      } else if (e.key === 'l' && e.ctrlKey) {
        e.preventDefault(); ctx.clear();
      } else if (e.key === 'c' && e.ctrlKey) {
        echoCommand(input.value + '^C'); input.value = '';
      }
    });

    function completeTab() {
      const parts = tokenize(input.value);
      if (parts.length <= 1 && !input.value.endsWith(' ')) {
        const frag = (parts[0] || '').toLowerCase();
        const hits = Object.keys(Commands.table).filter((c) => c.startsWith(frag));
        if (hits.length === 1) input.value = hits[0] + ' ';
        else if (hits.length > 1) { ctx.print(hits.join('  '), 'dim'); }
      } else {
        // complete a path in cwd
        const frag = parts[parts.length - 1] || '';
        const base = frag.includes('/') ? frag.slice(0, frag.lastIndexOf('/') + 1) : '';
        const seek = frag.slice(base.length);
        const dirAbs = Kernel.fs.normalize(state.cwd, base || '.');
        if (Kernel.fs.isDir(dirAbs)) {
          const hits = Object.keys(Kernel.fs.list(dirAbs)).filter((n) => n.startsWith(seek));
          if (hits.length === 1) {
            parts[parts.length - 1] = base + hits[0] + (Kernel.fs.isDir(dirAbs + '/' + hits[0]) ? '/' : '');
            input.value = parts.join(' ');
          } else if (hits.length > 1) ctx.print(hits.join('  '), 'dim');
        }
      }
    }

    mountEl.addEventListener('mousedown', () => setTimeout(() => input.focus(), 0));

    // greeting
    refreshPrompt();
    ctx.print(Kernel.fs.read('/etc/motd').replace(/\n$/, ''), 'accent');
    setTimeout(() => input.focus(), 30);

    return { state, ctx, focus: () => input.focus(), execute };
  }

  // Execute one command line inside an existing ctx (used by `sudo`, GUI, etc.)
  function run(line, ctx) {
    line = String(line).trim();
    if (!line || line.startsWith('#')) return;

    // alias expansion on the first word
    let tokens = tokenize(line);
    const first = tokens[0];
    if (ctx.shell.aliases[first]) {
      tokens = tokenize(ctx.shell.aliases[first]).concat(tokens.slice(1));
      line = tokens.join(' ');
    }

    const name = (tokens[0] || '').toLowerCase();
    const args = tokens.slice(1);
    const cmd = Commands.table[name];
    if (!cmd) {
      // DOS "command /?" help form
      if (args[0] === '/?' && Commands.table[name]) return;
      ctx.print(`limesh: command not found: ${tokens[0]}`, 'err');
      const guess = Object.keys(Commands.table).find((c) => c.startsWith(name.slice(0, 3)));
      if (guess) ctx.print('  did you mean `' + guess + '`?  (try `help`)', 'dim');
      return;
    }
    try { cmd.run(ctx, args, line); }
    catch (e) { ctx.print('limesh: ' + name + ': ' + e.message, 'err'); }
  }

  return { create, run, tokenize };
})();
window.Shell = Shell;
