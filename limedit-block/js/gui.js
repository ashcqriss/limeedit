/*
 * LIMEdit BLOCK — gui.js
 * BlockWM / Block9: the always-on, System-9.2.2-styled window manager.
 *
 * The rule "the GUI is the terminal" is literal: BlockWM boots a maximized
 * *root console* that can never be closed, so the WM always has at least one
 * window to manage. Everything else — apps, and third-party Linux binaries
 * launched with `run` — floats above it as draggable, resizable, minimizable
 * windows with Platinum pinstriped title bars.
 *
 * Desktop furniture: a Platinum menu bar with a System-9-style Application
 * menu (far right), desktop icons that float on the console, and a launcher
 * dock with running indicators.
 */
'use strict';

const GUI = (() => {
  const windowsEl = () => document.getElementById('windows');
  const dockEl = () => document.getElementById('dock');
  const menuDrop = () => document.getElementById('menu-drop');

  let z = 10;
  let fallbackAllowed = false;
  let dosMode = false;
  const openWins = [];
  let termCount = 0;
  let activeTerminal = null;
  let rootConsole = null;
  let focused = null;
  let drag = null, resize = null;

  const WALLPAPERS = ['lime', 'platinum', 'dusk', 'noir'];
  let wallpaper = 'lime';

  const LAUNCHERS = [
    ['terminal', '▤', 'Terminal'],
    ['browser', '🌐', 'Browser'],
    ['files', '🗂️', 'Files'],
    ['editor', '📝', 'Editor'],
    ['monitor', '📊', 'Monitor'],
    ['settings', '⚙️', 'Settings'],
  ];

  const store = {
    get: (k) => { try { return localStorage.getItem('block.' + k); } catch (_) { return null; } },
    set: (k, v) => { try { localStorage.setItem('block.' + k, v); } catch (_) {} },
  };

  // ---------------------------------------------------------- badges
  function updateWmBadge() {
    const b = document.getElementById('mb-wm');
    if (b) b.textContent = '▚ BlockWM · ' + openWins.length + (openWins.length === 1 ? ' win' : ' wins');
  }
  function updateAppWinMenu() {
    const b = document.getElementById('mb-appwin');
    if (!b) return;
    const rec = focused || rootConsole;
    if (rec) b.textContent = (rec.spec.icon || '▢') + ' ' + rec.spec.title.split(' — ')[0];
  }
  function updateDockDots() {
    document.querySelectorAll('.dock-btn[data-app]').forEach((btn) => {
      const app = btn.dataset.app;
      btn.classList.toggle('running', openWins.some((r) => r.appName === app));
    });
  }
  function refreshChrome() { updateWmBadge(); updateAppWinMenu(); updateDockDots(); }

  // ---------------------------------------------------------- window
  function focusRec(rec) {
    if (!rec) return;
    if (!rec.spec.root) rec.win.style.zIndex = ++z;
    openWins.forEach((r) => r.win.classList.toggle('active', r === rec));
    focused = rec;
    if (rec.spec.isTerminal) activeTerminal = rec;
    updateAppWinMenu();
  }

  function minimizeRec(rec) {
    rec.win.classList.add('minimizing');
    setTimeout(() => {
      rec.win.classList.remove('minimizing');
      rec.win.classList.add('minimized');
      if (focused === rec) { focused = openWins.filter((r) => !r.win.classList.contains('minimized')).pop() || null; if (focused) focusRec(focused); }
      refreshChrome();
    }, 210);
  }
  function restoreRec(rec) {
    rec.win.classList.remove('minimized', 'minimizing');
    focusRec(rec);
    refreshChrome();
  }

  function makeWindow(spec, contentNode) {
    const id = 'w' + (++z);
    const win = document.createElement('section');
    win.className = 'win' + (spec.root ? ' win-root' : '');
    win.style.zIndex = spec.root ? 1 : ++z;
    if (!spec.root) {
      // Clamp size + cascade position so the window always fits the desktop
      // (keeps the resize grip reachable).
      const area = windowsEl().getBoundingClientRect();
      const w = Math.min(spec.w || 560, Math.max(320, area.width - 24));
      const h = Math.min(spec.h || 400, Math.max(180, area.height - 20));
      win.style.width = w + 'px'; win.style.height = h + 'px';
      win.style.left = Math.max(6, Math.min(70 + (openWins.length % 6) * 36, area.width - w - 12)) + 'px';
      win.style.top = Math.max(30, Math.min(58 + (openWins.length % 6) * 32, area.height - h - 10)) + 'px';
    }

    const title = document.createElement('div');
    title.className = 'win-title';
    title.innerHTML =
      `<span class="win-lights">` +
      `<i class="lc lc-close${spec.root ? ' lc-off' : ''}" title="${spec.root ? 'Root console — cannot close' : 'Close'}"></i>` +
      `<i class="lc lc-min" title="Minimise"></i><i class="lc lc-zoom" title="Zoom"></i></span>` +
      `<span class="win-name">${spec.icon || ''} ${spec.title}</span>` +
      (spec.procName ? `<span class="win-proc">pid ${spec.pid} · linux</span>` : '<span></span>');
    const body = document.createElement('div');
    body.className = 'win-body';
    body.appendChild(contentNode);
    win.append(title, body);
    windowsEl().appendChild(win);

    const rec = { id, win, spec, appName: spec.appName || null };
    openWins.push(rec);

    win.addEventListener('mousedown', () => focusRec(rec));
    focusRec(rec);

    if (!spec.root) {
      // drag by title bar
      title.addEventListener('mousedown', (e) => {
        if (e.target.classList.contains('lc')) return;
        drag = { rec, x: e.clientX, y: e.clientY, l: win.offsetLeft, t: win.offsetTop };
        e.preventDefault();
      });
      // resize grip
      const grip = document.createElement('div');
      grip.className = 'win-grip';
      grip.title = 'Resize';
      win.appendChild(grip);
      grip.addEventListener('mousedown', (e) => {
        resize = { rec, x: e.clientX, y: e.clientY, w: win.offsetWidth, h: win.offsetHeight };
        e.preventDefault(); e.stopPropagation();
      });
    }
    title.addEventListener('dblclick', (e) => { if (!e.target.classList.contains('lc')) win.classList.toggle('zoomed'); });

    title.querySelector('.lc-close').onclick = () => { if (!spec.root) closeWin(rec); };
    title.querySelector('.lc-min').onclick = () => minimizeRec(rec);
    title.querySelector('.lc-zoom').onclick = () => win.classList.toggle('zoomed');

    refreshChrome();
    return rec;
  }

  window.addEventListener('mousemove', (e) => {
    if (drag) {
      drag.rec.win.style.left = Math.max(0, drag.l + e.clientX - drag.x) + 'px';
      drag.rec.win.style.top = Math.max(30, drag.t + e.clientY - drag.y) + 'px';
    } else if (resize) {
      resize.rec.win.style.width = Math.max(320, resize.w + e.clientX - resize.x) + 'px';
      resize.rec.win.style.height = Math.max(180, resize.h + e.clientY - resize.y) + 'px';
    }
  });
  window.addEventListener('mouseup', () => { drag = null; resize = null; });

  function closeWin(rec) {
    if (rec.spec.root) return;
    if (rec.spec.onClose) try { rec.spec.onClose(); } catch (_) {}
    rec.win.remove();
    const i = openWins.indexOf(rec); if (i >= 0) openWins.splice(i, 1);
    if (activeTerminal === rec) activeTerminal = openWins.filter((r) => r.spec.isTerminal).slice(-1)[0] || rootConsole;
    if (focused === rec) { focused = null; focusRec(openWins.filter((r) => !r.win.classList.contains('minimized')).pop() || rootConsole); }
    refreshChrome();
  }

  // ---------------------------------------------------------- kernel UI
  function reflectKernel() {
    const mode = Kernel.LIMAWEK.mode();
    const p = Kernel.personalities[mode];
    const badge = document.getElementById('mb-kernel');
    if (badge) badge.textContent = (mode === 'dos' ? '◆ dos·real-mode' : '◆ arch·' + p.version.split('-')[0]);
    document.body.classList.toggle('kernel-dos', mode === 'dos');
    document.body.classList.toggle('kernel-linux', mode !== 'dos');
  }

  // ---------------------------------------------------------- API for apps/shell
  const api = {
    fallback: () => fallbackAllowed,
    setFallback(v) {
      fallbackAllowed = !!v;
      document.body.classList.toggle('fallback-on', fallbackAllowed);
      store.set('fallback', fallbackAllowed ? 'on' : 'off');
      const badge = document.getElementById('mb-fallback');
      if (badge) badge.textContent = 'GUI: ' + (fallbackAllowed ? 'rich' : 'shell');
    },
    setDosMode(v) {
      dosMode = !!v;
      document.body.classList.toggle('dosmode', dosMode);
      reflectKernel();
    },
    setWallpaper(name) {
      if (!WALLPAPERS.includes(name)) return false;
      WALLPAPERS.forEach((w) => document.body.classList.remove('wp-' + w));
      wallpaper = name;
      document.body.classList.add('wp-' + name);
      store.set('wallpaper', name);
      return true;
    },
    wallpaper: () => wallpaper,
    wallpapers: () => WALLPAPERS.slice(),
    cycleWallpaper(name) {
      if (name && api.setWallpaper(name)) return wallpaper;
      const i = (WALLPAPERS.indexOf(wallpaper) + 1) % WALLPAPERS.length;
      api.setWallpaper(WALLPAPERS[i]);
      return wallpaper;
    },
    setMotion(on) {
      document.documentElement.classList.toggle('no-motion', !on);
      store.set('motion', on ? 'on' : 'off');
    },
    motion: () => !document.documentElement.classList.contains('no-motion'),
    closeActiveTerminal() {
      if (activeTerminal && !activeTerminal.spec.root) closeWin(activeTerminal);
      else if (activeTerminal && activeTerminal.shell) activeTerminal.shell.ctx.print('limesh: the root console stays — BlockWM needs a window.', 'dim');
    },

    openApp(name, meta = {}) {
      name = String(name || '').toLowerCase();
      if (name === 'terminal' || name === 'shell' || name === 'limesh') {
        const mount = document.createElement('div');
        const rec = makeWindow({ title: 'limesh — Terminal ' + (++termCount), icon: '▤', w: 680, h: 440, isTerminal: true, appName: 'terminal' }, mount);
        rec.shell = Shell.create(mount, api);
        activeTerminal = rec;
        return rec;
      }
      const spec = Apps.create(name, api, meta);
      if (!spec) return false;
      spec.isTerminal = false;
      spec.appName = name;
      if (meta.procName) { spec.procName = meta.procName; spec.pid = meta.pid; spec.title = meta.procName + ' — ' + spec.title; }
      return makeWindow(spec, spec.node);
    },

    bootConsole() {
      const mount = document.createElement('div');
      rootConsole = makeWindow({ title: 'limesh — console (root)', icon: '▤', root: true, isTerminal: true, appName: 'terminal' }, mount);
      rootConsole.shell = Shell.create(mount, api);
      activeTerminal = rootConsole;
      return rootConsole;
    },
  };

  // ---------------------------------------------------------- menus
  // item: [label, fn, shortcut?]  |  '-'  |  fn === null → disabled
  const MENUS = {
    apple: () => [
      ['About This System', () => api.openApp('about')],
      ['System Preferences…', () => api.openApp('settings')],
      '-',
      ['Kernel & LIMAWEK', () => runInTerminal('kernel')],
      ['App Store (browser)', () => api.openApp('browser')],
      '-',
      ['Restart', () => location.reload()],
      ['Shut Down…', () => document.body.classList.add('poweroff')],
    ],
    file: () => [
      ['New Terminal', () => api.openApp('terminal'), '⌃⌥T'],
      ['New Editor', () => api.openApp('editor')],
      ['Open Files', () => api.openApp('files')],
      '-',
      ['Close Window', () => { const top = openWins.filter((r) => !r.spec.root).pop(); if (top) closeWin(top); }, '⌘W'],
    ],
    edit: () => [['Undo', null, '⌘Z'], ['Redo', null, '⇧⌘Z'], '-', ['Cut', null, '⌘X'], ['Copy', null, '⌘C'], ['Paste', null, '⌘V']],
    view: () => [
      ['Toggle Theme', () => toggleTheme()],
      ['Next Wallpaper', () => api.cycleWallpaper()],
      '-',
      ['Fallback-GUI: allow', () => api.setFallback(true)],
      ['Fallback-GUI: disable', () => api.setFallback(false)],
    ],
    special: () => [
      ['Kernel → DOS real-mode', () => runInTerminal('limawek mode dos')],
      ['Kernel → Linux (Arch)', () => runInTerminal('limawek mode linux')],
      ['Immersive MS-DOS', () => runInTerminal('dos')],
      '-',
      ['neofetch', () => runInTerminal('neofetch')],
      ['matrix', () => runInTerminal('matrix')],
      ['Empty Trash', () => runInTerminal('echo trash: already empty — BLOCK wastes nothing.')],
    ],
    apps: () => LAUNCHERS.map(([app, icon, label]) => [icon + ' ' + label, () => api.openApp(app)]),
    windows: () => openWins.map((rec) => [
      (rec === focused ? '✓ ' : rec.win.classList.contains('minimized') ? '◇ ' : '   ') +
        (rec.spec.icon || '▢') + ' ' + rec.spec.title,
      () => restoreRec(rec),
    ]),
  };

  function toggleTheme() {
    const t = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
    if (t === 'dark') document.documentElement.dataset.theme = 'dark';
    else delete document.documentElement.dataset.theme;
    store.set('theme', t);
  }

  function runInTerminal(line) {
    let rec = activeTerminal || rootConsole;
    if (!rec) rec = api.openApp('terminal');
    if (rec.win.classList.contains('minimized')) restoreRec(rec);
    setTimeout(() => rec.shell && rec.shell.execute(line), 20);
  }

  function openMenu(key, anchor) {
    const build = MENUS[key];
    if (!build) return;
    const drop = menuDrop();
    drop.innerHTML = '';
    for (const item of build()) {
      if (item === '-') { drop.appendChild(document.createElement('hr')); continue; }
      const [label, fn, shortcut] = item;
      const b = document.createElement('button');
      b.className = 'menu-item' + (fn ? '' : ' disabled');
      b.innerHTML = `<span></span><span class="ms">${shortcut || ''}</span>`;
      b.firstChild.textContent = label;
      if (fn) b.onclick = () => { closeMenus(); fn(); };
      drop.appendChild(b);
    }
    const r = anchor.getBoundingClientRect();
    drop.style.top = (r.bottom + 3) + 'px';
    drop.style.left = Math.min(r.left, window.innerWidth - 250) + 'px';
    drop.hidden = false;
    drop.dataset.open = key;
  }
  function closeMenus() {
    const d = menuDrop(); d.hidden = true; d.dataset.open = '';
    document.querySelectorAll('.mb-item.on').forEach((b) => b.classList.remove('on'));
  }

  function wireMenuBar() {
    document.querySelectorAll('.mb-item[data-menu]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const key = btn.dataset.menu;
        if (menuDrop().dataset.open === key) { closeMenus(); return; }
        closeMenus(); btn.classList.add('on'); openMenu(key, btn);
      });
      btn.addEventListener('mouseenter', () => {
        if (menuDrop().hidden) return;
        closeMenus(); btn.classList.add('on'); openMenu(btn.dataset.menu, btn);
      });
    });
    document.addEventListener('click', closeMenus);
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') closeMenus();
      if (e.ctrlKey && e.altKey && (e.key === 't' || e.key === 'T')) { e.preventDefault(); api.openApp('terminal'); }
    });
  }

  // ---------------------------------------------------------- dock & icons
  function buildDock() {
    const dock = dockEl();
    dock.innerHTML = '';
    for (const [app, icon, label] of LAUNCHERS) {
      const btn = document.createElement('button');
      btn.className = 'dock-btn';
      btn.dataset.app = app;
      btn.innerHTML = `<span>${icon}</span><small>${label}</small><i class="dot"></i>`;
      btn.title = label;
      btn.onclick = () => {
        const recs = openWins.filter((r) => r.appName === app);
        if (!recs.length) return api.openApp(app);
        restoreRec(recs[recs.length - 1]);
      };
      dock.appendChild(btn);
    }
  }

  function buildDesktopIcons() {
    const host = document.getElementById('desktop-icons');
    if (!host) return;
    host.innerHTML = '';
    const ICONS = [
      ['💾', 'BlockFS', () => api.openApp('files', { path: '/' })],
      ['🏠', 'Home', () => api.openApp('files', { path: '/home/lime' })],
      ['🗑️', 'Trash', () => runInTerminal('echo trash: empty. BLOCK wastes nothing.')],
    ];
    for (const [icon, label, fn] of ICONS) {
      const d = document.createElement('div');
      d.className = 'dicon';
      d.innerHTML = `<i>${icon}</i><small>${label}</small>`;
      d.addEventListener('click', () => { host.querySelectorAll('.dicon').forEach((x) => x.classList.remove('sel')); d.classList.add('sel'); });
      d.addEventListener('dblclick', fn);
      host.appendChild(d);
    }
  }

  function startClock() {
    const c = document.getElementById('mb-clock');
    const tick = () => {
      const d = new Date();
      c.textContent = d.toLocaleDateString(undefined, { weekday: 'short' }) + ' ' +
        d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
    };
    tick(); setInterval(tick, 1000 * 15);
  }

  function init() {
    api.setWallpaper(store.get('wallpaper') || 'lime');
    api.setFallback(store.get('fallback') === 'on');
    wireMenuBar();
    buildDock();
    buildDesktopIcons();
    startClock();
    Kernel.LIMAWEK.onChange(reflectKernel);
    reflectKernel();
    api.bootConsole();
    refreshChrome();
  }

  return { init, api, openApp: (n, m) => api.openApp(n, m), root: () => rootConsole };
})();
window.GUI = GUI;
