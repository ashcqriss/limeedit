/*
 * LIMEdit BLOCK — boot.js
 * A two-phase power-on sequence:
 *   1. BIOS POST + real-mode DOS handoff (black, scrolling text)
 *   2. A Mac-OS-9-style "Welcome" splash — progress bar and an extension
 *      parade — while the Arch personality and BlockWM come up.
 * Then the desktop, which is really just the always-on root console.
 */
'use strict';

(function () {
  const POST = [
    'LIMEdit BLOCK BIOS v1.1  —  Power-On Self Test',
    'CPU: Citrus C9 @ 3.60GHz (8 cores) ......... OK',
    'HIMEM: Testing extended memory ............. 16384K OK',
    '',
    'Starting MS-DOS real-mode personality...',
    '  COMMAND.COM loaded (microsoft/MS-DOS compat, MIT)',
    '  8.3 filesystem, drive C: mounted',
    '',
    'Handing off to the hybrid kernel: archdos-hybrid 1.0',
    '  [ ok ] LIMAWEK — kernel arbiter — online',
    '  [ ok ] loading Linux (Arch) personality: linux 6.14.2-arch1',
  ];
  const EXT = ['🧩', '⌨️', '🖥️', '📦', '🌐', '🐧', '💾', '🍋'];

  const boot = document.getElementById('boot');
  const logEl = document.getElementById('boot-log');
  const splash = document.getElementById('boot-splash');
  const barFill = document.getElementById('boot-bar-fill');
  const extRow = document.getElementById('splash-ext');
  const desktop = document.getElementById('desktop');

  let li = 0, ei = 0, skipped = false;

  function postLine() {
    if (skipped) return;
    if (li < POST.length) {
      logEl.textContent += POST[li++] + '\n';
      setTimeout(postLine, 55 + Math.random() * 65);
    } else {
      setTimeout(splashPhase, 260);
    }
  }

  function splashPhase() {
    if (skipped) return;
    logEl.hidden = true;
    splash.hidden = false;
    extStep();
  }

  function extStep() {
    if (skipped) return;
    if (ei < EXT.length) {
      const s = document.createElement('span');
      s.textContent = EXT[ei++];
      extRow.appendChild(s);
      barFill.style.width = Math.round((ei / EXT.length) * 100) + '%';
      setTimeout(extStep, 130);
    } else {
      setTimeout(finish, 420);
    }
  }

  function finish() {
    if (desktop.hidden === false) return;      // already up
    boot.classList.add('done');
    desktop.hidden = false;
    GUI.init();                                // boots the always-on root console
    const root = GUI.root();
    // The hybrid comes up in DOS real-mode: show the DOS banner, then flex.
    setTimeout(() => {
      if (!root || !root.shell) return;
      root.shell.execute('ver');
      root.shell.execute('neofetch');
    }, 220);
    setTimeout(() => { boot.hidden = true; }, 480);
  }

  function skip() { if (!skipped) { skipped = true; finish(); } }
  boot.addEventListener('click', skip);
  window.addEventListener('keydown', function once() { skip(); window.removeEventListener('keydown', once); });
  // Works both as a standalone page and embedded in an already-loaded document.
  if (document.readyState === 'loading') window.addEventListener('DOMContentLoaded', () => setTimeout(postLine, 250));
  else setTimeout(postLine, 250);
})();
