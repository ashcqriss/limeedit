/*
 * LIMEdit BLOCK — kernel.js
 * The hybrid kernel and its supervisor, LIMAWEK.
 *
 * LIMEdit BLOCK does not run one kernel — it runs two *personalities* welded
 * behind a single hybrid kernel, and arbitrates between them at runtime:
 *
 *   • DOS real-mode        — the 16-bit COMMAND.COM world, modelled on the
 *                            officially open-sourced microsoft/MS-DOS.
 *   • Linux (Arch)         — a 64-bit protected-mode kernel that services
 *                            modern userland *and every third-party Linux
 *                            application*, modelled on Arch Linux (newest).
 *
 * LIMAWEK — the LIMe Adaptive Workload Arbitration & Execution Kernel-manager —
 * watches each workload, decides which personality's ABI it needs, and hot-
 * switches the kernel there, logging every transition. A DOS verb pulls the
 * kernel into real-mode; a Linux app pulls it into the Arch kernel. That is the
 * "changes where it needs to (application » Linux kernel if needed)" behaviour.
 *
 * Everything is in-memory; no real disk or CPU mode is touched.
 */
'use strict';

const Kernel = (() => {
  const BOOT_TIME = Date.now();

  // The two kernel personalities the hybrid kernel can present.
  const personalities = {
    linux: {
      id: 'linux',
      name: 'Linux (Arch)',
      version: '6.14.2-arch1',          // newest Arch rolling kernel
      cpu: 'protected-mode · 64-bit',
      prompt: 'arch',
      src: 'archlinux.org (rolling)',
      note: 'services modern userland + third-party Linux applications',
    },
    dos: {
      id: 'dos',
      name: 'MS-DOS real-mode',
      version: '6.22-compat',           // the familiar retail look…
      cpu: 'real-mode · 16-bit',
      prompt: 'dos',
      src: 'microsoft/MS-DOS (v1.25 / 2.0 / 4.0, MIT)',
      note: 'COMMAND.COM verbs, 8.3 names, drive letters',
    },
  };

  const system = {
    name: 'LIMEdit BLOCK',
    codename: 'Sour Brick',
    version: '1.0.0',
    kernel: 'archdos-hybrid 1.0',
    arch: 'x86_64',
    shell: 'limesh 1.0',
    de: 'Block9 (System 9.2.2-style)',
    wm: 'BlockWM (always-on)',
    host: 'limebox',
    user: 'lime',
    cpu: 'Citrus C9 @ 3.60GHz (8 cores)',
    gpu: 'BlockGL Pulse',
    memTotalMb: 16384,
    packages: 0,
  };

  // ------------------------------------------------------------ LIMAWEK
  let currentMode = 'linux';     // the hybrid boots on the Arch personality
  let locked = false;            // `dos` immersive mode locks the arbiter
  const klog = [];               // kernel transition log
  const listeners = [];

  const LIMAWEK = {
    fullName: 'LIMe Adaptive Workload Arbitration & Execution Kernel-manager',
    personalities,
    mode: () => currentMode,
    personality: () => personalities[currentMode],
    isLocked: () => locked,
    log: () => klog.slice(),
    onChange(fn) { listeners.push(fn); },
    emit(from, to, workload, line) { listeners.forEach((fn) => { try { fn(to, from, workload, line); } catch (_) {} }); },

    /* Arbitrate: ensure the kernel is presenting `abi` for this workload.
       Returns a human-readable transition line iff a switch happened. */
    require(abi, workload) {
      if (abi !== 'dos' && abi !== 'linux') return null;
      if (locked || currentMode === abi) return null;
      const from = currentMode;
      currentMode = abi;
      const p = personalities[abi];
      const line = `limawek: '${workload}' needs ${abi.toUpperCase()} ABI  →  kernel switched to ${p.name} (${p.cpu})`;
      klog.push({ t: Date.now(), from, to: abi, workload, line });
      this.emit(from, abi, workload, line);
      return line;
    },
    lock(abi, workload) {
      const line = this.require(abi, workload || 'lock');
      locked = true;
      return line;
    },
    unlock(workload) { locked = false; return this.require('linux', workload || 'unlock'); },
    status() {
      const p = this.personality();
      return [
        'LIMAWEK — ' + this.fullName,
        'state         : ' + (locked ? 'LOCKED (immersive)' : 'arbitrating'),
        'active kernel : ' + p.name + '  ' + p.version,
        'cpu mode      : ' + p.cpu,
        'transitions   : ' + klog.length,
        'personalities : dos (MS-DOS real-mode) · linux (Arch ' + personalities.linux.version + ')',
      ].join('\n');
    },
  };

  // -------------------------------------------------------------- VFS
  function dir(children = {}) { return { type: 'dir', children, mtime: Date.now() }; }
  function file(content = '') { return { type: 'file', content, mtime: Date.now() }; }

  const root = dir({
    bin: dir(),
    boot: dir({ 'vmlinuz-linux': file('\0BLOCK linux 6.14.2-arch1\0'), 'msdos.sys': file('MSDOS real-mode personality\r\n') }),
    etc: dir({
      'os-release': file(
        'NAME="LIMEdit BLOCK"\nID=limeblock\nID_LIKE="arch dos"\n' +
        'VERSION="1.0.0 (Sour Brick)"\nPRETTY_NAME="LIMEdit BLOCK 1.0.0"\n' +
        'KERNEL="archdos-hybrid"\nHOME_URL="lime://welcome"\n'),
      'motd': file('LIMEdit BLOCK — the GUI is the terminal.\n' +
                   'A hybrid kernel: LIMAWEK arbitrates DOS real-mode ⇄ Linux (Arch).\n' +
                   'Type `help`, `neofetch`, `kernel`, or `limawek status`.\n'),
    }),
    usr: dir({ bin: dir(), lib: dir({ modules: dir() }), share: dir({ doc: dir() }) }),
    var: dir({ log: dir({ 'kern.log': file('archdos: hybrid kernel online\n') }) }),
    home: dir({
      lime: dir({
        'readme.txt': file(
          'LIMEdit BLOCK\n=============\n\n' +
          'The whole desktop is a terminal. The console you are reading this from\n' +
          'is the root window — the window manager keeps it alive at all times.\n\n' +
          'Try:\n' +
          '  neofetch            arch-style animated banner\n' +
          '  DIR                 a DOS verb → watch LIMAWEK flip to real-mode\n' +
          '  ls                  a Linux verb → LIMAWEK flips back to Arch\n' +
          '  kernel              inspect the hybrid kernel\n' +
          '  limawek log         see every kernel transition\n' +
          '  pacman -S firefox && run firefox   third-party app on the Linux kernel\n' +
          '  dos                 drop into an immersive MS-DOS session\n'),
        Documents: dir({ 'hello.md': file('# Hello from BLOCK\n\nEverything here is in-memory.\n') }),
        Downloads: dir(),
        '.limerc': file('# limesh startup\nalias ll="ls -l"\n'),
      }),
    }),
  });

  function normalize(cwd, p) {
    if (!p) return cwd;
    p = String(p).replace(/\\/g, '/');
    let parts;
    if (p.startsWith('/')) parts = p.split('/');
    else if (p === '~' || p.startsWith('~/')) parts = ('/home/lime/' + p.slice(2)).split('/');
    else parts = (cwd + '/' + p).split('/');
    const out = [];
    for (const seg of parts) {
      if (seg === '' || seg === '.') continue;
      if (seg === '..') out.pop(); else out.push(seg);
    }
    return '/' + out.join('/');
  }
  function lookup(abs) {
    if (abs === '/') return root;
    let node = root;
    for (const seg of abs.split('/').filter(Boolean)) {
      if (node.type !== 'dir' || !node.children[seg]) return null;
      node = node.children[seg];
    }
    return node;
  }
  function parentOf(abs) {
    const i = abs.lastIndexOf('/');
    const parent = i <= 0 ? '/' : abs.slice(0, i);
    return { parent: lookup(parent), name: abs.slice(i + 1) };
  }
  const fs = {
    normalize, lookup,
    isDir: (a) => { const n = lookup(a); return !!n && n.type === 'dir'; },
    isFile: (a) => { const n = lookup(a); return !!n && n.type === 'file'; },
    read(a) { const n = lookup(a); if (!n || n.type !== 'file') throw new Error('not a file: ' + a); return n.content; },
    list(a) { const n = lookup(a); if (!n || n.type !== 'dir') throw new Error('not a directory: ' + a); return n.children; },
    write(a, c) { const { parent, name } = parentOf(a); if (!parent || parent.type !== 'dir') throw new Error('no such directory'); if (parent.children[name] && parent.children[name].type === 'dir') throw new Error('is a directory'); parent.children[name] = file(c); },
    mkdir(a) { const { parent, name } = parentOf(a); if (!parent || parent.type !== 'dir') throw new Error('no such directory'); if (parent.children[name]) throw new Error('already exists'); parent.children[name] = dir(); },
    remove(a) { const { parent, name } = parentOf(a); if (!parent || !parent.children[name]) throw new Error('no such file or directory: ' + a); delete parent.children[name]; },
    touch(a) { const n = lookup(a); if (n) { n.mtime = Date.now(); return; } fs.write(a, ''); },
  };

  // ---------------------------------------------------------- processes
  let nextPid = 100;
  const processes = [
    { pid: 1, name: 'archdos-kernel', cpu: 0.0, mem: 42, abi: 'hybrid' },
    { pid: 2, name: 'limawek', cpu: 0.3, mem: 18, abi: 'hybrid' },
    { pid: 8, name: 'blockwm', cpu: 1.2, mem: 88, abi: 'linux' },
    { pid: 9, name: 'limesh', cpu: 0.4, mem: 24, abi: 'hybrid' },
  ];
  function spawn(name, mem = 30, abi = 'linux') { const p = { pid: nextPid++, name, cpu: +(Math.random() * 3).toFixed(1), mem, abi }; processes.push(p); return p; }
  function kill(pid) { const i = processes.findIndex((p) => p.pid === pid); if (i === -1) return false; processes.splice(i, 1); return true; }

  function uptime() {
    const s = Math.floor((Date.now() - BOOT_TIME) / 1000);
    const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
    return (h ? h + 'h ' : '') + (m ? m + 'm ' : '') + sec + 's';
  }
  function memUsedMb() { return processes.reduce((a, p) => a + p.mem, 0) + 1800; }

  return { system, personalities, LIMAWEK, fs, processes, spawn, kill, uptime, memUsedMb, BOOT_TIME };
})();
window.Kernel = Kernel;
