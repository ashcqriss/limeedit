/*
 * LIMEdit BLOCK — neofetch.js
 * A funny-but-informative `neofetch` clone. The BLOCK logo is drawn as ASCII
 * art and *animated*: a hue wave rolls across the glyphs while a sparkle
 * orbits the brick. The info column mirrors the classic neofetch layout.
 *
 * Returns a DOM node so the shell can host a live animation, plus a stop().
 */
'use strict';

const Neofetch = (() => {
  // The BLOCK mascot: a lime brick with a grin. Kept to a tidy width so the
  // info column lines up beside it.
  const ART = [
    '        ▄▄████████▄▄        ',
    '     ▄██████████████████▄     ',
    '   ▟██████████████████████▙   ',
    '  ████████████████████████████  ',
    ' ██████  ▄▄▄▄▄▄▄▄▄▄▄▄  ██████ ',
    '████████  ██  ████  ██  ████████',
    '████████  ▀▀  ████  ▀▀  ████████',
    '████████              ████████',
    ' ██████  ▀▄▄▄▄▄▄▄▄▄▄▄▄▀  ██████ ',
    '  ████████████████████████████  ',
    '   ▜██████████████████████▛   ',
    '     ▀██████████████████▀     ',
    '        ▀▀████████▀▀        ',
  ];

  function infoLines() {
    const k = Kernel, s = k.system;
    s.packages = (window.Pacman && Pacman.count()) || s.packages;
    const usedGb = (k.memUsedMb() / 1024).toFixed(1);
    const totGb = (s.memTotalMb / 1024).toFixed(1);
    return [
      [s.user + '@' + s.host, 'title'],
      ['-----------------', 'rule'],
      ['OS', s.name + ' ' + s.version + ' (' + s.codename + ')'],
      ['Host', s.host + ' — BlockBook Pro'],
      ['Kernel', s.kernel],
      ['Uptime', k.uptime()],
      ['Packages', s.packages + ' (pacman)'],
      ['Shell', s.shell],
      ['DE', s.de],
      ['WM', s.wm],
      ['Terminal', 'limeterm'],
      ['CPU', s.cpu],
      ['GPU', s.gpu],
      ['Memory', usedGb + 'GiB / ' + totGb + 'GiB'],
      ['', ''],
      ['colors', 'swatch'],
    ];
  }

  // Build the element + return an animator.
  function render() {
    const wrap = document.createElement('div');
    wrap.className = 'neofetch';

    const artEl = document.createElement('pre');
    artEl.className = 'nf-art';
    wrap.appendChild(artEl);

    const infoEl = document.createElement('div');
    infoEl.className = 'nf-info';
    wrap.appendChild(infoEl);

    // Static info column
    for (const [label, val] of infoLines()) {
      const row = document.createElement('div');
      row.className = 'nf-row';
      if (val === 'title') { row.className = 'nf-title'; row.textContent = label; }
      else if (val === 'rule') { row.className = 'nf-rule'; row.textContent = label; }
      else if (val === 'swatch') {
        row.className = 'nf-swatch';
        for (let i = 0; i < 8; i++) { const b = document.createElement('span'); b.style.background = `hsl(${i * 45},70%,55%)`; row.appendChild(b); }
        const b2 = document.createElement('div'); b2.className = 'nf-swatch2';
        for (let i = 0; i < 8; i++) { const b = document.createElement('span'); b.style.background = `hsl(${i * 45},70%,72%)`; b2.appendChild(b); }
        infoEl.appendChild(row); infoEl.appendChild(b2); continue;
      } else if (label === '') { row.innerHTML = '&nbsp;'; }
      else { row.innerHTML = `<b>${label}</b><span class="nf-dot">:</span> ${val}`; }
      infoEl.appendChild(row);
    }

    // Pre-split the art into character spans so we can animate per-glyph hue.
    const rows = ART.map((line) => {
      const rowEl = document.createElement('span');
      rowEl.className = 'nf-artrow';
      const spans = [];
      for (const ch of line) {
        const sp = document.createElement('span');
        sp.textContent = ch;
        if (ch.trim()) spans.push(sp);
        rowEl.appendChild(sp);
      }
      artEl.appendChild(rowEl);
      artEl.appendChild(document.createTextNode('\n'));
      return spans;
    });

    let raf = 0, t = 0, running = true;
    // Sparkle position walks the brick outline.
    function frame() {
      if (!running) return;
      t += 0.06;
      const wave = t * 60;
      for (let r = 0; r < rows.length; r++) {
        const spans = rows[r];
        for (let c = 0; c < spans.length; c++) {
          const hue = (wave + (c * 6) + (r * 10)) % 360;
          // Lime-forward palette: bias hues toward green/yellow band.
          const h = 70 + 60 * Math.sin((hue) * Math.PI / 180);
          spans[c].style.color = `hsl(${h},75%,${52 + 10 * Math.sin(t + c * 0.3)}%)`;
        }
      }
      // Orbiting sparkle
      const allRows = rows.flat();
      allRows.forEach((s) => s.classList.remove('nf-spark'));
      const idx = Math.floor((t * 8)) % allRows.length;
      if (allRows[idx]) allRows[idx].classList.add('nf-spark');
      raf = requestAnimationFrame(frame);
    }
    raf = requestAnimationFrame(frame);

    return {
      el: wrap,
      stop() { running = false; if (raf) cancelAnimationFrame(raf); },
    };
  }

  return { render, ART };
})();
