/*
 * LIMEdit BLOCK — commands.js
 * The command library for limesh. Four dialects live side by side:
 *
 *   • Modern GNU/Arch userland  — ls, cat, grep, uname, ...
 *   • MS-DOS (COMMAND.COM)      — DIR, CLS, TYPE, VER, MEM, ...   (case-insensitive)
 *   • Windows PowerShell        — Get-ChildItem, Set-Location, ... (+ Verb-Noun fallback)
 *   • Funny / demo              — neofetch, cowsay, ascii, matrix, sl, ...
 *
 * Every command is { help, usage?, run(ctx,args,raw) }. `ctx` carries the
 * terminal writers, the shell state, the VFS, and GUI hooks.
 */
'use strict';

/* ------------------------------------------------------------------ pacman
 * A miniature of Arch Linux's pacman: a package database you can query,
 * install into, and remove from. Purely in-memory.                         */
const Pacman = (() => {
  const repo = {                                   // newest Arch versions
    firefox: '135.0', 'block-browser': '1.0', neovim: '0.10.4', git: '2.48.1',
    htop: '3.4.0', 'base-devel': '1.0', python: '3.13.2', nodejs: '23.9.0',
    cowsay: '3.7.0', fortune: '3.20', sl: '5.05', neofetch: '7.1.0',
    'block-doom': '1.9', cmatrix: '2.0', hyprland: '0.47', gimp: '2.10.38',
  };
  // Packages that ship a graphical binary → run on the Linux (Arch) kernel.
  const guiApps = new Set(['firefox', 'block-browser', 'gimp', 'neovim', 'block-doom', 'hyprland', 'htop']);
  const installed = new Map([
    ['base', '1.0'], ['linux', '6.14.2-arch1'], ['limesh', '1.0'],
    ['pacman', '7.0.0'], ['block9', '9.2.2'], ['neofetch', '7.1.0'],
    ['coreutils', '9.6'], ['dosemu-verbs', '2.0'], ['limawek', '1.0'],
  ]);
  return {
    count: () => installed.size,
    isInstalled: (n) => installed.has(n),
    list: () => [...installed.entries()],
    inRepo: (n) => n in repo,
    repoVersion: (n) => repo[n],
    isGui: (n) => guiApps.has(n),
    install(n) { if (!(n in repo)) return null; installed.set(n, repo[n]); return repo[n]; },
    remove(n) { return installed.delete(n); },
    search(q) { return Object.keys(repo).filter((k) => k.includes(q)); },
  };
})();
window.Pacman = Pacman;

