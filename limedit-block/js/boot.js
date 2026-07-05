/*
 * LIMEdit BLOCK — boot.js
 * The power-on sequence, MS-DOS flavoured at the start (real-mode POST) and
 * Arch flavoured at the end (the hybrid kernel + LIMAWEK come up), then the
 * Block9 desktop — which is really just the always-on root console.
 */
'use strict';

(function () {
  const LOG = [
    'LIMEdit BLOCK BIOS v1.0  —  Power-On Self Test',
    'HIMEM: Testing extended memory... 16384K OK',
    '',
    'Starting MS-DOS real-mode personality...',
    '  COMMAND.COM loaded (microsoft/MS-DOS compat, MIT)',
    '  8.3 filesystem, drive C: mounted',
    '',
    'Handing off to the hybrid kernel: archdos-hybrid 1.0',
    '  [ ok ] LIMAWEK — kernel arbiter — online',
    '  [ ok ] loading Linux (Arch) personality: linux 6.14.2-arch1',
    '  [ ok ] pacman 7.0.0 — 9 packages in local db',
    '  [ ok ] BlockWM — always-on window manager — started',
    '  [ ok ] block9: System-9.2.2-style desktop',
    '  [ ok ] reached target Graphical Interface',
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
      setTimeout(nextLine, 70 + Math.random() * 80);
    } else setTimeout(finish, 380);
  }

  function finish() {
    boot.classList.add('done');
    setTimeout(() => {
      boot.hidden = true;
      desktop.hidden = false;
      GUI.init();                          // boots the always-on root console
      const root = GUI.root();
      setTimeout(() => root && root.shell && root.shell.execute('neofetch'), 250);
    }, 500);
  }

  function skip() { i = LOG.length; }
  boot.addEventListener('click', skip);
  window.addEventListener('keydown', function once() { skip(); window.removeEventListener('keydown', once); });
  window.addEventListener('DOMContentLoaded', () => setTimeout(nextLine, 300));
})();
