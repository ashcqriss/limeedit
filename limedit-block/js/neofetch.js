/*
 * LIMEdit BLOCK — neofetch.js
 * An Arch-caliber `neofetch`. The logo is the classic distro-mountain rendered
 * the way real neofetch draws Arch/Gentoo — in punctuation glyphs, not solid
 * blocks — and coloured in a two-tone lime scheme with a soft highlight band
 * that sweeps down the peak (animated, but readable — no rainbow egg).
 *
 * The info column mirrors real neofetch and surfaces the *hybrid kernel*: the
 * active personality and LIMAWEK's state, so `neofetch` doubles as `kernel`.
 */
'use strict';

const Neofetch = (() => {
  // The iconic Arch-style mountain (as shipped by neofetch), lime-tinted.
  const ART = [
    '                   -`                   ',
    '                  .o+`                  ',
    '                 `ooo/                  ',
    '                `+oooo:                 ',
    '               `+oooooo:                ',
    '               -+oooooo+:               ',
    '             `/:-:++oooo+:              ',
    '            `/++++/+++++++:             ',
    '           `/++++++++++++++:            ',
    '          `/+++ooooooooooooo/`          ',
    '         ./ooosssso++osssssso+`         ',
    '        .oossssso-````/ossssss+`        ',
    '       -osssssso.      :ssssssso.       ',
    '      :osssssss/        osssso+++.      ',
    '     /ossssssss/        +ssssooo/-      ',
    '   `/ossssso+/:-        -:/+osssso+-    ',
    '  `+sso+:-`                 `.-/+oso:   ',
    ' `++:.                           `-/+/  ',
    ' .`                                 `/  ',
  ];

  function infoLines() {
    const k = Kernel, s = k.system, p = k.LIMAWEK.personality();
    s.packages = (window.Pacman && Pacman.count()) || s.packages;
    const usedGb = (k.memUsedMb() / 1024).toFixed(1), totGb = (s.memTotalMb / 1024).toFixed(1);
    return [
      [s.user + '@' + s.host, 'title'],
      ['-----------------', 'rule'],
      ['OS', s.name + ' ' + s.version + ' (' + s.codename + ') x86_64'],
      ['Host', 'BlockBook Pro'],
      ['Kernel', 'archdos-hybrid → ' + p.name + ' ' + p.version],
      ['Arbiter', 'LIMAWEK · ' + (k.LIMAWEK.isLocked() ? 'locked' : 'arbitrating') + ' · ' + k.LIMAWEK.log().length + ' switches'],
      ['Uptime', k.uptime()],
      ['Packages', s.packages + ' (pacman)'],
      ['Shell', s.shell],
      ['DE / WM', s.de + ' · ' + s.wm],
      ['Terminal', 'limeterm (root console)'],
      ['CPU', s.cpu],
      ['GPU', s.gpu],
      ['Memory', usedGb + 'GiB / ' + totGb + 'GiB'],
      ['', ''],
      ['colors', 'swatch'],
    ];
  }

  function render() {
    const wrap = document.createElement('div');
    wrap.className = 'neofetch';
    const artEl = document.createElement('pre'); artEl.className = 'nf-art'; wrap.appendChild(artEl);
    const infoEl = document.createElement('div'); infoEl.className = 'nf-info'; wrap.appendChild(infoEl);

    for (const [label, val] of infoLines()) {
      const row = document.createElement('div'); row.className = 'nf-row';
      if (val === 'title') { row.className = 'nf-title'; row.textContent = label; }
      else if (val === 'rule') { row.className = 'nf-rule'; row.textContent = label; }
      else if (val === 'swatch') {
        row.className = 'nf-swatch';
        for (let i = 0; i < 8; i++) { const b = document.createElement('span'); b.style.background = `hsl(${96 + i * 6},65%,${34 + i * 5}%)`; row.appendChild(b); }
        infoEl.appendChild(row); continue;
      } else if (label === '') { row.innerHTML = '&nbsp;'; }
      else { row.innerHTML = `<b>${label}</b><span class="nf-dot">:</span> ${val}`; }
      infoEl.appendChild(row);
    }

    // Per-glyph spans so the highlight band can sweep the peak.
    const rows = ART.map((line) => {
      const rowEl = document.createElement('span'); rowEl.className = 'nf-artrow';
      const spans = [];
      for (const ch of line) { const sp = document.createElement('span'); sp.textContent = ch; if (ch.trim()) spans.push({ sp, r: 0 }); rowEl.appendChild(sp); }
      artEl.appendChild(rowEl); artEl.appendChild(document.createTextNode('\n'));
      return spans;
    });

    let raf = 0, t = 0, running = true;
    function frame() {
      if (!running) return;
      t += 0.03;
      const sweep = (t % 2) / 2 * rows.length;   // highlight band position (row)
      for (let r = 0; r < rows.length; r++) {
        const dist = Math.abs(r - sweep);
        const lift = Math.max(0, 1 - dist / 3);   // brighten near the band
        // two-tone lime: base rows darker, peak (upper) lighter
        const baseL = 34 + (rows.length - r) * 1.4;
        const L = Math.min(72, baseL + lift * 26);
        const col = `hsl(${96 - r},70%,${L}%)`;
        for (const { sp } of rows[r]) sp.style.color = col;
      }
      raf = requestAnimationFrame(frame);
    }
    raf = requestAnimationFrame(frame);
    return { el: wrap, stop() { running = false; if (raf) cancelAnimationFrame(raf); } };
  }

  return { render, ART };
})();
window.Neofetch = Neofetch;
