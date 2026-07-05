/*
 * LIMEdit BLOCK — gui.js
 * Block9: the always-on window manager. The design principle from the spec —
 * "the GUI is the terminal" — is literal here: BlockWM boots with a maximized
 * *root console* that can never be closed, and it stays active because there is
 * always at least that one window. Every app (and every third-party Linux
 * binary launched with `run`) floats above it as another managed window.
 *
 * The menu bar shows the live hybrid-kernel personality; when LIMAWEK switches
 * the kernel to real-mode the whole console adopts the classic MS-DOS look.
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

  const WALLPAPERS = ['wp-lime', 'wp-dusk', 'wp-mint', 'wp-noir'];
  let wpIdx = 0;

  function updateWmBadge() {
    const b = document.getElementById('mb-wm');
    if (b) b.textContent = '▚ BlockWM · ' + openWins.length + (openWins.length === 1 ? ' win' : ' wins');
  }

  // ---------------------------------------------------------- window
  function makeWindow(spec, contentNode) {
    const id = 'w' + (++z);
    const win = document.createElement('section');
    win.className = 'win' + (spec.root ? ' win-root' : '');
    win.style.zIndex = spec.root ? 1 : ++z;
    const w = spec.w || 560, h = spec.h || 400;
    if (!spec.root) {
      win.style.width = w + 'px'; win.style.height = h + 'px';
      win.style.left = (60 + (openWins.length % 6) * 34) + 'px';
      win.style.top = (56 + (openWins.length % 6) * 30) + 'px';
    }

    const title = document.createElement('div');
    title.className = 'win-title';
    title.innerHTML =
      `<span class="win-lights">` +
      `<i class="lc lc-close${spec.root ? ' lc-off' : ''}" title="${spec.root ? 'Root console — cannot close' : 'Close'}"></i>` +
      `<i class="lc lc-min" title="Minimise"></i><i class="lc lc-zoom" title="Zoom"></i></span>` +
      `<span class="win-name">${spec.icon || ''} ${spec.title}</span>` +
      (spec.procName ? `<span class="win-proc">pid ${spec.pid} · linux</span>` : '');
    const body = document.createElement('div');
    body.className = 'win-body';
    body.appendChild(contentNode);
    win.append(title, body);
    windowsEl().appendChild(win);

    const rec = { id, win, spec };
    openWins.push(rec);
    updateWmBadge();

    const focus = () => {
      if (!spec.root) win.style.zIndex = ++z;
      openWins.forEach((r) => r.win.classList.toggle('active', r === rec));
      if (spec.isTerminal) activeTerminal = rec;
    };
    win.addEventListener('mousedown', focus);
    focus();

    // drag (root console is fixed)
    if (!spec.root) {
      let drag = null;
      title.addEventListener('mousedown', (e) => {
        if (e.target.classList.contains('lc')) return;
        drag = { x: e.clientX, y: e.clientY, l: win.offsetLeft, t: win.offsetTop };
        e.preventDefault();
      });
      window.addEventListener('mousemove', (e) => {
        if (!drag) return;
        win.style.left = Math.max(0, drag.l + e.clientX - drag.x) + 'px';
        win.style.top = Math.max(28, drag.t + e.clientY - drag.y) + 'px';
      });
      window.addEventListener('mouseup', () => { drag = null; });
    }

    title.querySelector('.lc-close').onclick = () => { if (!spec.root) closeWin(rec); };
    title.querySelector('.lc-min').onclick = () => win.classList.toggle('mini');
    title.querySelector('.lc-zoom').onclick = () => win.classList.toggle('zoomed');

    const dockBtn = document.createElement('button');
    dockBtn.className = 'dock-btn';
    dockBtn.innerHTML = `<span>${spec.icon || '▢'}</span><small>${spec.title}</small>`;
    dockBtn.onclick = () => { win.classList.remove('mini'); focus(); };
    dockEl().appendChild(dockBtn);
    rec.dockBtn = dockBtn;

    return rec;
  }

  function closeWin(rec) {
    if (rec.spec.root) return;
    if (rec.spec.onClose) try { rec.spec.onClose(); } catch (_) {}
    rec.win.remove();
    if (rec.dockBtn) rec.dockBtn.remove();
    const i = openWins.indexOf(rec); if (i >= 0) openWins.splice(i, 1);
    if (activeTerminal === rec) activeTerminal = openWins.filter((r) => r.spec.isTerminal).slice(-1)[0] || rootConsole;
    updateWmBadge();
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

  // ---------------------------------------------------------- apps API
  const api = {
    fallback: () => fallbackAllowed,
    setFallback(v) {
      fallbackAllowed = !!v;
      document.body.classList.toggle('fallback-on', fallbackAllowed);
      const badge = document.getElementById('mb-fallback');
      if (badge) badge.textContent = 'GUI: ' + (fallbackAllowed ? 'rich' : 'shell');
    },
    setDosMode(v) {
      dosMode = !!v;
      document.body.classList.toggle('dosmode', dosMode);
      reflectKernel();
    },
    cycleWallpaper(name) {
      document.body.classList.remove(...WALLPAPERS);
      if (name && WALLPAPERS.includes('wp-' + name)) wpIdx = WALLPAPERS.indexOf('wp-' + name);
      else wpIdx = (wpIdx + 1) % WALLPAPERS.length;
      document.body.classList.add(WALLPAPERS[wpIdx]);
    },
    closeActiveTerminal() {
      if (activeTerminal && !activeTerminal.spec.root) closeWin(activeTerminal);
      else if (activeTerminal && activeTerminal.shell) activeTerminal.shell.execute('# the root console stays — the WM needs it');
    },

    openApp(name, meta = {}) {
      name = name.toLowerCase();
      if (name === 'terminal' || name === 'shell' || name === 'limesh') {
        const mount = document.createElement('div');
        const rec = makeWindow({ title: 'limesh — Terminal ' + (++termCount), icon: '▤', w: 680, h: 440, isTerminal: true }, mount);
        rec.shell = Shell.create(mount, api);
        activeTerminal = rec;
        return rec;
      }
      const spec = Apps.create(name, api);
      if (!spec) return false;
      spec.isTerminal = false;
      if (meta.procName) { spec.procName = meta.procName; spec.pid = meta.pid; spec.title = meta.procName + ' — ' + spec.title; }
      return makeWindow(spec, spec.node);
    },

    // Boot the always-on root console.
    bootConsole() {
      const mount = document.createElement('div');
      rootConsole = makeWindow({ title: 'limesh — console (root)', icon: '▤', root: true, isTerminal: true }, mount);
      rootConsole.shell = Shell.create(mount, api);
      activeTerminal = rootConsole;
      return rootConsole;
    },
  };

  // ---------------------------------------------------------- menu bar
  const MENUS = {
    apple: [
      ['About This System', () => api.openApp('about')],
      ['System Preferences…', () => api.openApp('settings')],
      '-',
      ['Kernel & LIMAWEK', () => runInTerminal('kernel')],
      ['App Store (browser)', () => api.openApp('browser')],
      '-',
      ['Restart', () => location.reload()],
      ['Shut Down…', () => { document.body.classList.add('poweroff'); }],
    ],
    file: [
      ['New Terminal', () => api.openApp('terminal')],
      ['New Editor', () => api.openApp('editor')],
      ['Open Files', () => api.openApp('files')],
      '-',
      ['Close Window', () => { const top = openWins.filter((r) => !r.spec.root).slice(-1)[0]; if (top) closeWin(top); }],
    ],
    edit: [['Undo', () => {}], ['Redo', () => {}], '-', ['Cut', () => {}], ['Copy', () => {}], ['Paste', () => {}]],
    view: [
      ['Toggle Theme', () => { document.documentElement.dataset.theme = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark'; }],
      ['Cycle Wallpaper', () => api.cycleWallpaper()],
      '-',
      ['Fallback-GUI: allow', () => api.setFallback(true)],
      ['Fallback-GUI: disable', () => api.setFallback(false)],
    ],
    special: [
      ['Kernel → DOS real-mode', () => runInTerminal('limawek mode dos')],
      ['Kernel → Linux (Arch)', () => runInTerminal('limawek mode linux')],
      ['Immersive MS-DOS', () => runInTerminal('dos')],
      '-',
      ['neofetch', () => runInTerminal('neofetch')],
      ['matrix', () => runInTerminal('matrix')],
    ],
    apps: [
      ['🌐 Browser', () => api.openApp('browser')],
      ['🗂️ Files', () => api.openApp('files')],
      ['📝 Editor', () => api.openApp('editor')],
      ['📊 Activity Monitor', () => api.openApp('monitor')],
      ['⚙️ System Preferences', () => api.openApp('settings')],
      ['▤ Terminal', () => api.openApp('terminal')],
    ],
  };

  function runInTerminal(line) {
    let rec = activeTerminal || rootConsole;
    if (!rec) rec = api.openApp('terminal');
    setTimeout(() => rec.shell && rec.shell.execute(line), 20);
  }

  function openMenu(key, anchor) {
    const items = MENUS[key]; const drop = menuDrop();
    if (!items) return;
    drop.innerHTML = '';
    for (const item of items) {
      if (item === '-') { drop.appendChild(document.createElement('hr')); continue; }
      const b = document.createElement('button');
      b.className = 'menu-item'; b.textContent = item[0];
      b.onclick = () => { closeMenus(); item[1](); };
      drop.appendChild(b);
    }
    drop.style.left = anchor.getBoundingClientRect().left + 'px';
    drop.hidden = false; drop.dataset.open = key;
  }
  function closeMenus() { const d = menuDrop(); d.hidden = true; d.dataset.open = ''; document.querySelectorAll('.mb-item.on').forEach((b) => b.classList.remove('on')); }

  function wireMenuBar() {
    document.querySelectorAll('.mb-item[data-menu]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const key = btn.dataset.menu;
        if (menuDrop().dataset.open === key) { closeMenus(); return; }
        closeMenus(); btn.classList.add('on'); openMenu(key, btn);
      });
      btn.addEventListener('mouseenter', () => { if (menuDrop().hidden) return; closeMenus(); btn.classList.add('on'); openMenu(btn.dataset.menu, btn); });
    });
    document.addEventListener('click', closeMenus);
  }

  function startClock() {
    const c = document.getElementById('mb-clock');
    const tick = () => { const d = new Date(); c.textContent = d.toLocaleDateString(undefined, { weekday: 'short' }) + ' ' + d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' }); };
    tick(); setInterval(tick, 1000 * 15);
  }

  function init() {
    document.body.classList.add(WALLPAPERS[0]);
    wireMenuBar();
    startClock();
    api.setFallback(false);
    Kernel.LIMAWEK.onChange(reflectKernel);
    reflectKernel();
    api.bootConsole();
    updateWmBadge();
  }

  return { init, api, openApp: (n, m) => api.openApp(n, m), root: () => rootConsole };
})();
window.GUI = GUI;
