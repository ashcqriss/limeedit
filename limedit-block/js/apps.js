/*
 * LIMEdit BLOCK — apps.js
 * The GUI applications. Each factory (name, gui, meta) returns
 * { title, icon, node, w, h, onClose? }.
 *
 * The browser is the flagship "detailed fallback-GUI" app: with the fallback
 * GUI ALLOWED it renders full chrome (toolbar + bookmarks bar + rich pages);
 * DISABLED, it degrades to a lightweight, shell-first view.
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
        <p>The operating system where the GUI <em>is</em> the terminal. A hybrid
        kernel — arbitrated by <b>LIMAWEK</b> — welds <b>Arch Linux</b> to the
        classic <b>MS-DOS</b> command set.</p>
        <div class="pg-links">
          <a href="#" data-go="arch://wiki">Arch-style wiki ▸</a>
          <a href="#" data-go="dos://prompt">DOS prompt lore ▸</a>
          <a href="#" data-go="block://apps">Get apps ▸</a>
        </div>
        <h2 class="pg-h2">🌍 Real internet</h2>
        <p class="pg-dim">Type any address or search words in the bar above — this
        browser loads the actual web. Some sites refuse to be embedded; use the
        ↗ button to pop them out.</p>
        <div class="pg-links">
          <a href="#" data-go="https://example.com">example.com ▸</a>
          <a href="#" data-go="https://en.wikipedia.org/wiki/MS-DOS">wikipedia: MS-DOS ▸</a>
          <a href="#" data-go="https://archlinux.org">archlinux.org ▸</a>
        </div>
      </div>`,
    'arch://wiki': () => `
      <h1>BLOCK Wiki — pacman</h1>
      <p>BLOCK inherits Arch's rolling-release philosophy and the <code>pacman</code>
      package manager.</p>
      <pre>pacman -Syu           # upgrade the whole system
pacman -S firefox     # install a package
pacman -Ss editor     # search the repos
pacman -Q             # list installed packages
run firefox           # LIMAWEK services it on the Linux kernel</pre>
      <p>Try any of these back in the console. <a href="#" data-go="lime://welcome">◂ home</a></p>`,
    'dos://prompt': () => `
      <h1>The DOS heritage</h1>
      <p>Under the lime skin, COMMAND.COM lives on. Every classic verb still works,
      case-insensitively — and pulls the hybrid kernel into real-mode:</p>
      <pre>C:\\HOME\\LIME&gt; DIR
C:\\HOME\\LIME&gt; TYPE readme.txt
C:\\HOME\\LIME&gt; VER
C:\\HOME\\LIME&gt; CLS</pre>
      <p>Type <code>dos</code> for the immersive CRT session. Modelled on
      <b>microsoft/MS-DOS</b> (MIT). <a href="#" data-go="lime://welcome">◂ home</a></p>`,
    'block://apps': () => `
      <h1>BLOCK App Store</h1>
      <ul class="pg-apps">
        <li><b>block-browser</b> — you're using it. <code>pacman -S block-browser</code></li>
        <li><b>htop</b> — process viewer. <code>pacman -S htop && run htop</code></li>
        <li><b>cmatrix</b> — digital rain. <code>pacman -S cmatrix</code> then <code>matrix</code></li>
        <li><b>neofetch</b> — flex your specs. <code>neofetch</code></li>
        <li><b>block-doom</b> — someone always ports it. <code>pacman -S block-doom</code></li>
      </ul>
      <a href="#" data-go="lime://welcome">◂ home</a>`,
  };
  const INTERNAL = /^(lime|arch|dos|block):\/\//;
  function litePage() {
    return `<h1>Real-web browsing needs the detailed GUI</h1>
      <p>The lightweight, shell-first browser only renders BLOCK's built-in pages.
      Loading the <b>actual internet</b> is a rich-chrome feature.</p>
      <pre>fallback-gui ~allow</pre>
      <p>Run that in the console, close this window, and reopen the browser.</p>
      <p><a href="#" data-go="lime://welcome">◂ home</a></p>`;
  }

  function browser(gui, meta = {}) {
    const rich = gui.fallback();
    const root = el('div', 'browser' + (rich ? ' rich' : ' lite'));

    if (!rich) {
      root.appendChild(el('div', 'lite-note',
        '⚠ Fallback-GUI is <b>disabled</b> — showing the lightweight, shell-first browser.<br>' +
        'Run <code>fallback-gui ~allow</code> in the console for the full, detailed browser.'));
    }

    const bar = el('div', 'br-bar');
    const back = el('button', 'br-btn', '◂');
    const fwd = el('button', 'br-btn', '▸');
    const reload = el('button', 'br-btn', '⟳');
    const addr = el('input', 'br-addr');
    const go = el('button', 'br-btn br-go', 'Go');
    bar.append(back, fwd, reload, addr, go);
    const page = el('div', 'br-page');
    root.appendChild(bar);
    if (rich) {                          // bookmarks bar is part of the rich chrome
      const marks = el('div', 'br-marks');
      for (const url of Object.keys(SITES)) {
        const b = el('button', 'br-mark', url.replace('://', ' · '));
        b.onclick = () => navigate(url);
        marks.appendChild(b);
      }
      root.appendChild(marks);
    }
    root.appendChild(page);

    const start = meta.url || 'lime://welcome';
    const hist = [start]; let hi = 0;

    // A real web page: an <iframe> onto the actual internet, with an info bar
    // and a pop-out button for sites that refuse to be embedded.
    function renderWeb(url) {
      page.innerHTML = '';
      page.classList.add('br-webpage');
      const info = el('div', 'br-info',
        `<span>🌍 real internet — if the page stays blank, the site refuses embedding</span>`);
      const pop = el('a', 'br-pop', 'open ↗');
      pop.href = url; pop.target = '_blank'; pop.rel = 'noopener noreferrer';
      info.appendChild(pop);
      const frame = document.createElement('iframe');
      frame.className = 'br-frame';
      frame.src = url;
      frame.setAttribute('sandbox', 'allow-scripts allow-same-origin allow-forms allow-popups');
      frame.referrerPolicy = 'no-referrer';
      page.append(info, frame);
    }

    function render(url) {
      addr.value = url;
      page.classList.remove('br-webpage');
      const fn = SITES[url];
      if (fn) page.innerHTML = fn();
      else if (!rich) page.innerHTML = litePage();
      else return renderWeb(url);
      page.querySelectorAll('[data-go]').forEach((a) => a.addEventListener('click', (e) => { e.preventDefault(); navigate(a.dataset.go); }));
    }
    function navigate(url) {
      url = url.trim();
      if (!INTERNAL.test(url) && !/^https?:\/\//i.test(url)) {
        if (SITES['lime://' + url]) url = 'lime://' + url;                       // bare internal name
        else if (/^[\w.-]+\.[a-z]{2,}(\/|$)/i.test(url)) url = 'https://' + url; // bare domain
        else url = 'https://lite.duckduckgo.com/lite/?q=' + encodeURIComponent(url); // search
      }
      hist.splice(hi + 1); hist.push(url); hi = hist.length - 1; render(url);
    }
    back.onclick = () => { if (hi > 0) render(hist[--hi]); };
    fwd.onclick = () => { if (hi < hist.length - 1) render(hist[++hi]); };
    reload.onclick = () => render(hist[hi]);
    go.onclick = () => navigate(addr.value.trim());
    addr.addEventListener('keydown', (e) => { if (e.key === 'Enter') navigate(addr.value.trim()); });
    render(start);

    return { title: 'BLOCK Browser', icon: '🌐', node: root, w: 740, h: 520 };
  }

  // ------------------------------------------------------------ Files
  const EXT_ICON = { md: '📘', txt: '📄', js: '📜', json: '🧾', log: '🧾', sys: '⚙️' };
  function fileIcon(name, isDir) {
    if (isDir) return '📁';
    const ext = name.includes('.') ? name.split('.').pop().toLowerCase() : '';
    return EXT_ICON[ext] || '📄';
  }

  function files(gui, meta = {}) {
    const root = el('div', 'files');
    const tools = el('div', 'files-tools');
    const bNewF = el('button', 'br-btn', 'New File');
    const bNewD = el('button', 'br-btn', 'New Folder');
    const bDel = el('button', 'br-btn', 'Delete');
    const bRef = el('button', 'br-btn', '⟳');
    tools.append(bNewF, bNewD, bDel, bRef);
    const path = el('div', 'files-path');
    const list = el('div', 'files-list');
    const prev = el('pre', 'files-preview', '');
    const grid = el('div', 'files-grid');
    grid.append(list, prev);
    root.append(tools, path, grid);

    let cwd = meta.path || '/home/lime';
    let selected = null;

    function crumbs(abs) {
      path.innerHTML = '';
      const segs = abs.split('/').filter(Boolean);
      const mk = (label, target) => {
        const b = el('button', 'files-crumb', label);
        b.onclick = () => open(target);
        path.appendChild(b);
      };
      mk('/', '/');
      let acc = '';
      for (const s of segs) { acc += '/' + s; path.appendChild(el('span', null, '›')); mk(s, acc); }
    }

    function open(abs) {
      cwd = abs; selected = null; prev.textContent = '';
      crumbs(abs);
      list.innerHTML = '';
      if (abs !== '/') {
        const up = el('div', 'file-row dir', '📁 ..');
        up.ondblclick = () => open(abs.split('/').slice(0, -1).join('/') || '/');
        up.onclick = up.ondblclick;
        list.appendChild(up);
      }
      for (const [name, n] of Object.entries(Kernel.fs.list(abs))) {
        const isDir = n.type === 'dir';
        const row = el('div', 'file-row ' + (isDir ? 'dir' : 'file'));
        row.append(el('span', null, fileIcon(name, isDir)), document.createTextNode(' ' + name));
        row.appendChild(el('span', 'file-meta', isDir ? '—' : n.content.length + ' B'));
        const full = abs === '/' ? '/' + name : abs + '/' + name;
        row.onclick = () => {
          list.querySelectorAll('.file-row').forEach((r) => r.classList.remove('sel'));
          row.classList.add('sel');
          selected = { full, isDir };
          prev.textContent = isDir ? '' : Kernel.fs.read(full);
        };
        row.ondblclick = () => { if (isDir) open(full); else gui.openApp('editor', { path: full }); };
        list.appendChild(row);
      }
    }

    bRef.onclick = () => open(cwd);
    bNewF.onclick = () => { const name = prompt('New file name:'); if (!name) return; try { Kernel.fs.write(Kernel.fs.normalize(cwd, name), ''); open(cwd); } catch (e) { alert(e.message); } };
    bNewD.onclick = () => { const name = prompt('New folder name:'); if (!name) return; try { Kernel.fs.mkdir(Kernel.fs.normalize(cwd, name)); open(cwd); } catch (e) { alert(e.message); } };
    bDel.onclick = () => { if (!selected) return; try { Kernel.fs.remove(selected.full); open(cwd); } catch (e) { alert(e.message); } };

    open(cwd);
    return { title: 'Files', icon: '🗂️', node: root, w: 660, h: 440 };
  }

  // ------------------------------------------------------------ About
  function about() {
    const root = el('div', 'about');
    const n = Neofetch.render();
    const head = el('div', 'about-head',
      `<div class="about-logo">🟩</div><div><h1>LIMEdit BLOCK</h1>
       <div class="about-ver">Version ${Kernel.system.version} “${Kernel.system.codename}” · archdos-hybrid 1.0</div></div>`);
    root.append(head, n.el);
    root.appendChild(el('div', 'about-info',
      `<p>A modern operating environment built around a <b>hybrid kernel</b>:
      LIMAWEK arbitrates between an <b>MS-DOS real-mode</b> personality and a
      <b>Linux (Arch)</b> kernel, switching wherever each workload needs.</p>`));
    root.appendChild(el('div', 'about-credit',
      'Modelled on two officially open-sourced code bases: Arch Linux (pacman, rolling userland) ' +
      'and microsoft/MS-DOS (MIT). Desktop chrome in the spirit of Mac OS 9.2.2 “Platinum”. ' +
      'Everything runs client-side; no real disk is touched.'));
    return { title: 'About This System', icon: 'ℹ️', node: root, w: 660, h: 580, onClose: () => n.stop() };
  }

  // ------------------------------------------------------------ Editor
  function editor(gui, meta = {}) {
    const root = el('div', 'editor');
    const bar = el('div', 'ed-bar');
    const pathIn = el('input', 'ed-path');
    pathIn.value = meta.path || '/home/lime/readme.txt';
    const load = el('button', 'br-btn', 'Open');
    const save = el('button', 'br-btn', 'Save');
    bar.append(pathIn, load, save);
    const ta = el('textarea', 'ed-area');
    ta.spellcheck = false;
    const status = el('div', 'ed-status');
    const posEl = el('span', null, 'Ln 1, Col 1');
    const lenEl = el('span', null, '0 chars');
    const kernEl = el('span', null, 'linux · arch userland');
    status.append(posEl, lenEl, kernEl);
    root.append(bar, ta, status);

    function refreshStatus() {
      const upto = ta.value.slice(0, ta.selectionStart);
      const ln = upto.split('\n').length;
      const col = upto.length - upto.lastIndexOf('\n');
      posEl.textContent = `Ln ${ln}, Col ${col}`;
      lenEl.textContent = ta.value.length + ' chars';
    }
    ta.addEventListener('input', refreshStatus);
    ta.addEventListener('keyup', refreshStatus);
    ta.addEventListener('click', refreshStatus);

    function doLoad() {
      const abs = Kernel.fs.normalize('/home/lime', pathIn.value);
      ta.value = Kernel.fs.isFile(abs) ? Kernel.fs.read(abs) : '';
      refreshStatus();
    }
    load.onclick = doLoad;
    save.onclick = () => {
      try {
        Kernel.fs.write(Kernel.fs.normalize('/home/lime', pathIn.value), ta.value);
        save.textContent = 'Saved ✓'; setTimeout(() => (save.textContent = 'Save'), 1000);
      } catch (e) { alert(e.message); }
    };
    doLoad();
    return { title: 'BLOCK Editor', icon: '📝', node: root, w: 660, h: 480 };
  }

  // ------------------------------------------------------------ Settings
  function mkSwitch(checked, onchange) {
    const label = el('label', 'switch');
    const input = document.createElement('input');
    input.type = 'checkbox'; input.checked = checked;
    input.addEventListener('change', () => onchange(input.checked));
    label.append(input, el('i'));
    return label;
  }

  function settings(gui) {
    const root = el('div', 'settings');
    root.append(el('h1', null, 'System Preferences'));

    root.append(el('h2', null, 'Appearance'));
    const rowTheme = el('div', 'set-row', '<span>Dark theme</span>');
    rowTheme.appendChild(mkSwitch(document.documentElement.dataset.theme === 'dark', (on) => {
      if (on) document.documentElement.dataset.theme = 'dark';
      else delete document.documentElement.dataset.theme;
      try { localStorage.setItem('block.theme', on ? 'dark' : 'light'); } catch (_) {}
    }));
    const rowWall = el('div', 'set-row', '<span>Wallpaper</span>');
    const sw = el('div', 'wp-swatches');
    for (const name of gui.wallpapers()) {
      const b = el('button', 'wp-sw ' + name + (gui.wallpaper() === name ? ' on' : ''));
      b.title = name;
      b.onclick = () => { gui.setWallpaper(name); sw.querySelectorAll('.wp-sw').forEach((x) => x.classList.remove('on')); b.classList.add('on'); };
      sw.appendChild(b);
    }
    rowWall.appendChild(sw);
    root.append(rowTheme, rowWall);

    root.append(el('h2', null, 'Windows & motion'));
    const rowFb = el('div', 'set-row', '<span>Fallback-GUI (rich app chrome)</span>');
    rowFb.appendChild(mkSwitch(gui.fallback(), (on) => gui.setFallback(on)));
    const rowMotion = el('div', 'set-row', '<span>Animations</span>');
    rowMotion.appendChild(mkSwitch(gui.motion(), (on) => gui.setMotion(on)));
    root.append(rowFb, rowMotion);

    root.append(el('p', 'pg-dim', 'These mirror the `theme`, `wallpaper`, and `fallback-gui` shell commands.'));
    return { title: 'System Preferences', icon: '⚙️', node: root, w: 500, h: 430 };
  }

  // ------------------------------------------------------------ Monitor
  function monitor() {
    const root = el('div', 'monitor');
    const head = el('div', 'mon-head');
    const rows = el('div', 'mon-rows');
    root.append(head, rows);

    function render() {
      const used = Kernel.memUsedMb(), tot = Kernel.system.memTotalMb;
      head.textContent = `Memory ${(used / 1024).toFixed(1)} / ${(tot / 1024).toFixed(1)} GiB · Uptime ${Kernel.uptime()} · Kernel ${Kernel.LIMAWEK.personality().name}`;
      rows.innerHTML = '';
      const hdr = el('div', 'mon-row hdr');
      ['pid', 'command', 'cpu', '%', 'mem', ''].forEach((h) => hdr.appendChild(el('span', null, h)));
      rows.appendChild(hdr);
      for (const p of Kernel.processes) {
        p.cpu = Math.max(0, Math.min(9.9, +(p.cpu + (Math.random() - 0.5)).toFixed(1)));
        const row = el('div', 'mon-row');
        row.appendChild(el('span', null, String(p.pid)));
        row.appendChild(el('span', null, p.name + ' <span style="opacity:.5">· ' + (p.abi || 'linux') + '</span>'));
        const bar = el('div', 'mon-cpu'); bar.appendChild(el('i')).style.width = Math.min(100, p.cpu * 10) + '%';
        row.appendChild(bar);
        row.appendChild(el('span', null, p.cpu.toFixed(1)));
        row.appendChild(el('span', null, p.mem + 'M'));
        const kill = el('button', 'mon-kill', '✕');
        kill.title = 'End process';
        if (p.pid < 10) { kill.disabled = true; kill.title = 'System process'; }
        else kill.onclick = () => { Kernel.kill(p.pid); render(); };
        row.appendChild(kill);
        rows.appendChild(row);
      }
    }
    render();
    const id = setInterval(render, 1200);
    return { title: 'Activity Monitor', icon: '📊', node: root, w: 560, h: 440, onClose: () => clearInterval(id) };
  }

  const registry = { browser, files, about, editor, settings, monitor };

  return {
    create(name, gui, meta) {
      const fn = registry[name];
      return fn ? fn(gui, meta || {}) : null;
    },
    names: () => Object.keys(registry),
  };
})();
window.Apps = Apps;
