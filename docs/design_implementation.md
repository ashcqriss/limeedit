# LimeEdit design implementation status

Tracks implementation of the brief in [`design.md`](design.md) against the
codebase. The palette source of truth is [`palette.md`](palette.md).

## Implemented

- **Edemint Liquid Glass light + dark** as the default theme
  (`edemint-glass-light` / `edemint-glass-dark`), registered in the theme
  registry (`public/js/app.js`) with matching Monaco editor themes.
- **Flat black/white canvas.** `body` is pure `#FFFFFF` (light) or `#000000`
  (dark) under the Edemint themes — no gradient, no wallpaper. The editor
  surface is opaque white/black for maximum text contrast.
- **Liquid Glass chrome**, generalized behind a `data-glass` attribute on
  `<html>` (any theme registered with `glass: true` gets it): backdrop blur +
  saturation on every chrome surface, specular top/bottom inner edges on
  floating panels, hairline translucent borders, large soft shadows.
- **Blue-led palette tokens** (`public/css/limeedit.css`): ultramarine accent
  and selections, azure caret/focus (light), turquoise focus (dark),
  turquoise search-match highlights, periwinkle dark-mode accents, navy-tinted
  light-mode hairlines/shadows.
- **Capsule geometry** for buttons, inputs, toggles, and the function popup;
  18 px radii on dialogs/panels (Edemint rounded-rectangle shape language).
- **`panelv` close semantics.** Every ✕ control (document close, drawer/panel/
  overlay close) turns `#E31515` red on hover, glyph retained; the RAW badge
  uses the same red.
- **Eco-green accents** on the extension "raw" badge (C3 over plant-950 text).
- **macOS-style motion**, gated by the Smooth Animations toggle and
  `prefers-reduced-motion`: spring pop-in for menus, dialogs, and panels
  (overshoot easing), hover lift and press compression on controls, plus the
  pre-existing eased hovers, drawer slide, and Monaco smooth caret/scrolling.
- **Focus rings** (`:focus-visible`) in azure (light) / turquoise (dark).
- **No-flash boot.** The pre-paint script in `index.html` applies the saved
  (or default) theme and the `data-glass` flag before first render.

## Deliberately pending

- **Final Edemint logo, icon set, cursor set, and fonts** — no final logo
  exists yet; LimeEdit keeps its ✏️ mark and system font stack until the
  Edemint identity assets land.
- **Yellow (hide) and green (expand) `panelv` controls** — LimeEdit currently
  has no minimizable or expandable panel surfaces; the colors are reserved
  (see `palette.md`, semantic exceptions).
- **The `on_off2` power motif** — no power control exists in a web editor;
  reserved.
- **Responsive / mobile layouts** (`mobileratioqo`, `mobile_dock_ratio_2`) —
  LimeEdit is desktop-first; the narrow-aspect blue-led homescreen behavior
  does not yet apply.
- **The `dock` tap-in-void overlay** with its four semi-transparent
  overlapping lines — the closest existing analogues are the Open Quickly and
  command-palette overlays.
- Remaining prototype loads arriving in later briefs.

## Notes

- The previous default (BBEdit Liquid Glass, with its wallpaper) and all other
  themes remain selectable; the Edemint brief changes the default, it does not
  remove history.
- Users who had explicitly saved a theme keep it — the default only applies to
  fresh profiles (`localStorage` unset).
