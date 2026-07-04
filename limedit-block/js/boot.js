/*
 * LIMEdit BLOCK — boot.js
 * The power-on sequence: a scrolling kernel log (arch·dos flavoured), a
 * progress bar, then the Block9 desktop with a Terminal already running
 * `neofetch`, exactly as the spec asks.
 */
'use strict';

(function () {
  const LOG = [
    '[    0.000000] LIMEdit BLOCK archdos 6.9.0-BLOCK booting…',
    '[    0.014212] CPU: Citrus C9 @ 3.60GHz (8 cores) — brought online',
    '[    0.031004] Loading MS-DOS compatibility verbs (COMMAND.COM shim) … ok',
    '[    0.052771] Loading Arch userland (coreutils, pacman 6.1.0) … ok',
    '[    0.079330] blockfs: mounted / (256G, in-memory) … ok',
    '[    0.101888] pacman: 8 packages in local db',
    '[    0.140550] block9: starting System-9.2.2-style desktop … ok',
    '[    0.166201] blockwm: compositor up, fallback-GUI = disabled',
    '[    0.190004] limesh: PowerShell + DOS + GNU dialects registered',
    '[    0.221377] systemd-block: reached target Graphical Interface.',
    '',
    'LIMEdit BLOCK 1.0.0 (Sour Brick)  —  login: lime (auto)',
  ];

  const boot = document.getElementById('boot');
  const logEl = document.getElementById('boot-log');
  const barFill = document.getElementById('boot-bar-fill');
  const desktop = document.getElementById('desktop');

  let i = 0;
  function nextLine() {
    if (i < LOG.length) {
      logEl.textContent += LOG[i] + '\n';
      barFill.style.width = Math.round(((i + 1) / LOG.length) * 100) + '%';
      i++;
      setTimeout(nextLine, 90 + Math.random() * 90);
    } else {
      setTimeout(finish, 420);
    }
  }

  function finish() {
    boot.classList.add('done');
    setTimeout(() => {
      boot.hidden = true;
      desktop.hidden = false;
      GUI.init();
      const term = GUI.openApp('terminal');
      // Show off immediately: run neofetch in the fresh terminal.
      setTimeout(() => term.shell && term.shell.execute('neofetch'), 250);
    }, 500);
  }

  // Allow click/keys to skip the boot animation.
  function skip() { i = LOG.length; }
  boot.addEventListener('click', skip);
  window.addEventListener('keydown', function once() { skip(); window.removeEventListener('keydown', once); });

  window.addEventListener('DOMContentLoaded', () => setTimeout(nextLine, 300));
})();
