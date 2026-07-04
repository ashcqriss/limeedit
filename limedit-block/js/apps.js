/*
 * LIMEdit BLOCK — apps.js
 * The GUI applications. Each factory returns { title, icon, node, w, h }.
 * The browser is the "detailed fallback-GUI" app: when the fallback GUI is
 * ALLOWED it renders full chrome; when DISABLED it degrades to a lightweight,
 * shell-first view — exactly the allow/disable behaviour the spec asks for.
 */
'use strict';

const Apps = (() => {
  const el = (tag, cls, html) => { const n = document.createElement(tag); if (cls) n.className = cls; if (html != null) n.innerHTML = html; return n; };

  // ------------------------------------------------------------ Browser
  const SITES = {
    'lime://welcome': () => `
      <div class="pg-hero">
        <div class="pg-logo">🟩</div>
        <h1>Welcome to LIMEdit BLOCK</h1>
        <p>The operating system where the GUI <em>is</em> the shell. Built as a
        faithful tribute welding <b>Arch Linux</b> userland to the classic
        <b>MS-DOS</b> command set.</p>
        <div class="pg-links">
          <a href="#" data-go="arch://wiki">Arch-style wiki ▸</a>
          <a href="#" data-go="dos://prompt">DOS prompt lore ▸</a>
          <a href="#" data-go="block://apps">Get apps ▸</a>
        </div>
      </div>`,
    'arch://wiki': () => `
      <h1>BLOCK Wiki — pacman</h1>
      <p>BLOCK inherits Arch's rolling-release philosophy and the <code>pacman</code>
      package manager.</p>
      <pre>pacman -Syu           # upgrade the whole system
pacman -S firefox     # install a package
pacman -Ss editor     # search the repos
pacman -Q             # list installed packages</pre>
      <p>Try any of these back in a Terminal window. <a href="#" data-go="lime://welcome">◂ home</a></p>`,
    'dos://prompt': () => `
      <h1>The DOS heritage</h1>
      <p>Under the lime skin, COMMAND.COM lives on. Every classic verb still works,
      case-insensitively:</p>
      <pre>C:\\&gt; DIR
C:\\&gt; TYPE readme.txt
C:\\&gt; VER
C:\\&gt; CLS</pre>
      <p>Modelled on <b>microsoft/MS-DOS</b> (MIT). <a href="#" data-go="lime://welcome">◂ home</a></p>`,
    'block://apps': () => `
      <h1>BLOCK App Store</h1>
      <ul class="pg-apps">
        <li><b>block-browser</b> — you're using it. <code>pacman -S block-browser</code></li>
        <li><b>cmatrix</b> — digital rain. <code>pacman -S cmatrix</code> then <code>matrix</code></li>
        <li><b>neofetch</b> — flex your specs. <code>neofetch</code></li>
        <li><b>block-doom</b> — someone always ports it. <code>pacman -S block-doom</code></li>
      </ul>
      <a href="#" data-go="lime://welcome">◂ home</a>`,
  };
  function searchPage(q) {
    return `<h1>Results for “${q}”</h1><p class="pg-dim">BLOCK search is offline-only; here are built-in pages:</p>
      <ul class="pg-apps">${Object.keys(SITES).map((u) => `<li><a href="#" data-go="${u}">${u}</a></li>`).join('')}</ul>`;
  }

  function browser(gui) {
    const fallback = gui.fallback();
    const root = el('div', 'browser' + (fallback ? ' rich' : ' lite'));

    if (!fallback) {
      root.appendChild(el('div', 'lite-note',
        '⚠ Fallback-GUI is <b>disabled</b> — showing the lightweight, shell-first browser.<br>' +
        'Run <code>fallback-gui ~allow</code> in a Terminal for the full, detailed browser.'));
    }

    const bar = el('div', 'br-bar');
    const back = el('button', 'br-btn', '◂');
    const fwd = el('button', 'br-btn', '▸');
    const reload = el('button', 'br-btn', '⟳');
    const addr = el('input', 'br-addr'); addr.value = 'lime://welcome';
    const go = el('button', 'br-btn br-go', 'Go');
    bar.append(back, fwd, reload, addr, go);
    const page = el('div', 'br-page');
    root.append(bar, page);

    const hist = ['lime://welcome']; let hi = 0;
    function render(url) {
      addr.value = url;
      const fn = SITES[url];
      page.innerHTML = fn ? fn() : searchPage(url);
      page.querySelectorAll('[data-go]').forEach((a) => a.addEventListener('click', (e) => { e.preventDefault(); navigate(a.dataset.go); }));
    }
    function navigate(url) {
      if (!/:\/\//.test(url)) url = SITES['lime://' + url] ? 'lime://' + url : url;
      hist.splice(hi + 1); hist.push(url); hi = hist.length - 1; render(url);
    }
    back.onclick = () => { if (hi > 0) render(hist[--hi]); };
    fwd.onclick = () => { if (hi < hist.length - 1) render(hist[++hi]); };
    reload.onclick = () => render(hist[hi]);
    go.onclick = () => navigate(addr.value.trim());
    addr.addEventListener('keydown', (e) => { if (e.key === 'Enter') navigate(addr.value.trim()); });
    render('lime://welcome');

    return { title: 'BLOCK Browser', icon: '🌐', node: root, w: 720, h: 500 };
  }

  // ------------------------------------------------------------ Files
  function files() {
    const root = el('div', 'files');
    const path = el('div', 'files-path');
    const list = el('div', 'files-list');
    const prev = el('pre', 'files-preview');
    const grid = el('div', 'files-grid');
    grid.append(list, prev);
    root.append(path, grid);
    let cwd = '/home/lime';
    function open(abs) {
      cwd = abs; path.textContent = abs; list.innerHTML = ''; prev.textContent = '';
      if (abs !== '/') {
        const up = el('div', 'file-row dir', '📁 ..');
        up.onclick = () => open(abs.split('/').slice(0, -1).join('/') || '/');
        list.appendChild(up);
      }
      for (const [name, n] of Object.entries(Kernel.fs.list(abs))) {
        const row = el('div', 'file-row ' + (n.type === 'dir' ? 'dir' : 'file'),
          (n.type === 'dir' ? '📁 ' : '📄 ') + name);
        row.onclick = () => n.type === 'dir' ? open(abs === '/' ? '/' + name : abs + '/' + name)
          : (prev.textContent = Kernel.fs.read(abs + '/' + name));
        list.appendChild(row);
      }
    }
    open(cwd);
    return { title: 'Files', icon: '🗂️', node: root, w: 620, h: 420 };
  }

  // ------------------------------------------------------------ About
  function about() {
    const root = el('div', 'about');
    const n = Neofetch.render();
    const head = el('div', 'about-head',
      `<div class="about-logo">🟩</div><div><h1>LIMEdit BLOCK</h1>
       <div class="about-ver">Version ${Kernel.system.version} “${Kernel.system.codename}”</div></div>`);
    root.append(head, n.el);
    const info = el('div', 'about-info',
      `<p>A modern operating environment modelled on two officially open-sourced
      code bases — <b>Arch Linux</b> (pacman, rolling userland) and
      <b>microsoft/MS-DOS</b> (the COMMAND.COM verbs) — dressed in a
      System&nbsp;9.2.2-style desktop.</p>
      <p class="pg-dim">The GUI is the shell. Everything runs in your browser; no
      real disk is touched.</p>`);
    root.appendChild(info);
    return { title: 'About This System', icon: 'ℹ️', node: root, w: 640, h: 560, onClose: () => n.stop() };
  }

  // ------------------------------------------------------------ Editor (tiny, self-contained)
  function editor() {
    const root = el('div', 'editor');
    const bar = el('div', 'ed-bar');
    const pathIn = el('input', 'ed-path'); pathIn.value = '/home/lime/readme.txt';
    const load = el('button', 'br-btn', 'Open');
    const save = el('button', 'br-btn', 'Save');
    bar.append(pathIn, load, save);
    const ta = el('textarea', 'ed-area');
    ta.spellcheck = false;
    root.append(bar, ta);
    function doLoad() {
      const abs = Kernel.fs.normalize('/home/lime', pathIn.value);
      ta.value = Kernel.fs.isFile(abs) ? Kernel.fs.read(abs) : '';
    }
    load.onclick = doLoad;
    save.onclick = () => { Kernel.fs.write(Kernel.fs.normalize('/home/lime', pathIn.value), ta.value); save.textContent = 'Saved ✓'; setTimeout(() => save.textContent = 'Save', 1000); };
    doLoad();
    return { title: 'BLOCK Editor', icon: '📝', node: root, w: 640, h: 460 };
  }

  // ------------------------------------------------------------ Settings
  function settings(gui) {
    const root = el('div', 'settings');
    root.append(el('h1', null, 'System Preferences'));
    const rowTheme = el('div', 'set-row', '<span>Appearance</span>');
    const tBtn = el('button', 'br-btn', document.documentElement.dataset.theme === 'dark' ? 'Dark' : 'Light');
    tBtn.onclick = () => { const t = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark'; document.documentElement.dataset.theme = t; tBtn.textContent = t[0].toUpperCase() + t.slice(1); };
    rowTheme.appendChild(tBtn);

    const rowFb = el('div', 'set-row', '<span>Fallback-GUI (rich app chrome)</span>');
    const fBtn = el('button', 'br-btn', gui.fallback() ? 'Allowed' : 'Disabled');
    fBtn.onclick = () => { const v = !gui.fallback(); gui.setFallback(v); fBtn.textContent = v ? 'Allowed' : 'Disabled'; };
    rowFb.appendChild(fBtn);

    const rowWall = el('div', 'set-row', '<span>Wallpaper</span>');
    const wBtn = el('button', 'br-btn', 'Cycle');
    wBtn.onclick = () => gui.cycleWallpaper();
    rowWall.appendChild(wBtn);

    root.append(rowTheme, rowFb, rowWall,
      el('p', 'pg-dim', 'These mirror the `theme`, `fallback-gui`, and `wallpaper` shell commands.'));
    return { title: 'System Preferences', icon: '⚙️', node: root, w: 480, h: 360 };
  }

  // ------------------------------------------------------------ Monitor
  function monitor() {
    const root = el('div', 'monitor');
    const table = el('pre', 'mon-table');
    root.appendChild(table);
    function tick() {
      const used = Kernel.memUsedMb(), tot = Kernel.system.memTotalMb;
      let s = `Memory: ${(used / 1024).toFixed(1)} / ${(tot / 1024).toFixed(1)} GiB   Uptime: ${Kernel.uptime()}\n\n`;
      s += '  PID  %CPU   MEM  COMMAND\n';
      for (const p of Kernel.processes) {
        p.cpu = Math.max(0, +(p.cpu + (Math.random() - 0.5)).toFixed(1));
        s += String(p.pid).padStart(5) + '  ' + p.cpu.toFixed(1).padStart(4) + '  ' + (p.mem + 'M').padStart(5) + '  ' + p.name + '\n';
      }
      table.textContent = s;
    }
    tick();
    const id = setInterval(tick, 1000);
    return { title: 'Activity Monitor', icon: '📊', node: root, w: 460, h: 420, onClose: () => clearInterval(id) };
  }

  const registry = { browser, files, about, editor, settings, monitor };

  return {
    create(name, gui) {
      const fn = registry[name];
      return fn ? fn(gui) : null;
    },
    names: () => Object.keys(registry),
  };
})();
window.Apps = Apps;
