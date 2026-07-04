/*
 * LIMEdit BLOCK — kernel.js
 * A tiny in-memory operating environment: a virtual file system, a process
 * table, and system metadata. This is a faithful *emulation* modelled on two
 * real, officially open-sourced code bases:
 *
 *   • Arch Linux            — the pacman package model, FHS layout (/usr, /etc,
 *                             /home), and userland command semantics.
 *   • MS-DOS (microsoft/MS-DOS, MIT) — the classic COMMAND.COM verbs
 *                             (DIR, CLS, TYPE, VER…) and 8.3-era feel.
 *
 * The BLOCK kernel welds the two into one modern shell surface. No real disk
 * is touched; everything lives in memory so it is safe to run anywhere.
 */
'use strict';

const Kernel = (() => {
  const BOOT_TIME = Date.now();

  const system = {
    name: 'LIMEdit BLOCK',
    codename: 'Sour Brick',
    version: '1.0.0',
    kernel: 'archdos 6.9.0-BLOCK',   // arch userland ⊕ dos verbs
    arch: 'x86_64',
    shell: 'limesh 1.0',
    de: 'Block9 (System 9.2.2-style)',
    wm: 'BlockWM',
    host: 'limebox',
    user: 'lime',
    cpu: 'Citrus C9 @ 3.60GHz (8 cores)',
    gpu: 'BlockGL Pulse',
    memTotalMb: 16384,
    packages: 0,        // filled in once pacman db is seeded
  };

  // -------------------------------------------------------------- VFS
  // Node = { type:'dir'|'file', children?:{}, content?:string, mtime }
  function dir(children = {}) { return { type: 'dir', children, mtime: Date.now() }; }
  function file(content = '') { return { type: 'file', content, mtime: Date.now() }; }

  const root = dir({
    bin: dir(),
    etc: dir({
      'os-release': file(
        'NAME="LIMEdit BLOCK"\nID=limeblock\nID_LIKE="arch dos"\n' +
        'VERSION="1.0.0 (Sour Brick)"\nPRETTY_NAME="LIMEdit BLOCK 1.0.0"\n' +
        'HOME_URL="lime://welcome"\n'),
      'motd': file('Welcome to LIMEdit BLOCK — the GUI is the shell.\n' +
                   'Type `help` for commands, `neofetch` to show off, `apps` for the GUI.\n'),
    }),
    usr: dir({ bin: dir(), share: dir({ doc: dir() }) }),
    var: dir({ log: dir({ 'boot.log': file('kernel: archdos hybrid online\n') }) }),
    home: dir({
      lime: dir({
        'readme.txt': file(
          'LIMEdit BLOCK\n=============\n\n' +
          'This is your home directory. The whole desktop is really just a shell\n' +
          'with a System-9-style menu bar on top. Try:\n\n' +
          '  neofetch          animated system banner\n' +
          '  pacman -Syu       update the (pretend) world\n' +
          '  open browser      launch the detailed fallback GUI\n' +
          '  fallback-gui ~allow    unlock the richer GUI apps\n' +
          '  code 2 + 2        run live code inside the shell\n'),
        Documents: dir({
          'hello.md': file('# Hello from BLOCK\n\nEverything here is in-memory.\n'),
        }),
        Downloads: dir(),
        '.limerc': file('# limesh startup\nalias ll="ls -l"\nPROMPT="lime@limebox"\n'),
      }),
    }),
  });

  // -------------------------------------------------------- path helpers
  function normalize(cwd, p) {
    if (!p) return cwd;
    p = String(p).replace(/\\/g, '/');           // accept DOS backslashes
    let parts;
    if (p.startsWith('/')) parts = p.split('/');
    else if (p === '~' || p.startsWith('~/')) parts = ('/home/lime/' + p.slice(2)).split('/');
    else parts = (cwd + '/' + p).split('/');
    const out = [];
    for (const seg of parts) {
      if (seg === '' || seg === '.') continue;
      if (seg === '..') out.pop();
      else out.push(seg);
    }
    return '/' + out.join('/');
  }

  function lookup(abs) {
    if (abs === '/') return root;
    const parts = abs.split('/').filter(Boolean);
    let node = root;
    for (const seg of parts) {
      if (node.type !== 'dir' || !node.children[seg]) return null;
      node = node.children[seg];
    }
    return node;
  }

  function parentOf(abs) {
    const i = abs.lastIndexOf('/');
    const parent = i <= 0 ? '/' : abs.slice(0, i);
    return { parent: lookup(parent), name: abs.slice(i + 1), parentPath: parent };
  }

  const fs = {
    normalize, lookup,
    isDir: (abs) => { const n = lookup(abs); return !!n && n.type === 'dir'; },
    isFile: (abs) => { const n = lookup(abs); return !!n && n.type === 'file'; },
    read(abs) { const n = lookup(abs); if (!n || n.type !== 'file') throw new Error('not a file: ' + abs); return n.content; },
    list(abs) { const n = lookup(abs); if (!n || n.type !== 'dir') throw new Error('not a directory: ' + abs); return n.children; },
    write(abs, content) {
      const { parent, name } = parentOf(abs);
      if (!parent || parent.type !== 'dir') throw new Error('no such directory');
      if (parent.children[name] && parent.children[name].type === 'dir') throw new Error('is a directory');
      parent.children[name] = file(content);
    },
    mkdir(abs) {
      const { parent, name } = parentOf(abs);
      if (!parent || parent.type !== 'dir') throw new Error('no such directory');
      if (parent.children[name]) throw new Error('already exists');
      parent.children[name] = dir();
    },
    remove(abs) {
      const { parent, name } = parentOf(abs);
      if (!parent || !parent.children[name]) throw new Error('no such file or directory: ' + abs);
      delete parent.children[name];
    },
    touch(abs) {
      const n = lookup(abs);
      if (n) { n.mtime = Date.now(); return; }
      fs.write(abs, '');
    },
  };

  // ---------------------------------------------------------- processes
  let nextPid = 100;
  const processes = [
    { pid: 1, name: 'kernel', cpu: 0.0, mem: 42 },
    { pid: 8, name: 'blockwm', cpu: 1.2, mem: 88 },
    { pid: 9, name: 'limesh', cpu: 0.4, mem: 24 },
  ];
  function spawn(name, mem = 30) {
    const p = { pid: nextPid++, name, cpu: +(Math.random() * 3).toFixed(1), mem };
    processes.push(p);
    return p;
  }
  function kill(pid) {
    const i = processes.findIndex((p) => p.pid === pid);
    if (i === -1) return false;
    processes.splice(i, 1);
    return true;
  }

  // ------------------------------------------------------------ misc
  function uptime() {
    const s = Math.floor((Date.now() - BOOT_TIME) / 1000);
    const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
    return (h ? h + 'h ' : '') + (m ? m + 'm ' : '') + sec + 's';
  }
  function memUsedMb() {
    return processes.reduce((a, p) => a + p.mem, 0) + 1800; // + base
  }

  return { system, fs, processes, spawn, kill, uptime, memUsedMb, BOOT_TIME };
})();