const Commands = (() => {
  // ---- tiny helpers ----------------------------------------------------
  const pad = (s, n) => (s + ' '.repeat(n)).slice(0, n);
  const esc = (s) => s.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));

  function resolve(ctx, p) { return Kernel.fs.normalize(ctx.shell.cwd, p); }
  function baseName(abs) { return abs.split('/').filter(Boolean).pop() || '/'; }

  // A compact 5-row block font for `ascii`/`figlet`. '#' -> block.
  const FONT = {
    A: ['.##.', '#..#', '####', '#..#', '#..#'], B: ['###.', '#..#', '###.', '#..#', '###.'],
    C: ['.###', '#...', '#...', '#...', '.###'], D: ['###.', '#..#', '#..#', '#..#', '###.'],
    E: ['####', '#...', '###.', '#...', '####'], F: ['####', '#...', '###.', '#...', '#...'],
    G: ['.###', '#...', '#.##', '#..#', '.###'], H: ['#..#', '#..#', '####', '#..#', '#..#'],
    I: ['###', '.#.', '.#.', '.#.', '###'], J: ['..##', '...#', '...#', '#..#', '.##.'],
    K: ['#..#', '#.#.', '##..', '#.#.', '#..#'], L: ['#...', '#...', '#...', '#...', '####'],
    M: ['#...#', '##.##', '#.#.#', '#...#', '#...#'], N: ['#..#', '##.#', '#.##', '#..#', '#..#'],
    O: ['.##.', '#..#', '#..#', '#..#', '.##.'], P: ['###.', '#..#', '###.', '#...', '#...'],
    Q: ['.##.', '#..#', '#..#', '#.##', '.###'], R: ['###.', '#..#', '###.', '#.#.', '#..#'],
    S: ['.###', '#...', '.##.', '...#', '###.'], T: ['#####', '..#..', '..#..', '..#..', '..#..'],
    U: ['#..#', '#..#', '#..#', '#..#', '.##.'], V: ['#..#', '#..#', '#..#', '.##.', '.##.'],
    W: ['#...#', '#...#', '#.#.#', '##.##', '#...#'], X: ['#..#', '.##.', '.##.', '.##.', '#..#'],
    Y: ['#..#', '.##.', '..#.', '..#.', '..#.'], Z: ['####', '..#.', '.#..', '#...', '####'],
    0: ['.##.', '#.##', '##.#', '#..#', '.##.'], 1: ['.#.', '##.', '.#.', '.#.', '###'],
    2: ['###.', '...#', '.##.', '#...', '####'], 3: ['###.', '...#', '.##.', '...#', '###.'],
    4: ['#..#', '#..#', '####', '...#', '...#'], 5: ['####', '#...', '###.', '...#', '###.'],
    6: ['.###', '#...', '###.', '#..#', '.##.'], 7: ['####', '...#', '..#.', '.#..', '.#..'],
    8: ['.##.', '#..#', '.##.', '#..#', '.##.'], 9: ['.##.', '#..#', '.###', '...#', '###.'],
    ' ': ['..', '..', '..', '..', '..'], '!': ['#', '#', '#', '.', '#'],
    '?': ['###.', '...#', '.##.', '....', '.#..'], '.': ['.', '.', '.', '.', '#'],
    '-': ['....', '....', '####', '....', '....'],
  };
  function figlet(text) {
    const rows = ['', '', '', '', ''];
    for (const ch of text.toUpperCase()) {
      const g = FONT[ch] || FONT['?'];
      for (let r = 0; r < 5; r++) rows[r] += g[r].replace(/#/g, '█').replace(/\./g, ' ') + '  ';
    }
    return rows.join('\n');
  }

  function cowsay(text) {
    const line = text || 'Moo from BLOCK';
    const top = ' ' + '_'.repeat(line.length + 2);
    const bot = ' ' + '-'.repeat(line.length + 2);
    return [top, '< ' + line + ' >', bot,
      '        \\   ^__^',
      '         \\  (oo)\\_______',
      '            (__)\\       )\\/\\',
      '                ||----w |',
      '                ||     ||'].join('\n');
  }

  const FORTUNES = [
    'A block in the hand is worth two in the swap file.',
    'DOS is dead; long live DIR.',
    'To err is human; to really foul things up you need a rolling release.',
    'The lime does not fall far from the compiler.',
    'sudo make me a sandwich.  — okay.',
    'There are 10 kinds of people: those who read hex and F00D.',
  ];

  // ---- long-form help sections ----------------------------------------
  const CATS = {
    'Hybrid kernel & LIMAWEK': ['kernel', 'limawek', 'dos', 'run'],
    'File & system (modern)': ['ls', 'cd', 'pwd', 'cat', 'head', 'tail', 'wc', 'mkdir', 'touch', 'rm', 'cp', 'mv', 'tree', 'grep', 'find', 'which', 'echo', 'clear', 'uname', 'hostname', 'whoami', 'date', 'uptime', 'ps', 'kill', 'htop', 'free', 'df', 'ping', 'history', 'man', 'env', 'alias', 'edit'],
    'MS-DOS verbs (→ real-mode)': ['dir', 'cls', 'type', 'copy', 'del', 'ren', 'ver', 'mem', 'md', 'rd', 'chdir', 'time', 'prompt', 'path'],
    'PowerShell': ['get-childitem', 'get-content', 'set-location', 'get-location', 'write-host', 'get-process', 'get-date', 'get-command', 'get-help', 'clear-host', 'new-item', 'remove-item', '$psversiontable'],
    'Package manager (pacman)': ['pacman', 'apt'],
    'Internet': ['browser', 'curl', 'wget', 'ping'],
    'GUI & apps': ['apps', 'open', 'gui', 'fallback-gui', 'theme', 'wallpaper'],
    'Fun': ['neofetch', 'cowsay', 'fortune', 'ascii', 'figlet', 'matrix', 'sl', 'lolcat', 'coffee', 'sudo'],
    'Power user': ['code', 'js', 'reboot', 'shutdown', 'exit'],
  };

  // ---- which kernel personality each command's ABI needs --------------
  // DOS verbs pull the hybrid kernel into real-mode; Linux userland pulls it
  // to the Arch personality. HYBRID commands are surface tools (help, fun,
  // kernel introspection, GUI control) serviced by the hybrid layer itself —
  // they never flip the kernel, so the DOS look survives a `help` or a
  // `neofetch`. LIMAWEK reads this to arbitrate.
  const DOS_ABI = new Set(['dir', 'cls', 'type', 'copy', 'del', 'erase', 'ren', 'rename',
    'ver', 'mem', 'md', 'rd', 'rmdir', 'chdir', 'time', 'prompt', 'path', 'format']);
  const HYBRID_ABI = new Set(['help', 'man', 'get-help', 'get-command', 'commands',
    'neofetch', 'cowsay', 'fortune', 'ascii', 'figlet', 'banner', 'lolcat', 'matrix',
    'sl', 'coffee', 'sudo', 'kernel', 'lsmod', 'limawek', 'lima', 'dos', 'command.com',
    'code', 'js', 'eval', 'open', 'start', 'gui', 'browser', 'block-browser', 'firefox',
    'apps', 'launchpad', 'fallback-gui', 'fallbackgui', 'theme', 'wallpaper', 'edit',
    'htop', 'top', 'history', 'alias', 'exit', 'logout', 'quit', 'reboot', 'shutdown',
    'restart-computer', 'stop-computer', 'poweroff']);
  const abiOf = (name) => (DOS_ABI.has(name) ? 'dos' : HYBRID_ABI.has(name) ? null : 'linux');

  // ====================================================================
  //  Command table
  // ====================================================================
  const cmds = {};
  const def = (names, help, run, extra = {}) => {
    const spec = { help, run, ...extra };
    for (const n of [].concat(names)) cmds[n] = spec;
  };

  // ---------------- help / discovery -----------------------------------
  def('help', 'List commands, or `help <cmd>` for detail.', (ctx, a) => {
    if (a[0]) {
      const c = cmds[a[0].toLowerCase()];
      if (!c) return ctx.print('help: no such command: ' + a[0], 'err');
      ctx.print(a[0] + ' — ' + c.help + (c.usage ? '\n  usage: ' + c.usage : ''));
      return;
    }
    ctx.print('LIMEdit BLOCK — limesh command reference', 'accent');
    for (const [cat, list] of Object.entries(CATS)) {
      ctx.print('\n' + cat, 'accent');
      ctx.print('  ' + list.join('  '));
    }
    ctx.print('\nTips: commands are case-insensitive. limesh supports pipes, redirection,', 'dim');
    ctx.print('and chaining:   help | grep pacman     ls > listing.txt     mkdir x && cd x', 'dim');
  });
  def(['get-help', 'man'], 'Show help for a command (PowerShell/Unix style).',
    (ctx, a) => cmds.help.run(ctx, a));
  def(['get-command', 'commands'], 'List every available command.',
    (ctx) => ctx.print(Object.keys(cmds).sort().join('  ')));

  // ---------------- navigation / files ---------------------------------
  function doList(ctx, a) {
    const long = a.includes('-l') || a.includes('-la') || a.includes('-al');
    const target = a.find((x) => !x.startsWith('-')) || '.';
    const abs = resolve(ctx, target);
    const node = Kernel.fs.lookup(abs);
    if (!node) return ctx.print('ls: cannot access ' + target + ': No such file or directory', 'err');
    if (node.type === 'file') return ctx.print(baseName(abs));
    const entries = Object.entries(node.children);
    if (!entries.length) return;
    if (long) {
      for (const [name, n] of entries) {
        const kind = n.type === 'dir' ? 'd' : '-';
        const size = n.type === 'file' ? String(n.content.length) : '4096';
        const when = new Date(n.mtime).toLocaleString();
        ctx.print(`${kind}rwxr-xr-x  lime  ${pad(size, 7)} ${when}  ` +
          (n.type === 'dir' ? name + '/' : name), n.type === 'dir' ? 'dir' : '');
      }
    } else {
      const html = entries.map(([name, n]) =>
        `<span class="${n.type === 'dir' ? 'dir' : 'fileo'}">${esc(name)}${n.type === 'dir' ? '/' : ''}</span>`).join('   ');
      ctx.printHTML(html);
    }
  }
  def(['ls', 'dir', 'get-childitem', 'gci'], 'List directory contents.', doList, { usage: 'ls [-l] [path]' });

  def(['cd', 'chdir', 'set-location'], 'Change the working directory.', (ctx, a) => {
    // (real `sl` is the steam-locomotive gag, defined below — PowerShell's
    //  sl alias loses that fight.)
    const t = a[0] || '~';
    const abs = resolve(ctx, t);
    if (!Kernel.fs.isDir(abs)) return ctx.print('cd: not a directory: ' + t, 'err');
    ctx.shell.cwd = abs;
  }, { usage: 'cd <dir>' });

  def(['pwd', 'get-location', 'gl'], 'Print the working directory.', (ctx) => ctx.print(ctx.shell.cwd));

  def(['cat', 'type', 'get-content', 'gc'], 'Print file contents.', (ctx, a) => {
    if (!a[0]) return ctx.print('usage: cat <file>', 'err');
    const abs = resolve(ctx, a[0]);
    if (!Kernel.fs.isFile(abs)) return ctx.print('cat: ' + a[0] + ': No such file', 'err');
    ctx.print(Kernel.fs.read(abs).replace(/\n$/, ''));
  });

  def(['mkdir', 'md'], 'Create a directory.', (ctx, a) => {
    if (!a[0]) return ctx.print('usage: mkdir <dir>', 'err');
    try { Kernel.fs.mkdir(resolve(ctx, a[0])); } catch (e) { ctx.print('mkdir: ' + e.message, 'err'); }
  });
  def(['touch'], 'Create an empty file / update mtime.', (ctx, a) => {
    if (!a[0]) return ctx.print('usage: touch <file>', 'err');
    Kernel.fs.touch(resolve(ctx, a[0]));
  });
  def(['new-item', 'ni'], 'Create a file or directory (PowerShell).', (ctx, a) => {
    const isDir = a.join(' ').toLowerCase().includes('directory');
    const name = a.find((x) => !x.startsWith('-') && x.toLowerCase() !== 'directory' && x.toLowerCase() !== 'file');
    if (!name) return ctx.print('usage: New-Item <name> [-ItemType Directory]', 'err');
    try { isDir ? Kernel.fs.mkdir(resolve(ctx, name)) : Kernel.fs.touch(resolve(ctx, name)); }
    catch (e) { ctx.print('New-Item: ' + e.message, 'err'); }
  });

  def(['rm', 'del', 'erase', 'remove-item', 'ri'], 'Remove a file or directory.', (ctx, a) => {
    const t = a.find((x) => !x.startsWith('-'));
    if (!t) return ctx.print('usage: rm [-r] <path>', 'err');
    try { Kernel.fs.remove(resolve(ctx, t)); } catch (e) { ctx.print('rm: ' + e.message, 'err'); }
  });
  def(['rd', 'rmdir'], 'Remove a directory (DOS).', (ctx, a) => cmds.rm.run(ctx, a));

  def(['cp', 'copy', 'copy-item'], 'Copy a file.', (ctx, a) => {
    const [s, d] = a.filter((x) => !x.startsWith('-'));
    if (!s || !d) return ctx.print('usage: cp <src> <dst>', 'err');
    const src = resolve(ctx, s);
    if (!Kernel.fs.isFile(src)) return ctx.print('cp: ' + s + ': not a file', 'err');
    let dst = resolve(ctx, d);
    if (Kernel.fs.isDir(dst)) dst = dst + '/' + baseName(src);
    Kernel.fs.write(dst, Kernel.fs.read(src));
  });
  def(['mv', 'ren', 'rename', 'move', 'move-item'], 'Move / rename a file.', (ctx, a) => {
    const [s, d] = a.filter((x) => !x.startsWith('-'));
    if (!s || !d) return ctx.print('usage: mv <src> <dst>', 'err');
    const src = resolve(ctx, s);
    if (!Kernel.fs.isFile(src)) return ctx.print('mv: ' + s + ': not a file', 'err');
    Kernel.fs.write(resolve(ctx, d), Kernel.fs.read(src));
    Kernel.fs.remove(src);
  });

  def('tree', 'Draw the directory tree.', (ctx, a) => {
    const start = resolve(ctx, a[0] || '.');
    if (!Kernel.fs.isDir(start)) return ctx.print('tree: not a directory', 'err');
    const out = [start === '/' ? '/' : baseName(start)];
    (function walk(abs, prefix) {
      const kids = Object.entries(Kernel.fs.list(abs));
      kids.forEach(([name, n], i) => {
        const last = i === kids.length - 1;
        out.push(prefix + (last ? '└── ' : '├── ') + name + (n.type === 'dir' ? '/' : ''));
        if (n.type === 'dir') walk(abs + '/' + name, prefix + (last ? '    ' : '│   '));
      });
    })(start, '');
    ctx.print(out.join('\n'));
  });

  def(['grep', 'select-string'], 'Search file contents for a pattern (also a pipe filter).', (ctx, a) => {
    if (a.length < 2) return ctx.print('usage: grep <pattern> <file>    (or:  <cmd> | grep <pattern>)', 'err');
    const [pat, f] = a;
    const abs = resolve(ctx, f);
    if (!Kernel.fs.isFile(abs)) return ctx.print('grep: ' + f + ': No such file', 'err');
    let re, reMark;
    try { re = new RegExp(pat, 'i'); reMark = new RegExp('(' + pat + ')', 'ig'); }
    catch (_) { return ctx.print('grep: invalid pattern: ' + pat, 'err'); }
    Kernel.fs.read(abs).split('\n').forEach((ln) => {
      if (re.test(ln)) ctx.printHTML(esc(ln).replace(reMark, '<mark>$1</mark>'));
    });
  });
  def('find', 'Recursively list paths under a directory.', (ctx, a) => {
    const start = resolve(ctx, a[0] || '.');
    (function walk(abs) {
      ctx.print(abs);
      if (Kernel.fs.isDir(abs)) for (const name of Object.keys(Kernel.fs.list(abs))) walk(abs + '/' + name);
    })(start);
  });

  function readLines(ctx, f) {
    const abs = resolve(ctx, f);
    if (!Kernel.fs.isFile(abs)) { ctx.print(f + ': No such file', 'err'); return null; }
    return Kernel.fs.read(abs).replace(/\n$/, '').split('\n');
  }
  def('head', 'Print the first lines of a file (also a pipe filter).', (ctx, a) => {
    const n = a.includes('-n') ? Number(a[a.indexOf('-n') + 1]) || 10 : 10;
    const f = a.filter((x) => x !== '-n' && !/^\d+$/.test(x))[0];
    if (!f) return ctx.print('usage: head [-n N] <file>', 'err');
    const lines = readLines(ctx, f); if (lines) lines.slice(0, n).forEach((l) => ctx.print(l));
  });
  def('tail', 'Print the last lines of a file (also a pipe filter).', (ctx, a) => {
    const n = a.includes('-n') ? Number(a[a.indexOf('-n') + 1]) || 10 : 10;
    const f = a.filter((x) => x !== '-n' && !/^\d+$/.test(x))[0];
    if (!f) return ctx.print('usage: tail [-n N] <file>', 'err');
    const lines = readLines(ctx, f); if (lines) lines.slice(-n).forEach((l) => ctx.print(l));
  });
  def('wc', 'Count lines, words, chars of a file (also a pipe filter).', (ctx, a) => {
    const f = a.filter((x) => !x.startsWith('-'))[0];
    if (!f) return ctx.print('usage: wc <file>', 'err');
    const lines = readLines(ctx, f); if (!lines) return;
    const text = lines.join('\n');
    const words = text.trim() ? text.trim().split(/\s+/).length : 0;
    ctx.print(`      ${lines.length}      ${words}      ${text.length}  ${f}`);
  });
  def('which', 'Locate a command.', (ctx, a) => {
    const n = (a[0] || '').toLowerCase();
    if (!n) return ctx.print('usage: which <command>', 'err');
    ctx.print(cmds[n] ? '/usr/bin/' + n : 'which: no ' + n + ' in (/bin:/usr/bin)', cmds[n] ? '' : 'err');
  });
  def('hostname', 'Print the host name.', (ctx) => ctx.print(Kernel.system.host));
  def('ping', 'Ping a host (pretend network).', (ctx, a) => {
    const host = a.find((x) => !x.startsWith('-')) || 'block.net';
    ctx.print('PING ' + host + ' (10.0.0.9) 56(84) bytes of data.');
    let total = 0;
    for (let i = 1; i <= 4; i++) { const ms = +(8 + Math.random() * 20).toFixed(1); total += ms; ctx.print('64 bytes from ' + host + ': icmp_seq=' + i + ' ttl=64 time=' + ms + ' ms'); }
    ctx.print('\n--- ' + host + ' ping statistics ---\n4 packets transmitted, 4 received, 0% packet loss, avg ' + (total / 4).toFixed(1) + ' ms');
  });
  def(['curl', 'wget', 'invoke-webrequest', 'iwr'], 'Fetch a real URL from the internet.', (ctx, a) => {
    let url = a.find((x) => !x.startsWith('-'));
    if (!url) return ctx.print('usage: curl <url>', 'err');
    if (!/^https?:\/\//i.test(url)) url = 'https://' + url;
    ctx.print('curl: fetching ' + url + ' …', 'dim');
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), 8000);
    fetch(url, { signal: ctl.signal }).then(async (res) => {
      clearTimeout(t);
      ctx.print('HTTP ' + res.status + ' ' + res.statusText + '   ' + (res.headers.get('content-type') || ''), 'accent');
      const text = await res.text();
      ctx.print(text.length > 2000 ? text.slice(0, 2000) + '\n… [' + text.length + ' bytes total, truncated]' : text);
    }).catch((e) => {
      clearTimeout(t);
      ctx.print('curl: ' + (e.name === 'AbortError' ? 'timed out' : e.message), 'err');
      ctx.print('  (many sites block cross-origin fetches — try `open browser` and load it there)', 'dim');
    });
  }, { usage: 'curl <url>     e.g.  curl example.com' });

  def(['htop', 'top'], 'Open the process viewer (Activity Monitor).', (ctx) => {
    ctx.gui.openApp('monitor');
    ctx.print('htop: opened Activity Monitor (BlockWM window).', 'dim');
  });
  def('edit', 'Open a file in the BLOCK Editor.', (ctx, a) => {
    if (!a[0]) return ctx.print('usage: edit <file>', 'err');
    const abs = resolve(ctx, a[0]);
    ctx.gui.openApp('editor', { path: abs });
    ctx.print('editing ' + abs, 'dim');
  });

  def(['echo', 'write-host', 'write-output', 'print'], 'Print text.', (ctx, a, raw) => {
    ctx.print(raw.replace(/^\S+\s*/, ''));
  });

  def(['clear', 'cls', 'clear-host'], 'Clear the terminal.', (ctx) => ctx.clear());

  // ---------------- system info ----------------------------------------
  def(['uname', 'get-host'], 'Print system information.', (ctx, a) => {
    const s = Kernel.system;
    if (a.includes('-a')) ctx.print(`${s.name} ${s.host} ${s.kernel} ${s.arch} archdos/BLOCK`);
    else ctx.print(s.name);
  });
  def(['whoami'], 'Print the current user.', (ctx) => ctx.print(Kernel.system.user));
  def(['ver'], 'Print the OS version (DOS).', (ctx) => {
    // DOS VER prints the real-mode personality banner.
    const p = Kernel.personalities.dos;
    ctx.print('\nMS-DOS Version ' + p.version + '  (LIMEdit BLOCK real-mode personality)\n' +
              'Hybrid kernel archdos-hybrid 1.0 — arbitrated by LIMAWEK\n');
  });
  def(['date', 'time', 'get-date'], 'Print the date and time.', (ctx) => ctx.print(new Date().toString()));
  def('uptime', 'Show how long the system has been up.', (ctx) =>
    ctx.print(' up ' + Kernel.uptime() + ',  1 user,  load average: 0.09, 0.12, 0.07'));

  def(['ps', 'get-process', 'gps'], 'List running processes.', (ctx) => {
    ctx.print('  PID  %CPU   MEM  ABI     COMMAND');
    for (const p of Kernel.processes)
      ctx.print(pad(String(p.pid), 5) + pad(p.cpu.toFixed(1), 6) + pad(p.mem + 'M', 6) + pad(p.abi || 'linux', 8) + p.name);
  });
  def(['kill', 'stop-process'], 'Kill a process by PID.', (ctx, a) => {
    const pid = Number(a.find((x) => /^\d+$/.test(x)));
    if (!pid) return ctx.print('usage: kill <pid>', 'err');
    const ok = Kernel.kill(pid);
    ctx.print(ok ? 'killed ' + pid : 'kill: no such process: ' + pid, ok ? '' : 'err');
  });
  def(['free', 'mem'], 'Show memory usage.', (ctx) => {
    const used = Kernel.memUsedMb(), tot = Kernel.system.memTotalMb;
    ctx.print('               total        used        free');
    ctx.print('Mem:     ' + pad(tot + 'M', 12) + pad(used + 'M', 12) + (tot - used) + 'M');
    ctx.print('\n  ' + (tot - used) + ' MB free of ' + tot + ' MB — plenty of blocks.');
  });
  def('df', 'Show disk space (virtual).', (ctx) => {
    ctx.print('Filesystem     Size  Used Avail Use%  Mounted on');
    ctx.print('blockfs        256G   38G  218G  15%  /');
  });

  // ---------------- shell environment ----------------------------------
  def(['history'], 'Show command history.', (ctx) =>
    ctx.shell.history.forEach((h, i) => ctx.print(pad(String(i + 1), 5) + '  ' + h)));
  def(['env', 'set', 'get-variable'], 'Show environment variables.', (ctx) => {
    for (const [k, v] of Object.entries(ctx.shell.env)) ctx.print(k + '=' + v);
  });
  def('alias', 'Show or set aliases.', (ctx, a, raw) => {
    if (!a.length) return Object.entries(ctx.shell.aliases).forEach(([k, v]) => ctx.print('alias ' + k + "='" + v + "'"));
    const m = raw.replace(/^alias\s+/, '').match(/^(\w+)=["']?(.+?)["']?$/);
    if (m) ctx.shell.aliases[m[1]] = m[2];
  });
  def(['prompt', 'path'], 'DOS PROMPT/PATH stubs.', (ctx, a, raw) =>
    ctx.print(raw.toLowerCase().startsWith('path') ? 'PATH=/bin;/usr/bin;/home/lime/bin' : 'PROMPT set (cosmetic).', 'dim'));
  def('$psversiontable', 'Show the PowerShell version table.', (ctx) => {
    ctx.print('Name                           Value');
    ctx.print('----                           -----');
    ctx.print('PSVersion                      7.4.0-BLOCK');
    ctx.print('PSEdition                      Core (archdos)');
    ctx.print('OS                             LIMEdit BLOCK 1.0.0');
  });

  // ---------------- package manager ------------------------------------
  def(['pacman'], 'Arch package manager.', (ctx, a) => {
    const flags = a.filter((x) => x.startsWith('-')).join('').replace(/-/g, '');
    const names = a.filter((x) => !x.startsWith('-'));
    if (/Syu|Syyu|Su/.test(flags) || (flags.includes('S') && flags.includes('y') && !names.length)) {
      ctx.print(':: Synchronizing package databases...');
      ['core', 'extra', 'community', 'block'].forEach((r) => ctx.print(' ' + r + '                 up to date'));
      ctx.print(':: Starting full system upgrade...\n there is nothing to do — BLOCK is bleeding-edge.', 'accent');
      return;
    }
    if (flags.includes('S')) {   // install
      if (!names.length) return ctx.print('error: no targets specified', 'err');
      for (const n of names) {
        if (!Pacman.inRepo(n)) { ctx.print('error: target not found: ' + n, 'err'); continue; }
        if (Pacman.isInstalled(n)) { ctx.print(' ' + n + ' is up to date — reinstalling.', 'dim'); }
        ctx.print('resolving dependencies...');
        ctx.print('(1/1) installing ' + n + '  [' + '#'.repeat(20) + '] 100%');
        const v = Pacman.install(n);
        const hint = Pacman.isGui(n) ? 'Run `run ' + n + '` — LIMAWEK will service it on the Linux (Arch) kernel.'
                                     : 'Installed into the Arch userland.';
        ctx.print(':: ' + n + '-' + v + ' installed. ' + hint, 'accent');
      }
      return;
    }
    if (flags.includes('R')) {   // remove
      for (const n of names) {
        const ok = Pacman.remove(n);
        ctx.print(ok ? 'removed ' + n : 'error: target not found: ' + n, ok ? '' : 'err');
      }
      return;
    }
    if (flags.includes('Q')) {   // query
      if (names.length) return names.forEach((n) => ctx.print(Pacman.isInstalled(n) ? n + ' ' + Pacman.list().find((e) => e[0] === n)[1] : 'error: package "' + n + '" was not found', Pacman.isInstalled(n) ? '' : 'err'));
      return Pacman.list().forEach(([n, v]) => ctx.print(n + ' ' + v));
    }
    if (flags.includes('s') || flags.includes('Ss')) {   // search
      const hits = Pacman.search(names[0] || '');
      if (!hits.length) return ctx.print('no results.', 'dim');
      return hits.forEach((h) => ctx.print('block/' + h + ' ' + Pacman.repoVersion(h) + (Pacman.isInstalled(h) ? '  [installed]' : ''), 'accent'));
    }
    ctx.print('usage: pacman -S|-R|-Q|-Ss|-Syu <pkg>', 'dim');
  }, { usage: 'pacman -S <pkg> | -R <pkg> | -Q | -Ss <term> | -Syu' });
  def('apt', 'Debian-style front-end (routes to pacman).', (ctx, a) => {
    ctx.print('Note: BLOCK is Arch-based. Translating to pacman…', 'dim');
    const verb = a[0];
    if (verb === 'install') cmds.pacman.run(ctx, ['-S', ...a.slice(1)]);
    else if (verb === 'remove') cmds.pacman.run(ctx, ['-R', ...a.slice(1)]);
    else if (verb === 'update' || verb === 'upgrade') cmds.pacman.run(ctx, ['-Syu']);
    else if (verb === 'search') cmds.pacman.run(ctx, ['-Ss', ...a.slice(1)]);
    else ctx.print('usage: apt install|remove|update|search <pkg>', 'dim');
  });

  // ---------------- hybrid kernel & LIMAWEK ----------------------------
  def(['kernel', 'lsmod'], 'Inspect the hybrid kernel.', (ctx) => {
    const p = Kernel.LIMAWEK.personality();
    ctx.print('LIMEdit BLOCK — hybrid kernel  (archdos-hybrid 1.0)', 'accent');
    ctx.print('  active personality : ' + p.name + '  ' + p.version + '  [' + p.cpu + ']');
    ctx.print('  source             : ' + p.src);
    ctx.print('  role               : ' + p.note);
    ctx.print('');
    ctx.print('  Personalities managed by LIMAWEK:', 'accent');
    for (const key of ['dos', 'linux']) {
      const pp = Kernel.personalities[key];
      const on = Kernel.LIMAWEK.mode() === key ? '● live' : '○     ';
      ctx.print('   ' + on + '  ' + pad(pp.name, 20) + pp.version + '   — ' + pp.src);
    }
    ctx.print('\n  A DOS verb (DIR, TYPE, VER…) pulls the kernel to real-mode;', 'dim');
    ctx.print('  a Linux app or verb pulls it to the Arch kernel. `limawek log` shows switches.', 'dim');
  });
  def(['limawek', 'lima'], 'The kernel arbiter — status/log/mode control.', (ctx, a) => {
    const sub = (a[0] || 'status').toLowerCase();
    if (sub === 'status') { ctx.print(Kernel.LIMAWEK.status(), 'accent'); return; }
    if (sub === 'log') {
      const log = Kernel.LIMAWEK.log();
      if (!log.length) return ctx.print('limawek: no kernel transitions yet — run a DOS verb then a Linux one.', 'dim');
      log.forEach((e, i) => ctx.print(pad('#' + (i + 1), 5) + e.from + ' → ' + e.to + '   (' + e.workload + ')'));
      return;
    }
    if (sub === 'mode') {
      const m = (a[1] || '').toLowerCase();
      if (m !== 'dos' && m !== 'linux') return ctx.print('usage: limawek mode <dos|linux>', 'err');
      const line = Kernel.LIMAWEK.require(m, 'limawek');
      ctx.print(line || ('already on ' + m + ' personality.'), 'kmsg');
      return;
    }
    ctx.print('usage: limawek [status|log|mode <dos|linux>]', 'dim');
  }, { usage: 'limawek status | log | mode <dos|linux>' });
  def(['run', 'exec', 'launch'], 'Run a third-party Linux application on the Arch kernel.', (ctx, a) => {
    const app = (a[0] || '').toLowerCase();
    if (!app) return ctx.print('usage: run <installed-app>   e.g.  run firefox', 'err');
    if (!Pacman.isInstalled(app)) {
      ctx.print('run: ' + app + ': not installed. Try `pacman -S ' + app + '`.', 'err');
      return;
    }
    // Third-party apps require the Linux kernel — LIMAWEK loads it.
    const line = Kernel.LIMAWEK.require('linux', app);
    if (line) ctx.print(line, 'kmsg');
    ctx.print('kernel: loading ELF binary /usr/bin/' + app + ' against linux ' + Kernel.personalities.linux.version + ' …', 'dim');
    const proc = Kernel.spawn(app, 40 + Math.floor(Math.random() * 60), 'linux');
    ctx.print('[' + proc.pid + '] ' + app + ' running on the Linux (Arch) kernel.', 'accent');
    // Give it a window if it maps to a known GUI app.
    const winApp = ({ firefox: 'browser', 'block-browser': 'browser', gimp: 'editor', neovim: 'editor', htop: 'monitor', 'block-doom': 'about' })[app];
    if (Pacman.isGui(app)) ctx.gui.openApp(winApp || 'about', { procName: app, pid: proc.pid });
  }, { usage: 'run <app>   (installed third-party Linux app)' });
  def(['dos', 'command.com'], 'Drop into an immersive MS-DOS real-mode session.', (ctx) => {
    const line = Kernel.LIMAWEK.lock('dos', 'command.com');
    if (line) ctx.print(line, 'kmsg');
    ctx.gui.setDosMode(true);
    ctx.print('');
    ctx.print('Starting MS-DOS...', 'accent');
    ctx.print('');
    ctx.print('MS-DOS Version ' + Kernel.personalities.dos.version + '  (LIMEdit BLOCK real-mode personality)');
    ctx.print('(C) LIMEdit BLOCK. Modelled on microsoft/MS-DOS (MIT).');
    ctx.print('');
    ctx.print('LIMAWEK is LOCKED to real-mode. Type EXIT to return to the hybrid shell.', 'dim');
  });
  def(['exit', 'logout', 'quit'], 'Leave DOS mode, or close this terminal window.', (ctx) => {
    if (Kernel.LIMAWEK.isLocked()) {
      const line = Kernel.LIMAWEK.unlock('limesh');
      ctx.gui.setDosMode(false);
      ctx.print('Returning to the hybrid limesh…', 'accent');
      if (line) ctx.print(line, 'kmsg');
      return;
    }
    ctx.gui.closeActiveTerminal();
  });

  // ---------------- GUI & apps -----------------------------------------
  def(['apps', 'launchpad'], 'List / show installable GUI apps.', (ctx) => {
    ctx.print('Applications (launch with `open <name>`):', 'accent');
    ctx.print('  browser   files   about   editor   settings   monitor');
    ctx.print('\nSome apps need the richer GUI. Unlock it with `fallback-gui ~allow`.', 'dim');
  });
  def(['open', 'start', 'start-process', 'gui'], 'Open a GUI application in a window.', (ctx, a) => {
    const app = (a[0] || '').toLowerCase();
    if (!app) return ctx.print('usage: open <browser|files|about|editor|settings|monitor>', 'err');
    const ok = ctx.gui.openApp(app);
    if (!ok) ctx.print('open: unknown app: ' + app, 'err');
  });
  def(['browser', 'block-browser', 'firefox'], 'Open the BLOCK web browser.', (ctx) => ctx.gui.openApp('browser'));
  def(['theme'], 'Switch light/dark theme.', (ctx, a) => {
    const t = a[0] || (document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark');
    if (t === 'dark') document.documentElement.dataset.theme = 'dark';
    else delete document.documentElement.dataset.theme;
    try { localStorage.setItem('block.theme', t); } catch (_) {}
    ctx.print('theme → ' + t);
  });
  def('wallpaper', 'Set or cycle the desktop wallpaper.', (ctx, a) => {
    const now = ctx.gui.cycleWallpaper(a[0]);
    ctx.print('wallpaper → ' + now + '   (options: ' + ctx.gui.wallpapers().join(', ') + ')');
  }, { usage: 'wallpaper [lime|platinum|dusk|noir]' });

  def(['fallback-gui', 'fallbackgui'], 'Enable/disable the richer fallback GUI.', (ctx, a) => {
    const arg = (a[0] || '').replace(/^~?/, '');
    if (arg === 'allow' || arg === 'enable' || arg === 'on') {
      ctx.gui.setFallback(true);
      ctx.print('fallback-GUI: ALLOWED. Detailed apps (browser, editor) now render full chrome.', 'accent');
    } else if (arg === 'disable' || arg === 'deny' || arg === 'off') {
      ctx.gui.setFallback(false);
      ctx.print('fallback-GUI: DISABLED. Apps fall back to lightweight, shell-first windows.', 'accent');
    } else {
      ctx.print('fallback-GUI is currently: ' + (ctx.gui.fallback() ? 'ALLOWED' : 'disabled'));
      ctx.print('usage: fallback-gui ~allow    |    fallback-gui ~disable', 'dim');
    }
  }, { usage: 'fallback-gui ~allow | ~disable' });

  // ---------------- fun -------------------------------------------------
  def('neofetch', 'Animated system banner.', (ctx) => {
    const n = Neofetch.render();
    ctx.printEl(n.el);
    ctx.registerAnim(n.stop);
  });
  def('cowsay', 'A cow says your text.', (ctx, a, raw) => ctx.print(cowsay(raw.replace(/^cowsay\s*/i, ''))));
  def('fortune', 'Print a random fortune.', (ctx) => ctx.print(FORTUNES[Math.floor(Math.random() * FORTUNES.length)]));
  def(['ascii', 'figlet', 'banner'], 'Render big ASCII text.', (ctx, a, raw) => {
    const text = raw.replace(/^\S+\s*/, '') || 'BLOCK';
    const el = document.createElement('pre'); el.className = 'lolcat'; el.textContent = figlet(text);
    ctx.printEl(el); ctx.registerAnim(Commands.lolcatAnimate(el));
  });
  def('lolcat', 'Rainbow-colour text.', (ctx, a, raw) => {
    const el = document.createElement('pre'); el.className = 'lolcat';
    el.textContent = raw.replace(/^lolcat\s*/i, '') || 'taste the rainbow, block by block';
    ctx.printEl(el); ctx.registerAnim(Commands.lolcatAnimate(el));
  });
  def('sl', 'A steam locomotive chugs by. (You typed it wrong on purpose.)', (ctx) => {
    ctx.print(['      ====        ________                ___________',
      '  _D _|  |_______/        \\__I_I_____===__|_________|',
      '   |(_)---  |   H\\________/ |   |        =|___ ___|   ',
      '   /     |  |   H  |  |     |   |         ||_| |_||   ',
      '  |      |  |   H  |__--------------------| [___] |   ',
      '  | ________|___H__/__|_____/[][]~\\_______|       |   ',
      '  |/ |   |-----------I_____I [][] []  D   |=======|__ '].join('\n'), 'accent');
  });
  def('matrix', 'Enter the matrix (5s).', (ctx) => {
    const el = document.createElement('pre'); el.className = 'matrix'; ctx.printEl(el);
    const cols = 60, glyph = () => 'ﾊﾐﾋｰｳｼﾅﾓﾆｻﾜｿﾀ01'.charAt(Math.floor(Math.random() * 15));
    let n = 0;
    const id = setInterval(() => {
      let s = ''; for (let r = 0; r < 8; r++) { for (let c = 0; c < cols; c++) s += Math.random() > 0.75 ? glyph() : ' '; s += '\n'; }
      el.textContent = s; if (++n > 60) { clearInterval(id); el.textContent += '\n[decoded: there is no spoon — only blocks]'; }
    }, 80);
    ctx.registerAnim(() => clearInterval(id));
  });
  def('coffee', 'Brew a coffee.', (ctx) => ctx.print('      ( (\n       ) )\n    ........\n    |      |]\n    \\      /\n     `----´\n  ☕ HTCPCP 418: BLOCK is a teapot, but here is coffee anyway.'));
  def('sudo', 'Superuser do — with attitude.', (ctx, a, raw) => {
    const rest = raw.replace(/^sudo\s*/i, '');
    if (/sandwich/i.test(rest)) return ctx.print('Okay. 🥪', 'accent');
    if (!rest) return ctx.print('usage: sudo <command>', 'dim');
    ctx.print('[sudo] password for lime: ********', 'dim');
    ctx.print('lime is in the sudoers file. This incident will NOT be reported. Proceeding…', 'accent');
    Shell.run(rest, ctx);   // actually run it as root-ish
  });

  // ---------------- live code ------------------------------------------
  def(['code', 'js', 'eval'], 'Run JavaScript live inside the shell.', (ctx, a, raw) => {
    const src = raw.replace(/^\S+\s*/, '');
    if (!src) return ctx.print('usage: code <javascript>   — has: shell, fs, sys, gui, print(x)', 'dim');
    const api = {
      shell: ctx.shell, fs: Kernel.fs, sys: Kernel.system, gui: ctx.gui,
      print: (x) => ctx.print(typeof x === 'object' ? JSON.stringify(x, null, 2) : String(x)),
      Kernel,
    };
    try {
      const fn = new Function(...Object.keys(api), '"use strict";return (' + src + ')');
      let out;
      try { out = fn(...Object.values(api)); }
      catch (_) { // not an expression? run as statements
        out = new Function(...Object.keys(api), '"use strict";' + src)(...Object.values(api));
      }
      if (out !== undefined) ctx.print(typeof out === 'object' ? JSON.stringify(out, null, 2) : String(out), 'accent');
    } catch (e) { ctx.print('⚠ ' + e.message, 'err'); }
  }, { usage: 'code <js>   e.g.  code sys.version   |   code print(2+2)' });

  // ---------------- power ----------------------------------------------
  def(['reboot', 'restart-computer'], 'Reboot the system.', (ctx) => { ctx.print('Rebooting BLOCK…'); setTimeout(() => location.reload(), 700); });
  def(['shutdown', 'stop-computer', 'poweroff'], 'Shut the system down.', (ctx) => {
    ctx.print('It is now safe to turn off your BLOCK. 🟩');
    document.body.classList.add('poweroff');
  });
  // (exit is defined in the hybrid-kernel section so it can leave DOS mode.)

  // ---------------- format (DOS gag, guarded) --------------------------
  def('format', 'Format a drive (DOS) — refuses, wisely.', (ctx) =>
    ctx.print('FORMAT: refusing to nuke blockfs. This is a nice place; let us keep it.', 'err'));

  return {
    table: cmds,
    abi: abiOf,
    lolcatAnimate(el) {
      const text = el.textContent; el.textContent = '';
      const spans = [...text].map((ch) => { const s = document.createElement('span'); s.textContent = ch; el.appendChild(s); return s; });
      let t = 0, running = true;
      (function f() {
        if (!running) return; t += 0.08;
        spans.forEach((s, i) => { if (s.textContent.trim()) s.style.color = `hsl(${(t * 40 + i * 6) % 360},80%,60%)`; });
        requestAnimationFrame(f);
      })();
      return () => { running = false; };
    },
  };
})();
window.Commands = Commands;
