# LimeEdit palette — the Edemint color system

This file records the authoritative Edemint palette as applied to LimeEdit's
**Edemint Liquid Glass** default theme. Colors were measured from the original
`color_palette` reference image (the color-family and hierarchy authority for
the whole design). An app or component uses an appropriate subset; the entire
palette is never required on one surface.

The one rule that overrides everything else: **the canvas is flat pure white
(light mode) or pure black (dark mode) — no gradient, no wallpaper.** Every
color below lives on the glass and content layers that float over that canvas.

## Diagram order

The palette diagram is read left to right. The original naming contains two
"8th" references, so `C8a` means the last azure/ultramarine complex and `C8b`
the second-from-left dark-blue complex.

### C1 — first: ultramarine core (L1)

| Token | Hex |
|---|---|
| `ultramarine-500` | `#2001FF` |
| `ultramarine-400` | `#6D58FF` |
| `ultramarine-200` | `#AEA3FF` |

Level-1 family: the primary accent of the design language. In LimeEdit it is
the menu-selection color, the sidebar selection tint, the editor selection,
light-mode keywords, and the dirty-dot.

### C8b — second: rare dark blue / deep indigo (L5)

| Token | Hex |
|---|---|
| `indigo-900` | `#261B67` |
| `indigo-800` | `#2C2656` |

Despite its position near the start of the diagram, C8b belongs to the last
importance level. It is not a general background or common anchor.

### C3 — third: bright eco green (L3)

| Token | Hex |
|---|---|
| `eco-400` | `#45E289` |
| `eco-300` | `#88D0A8` |
| `eco-200` | `#819C8D` |

Secondary component accents and bright blue-to-green transitions. In LimeEdit:
the extension "raw" badge and dark-mode strings.

### C4 — fourth: dark plant green (L2)

| Token | Hex |
|---|---|
| `plant-700` | `#21920F` |
| `plant-900` | `#0D6300` |
| `plant-950` | `#093A02` |

Anchored secondary support. In LimeEdit: light-mode strings and the text on
eco-green badges.

### C5 — fifth: darkest green (L4)

| Token | Hex |
|---|---|
| `forest-ink` | `#162D13` |
| `forest-charcoal` | `#242E23` |
| `forest-deep` | `#253C22` |
| `forest-muted` | `#2C5126` |

Rare and application-specific. Unused by the default LimeEdit shell.

### C6 — sixth: navy anchor (L2)

| Token | Hex |
|---|---|
| `navy-700` | `#002C89` |
| `navy-950` | `#171E54` |

The smallest complex; a level-2 anchor. In LimeEdit: light-mode types and the
hairline borders/shadows of the light glass chrome (as low-alpha tints).

### C7 — seventh: turquoise support (L3)

| Token | Hex |
|---|---|
| `turquoise-200` | `#74FBEA` |
| `turquoise-300` | `#1EE5CE` |
| `turquoise-500` | `#04A89D` |
| `turquoise-700` | `#007C76` |

Level-3 supporter. In LimeEdit: search-match highlights, dark-mode focus
rings, dark-mode types and numbers.

### C8a — last: azure and ultramarine core (L1)

| Token | Hex |
|---|---|
| `electric-blue` | `#0007FF` |
| `azure-500` | `#0080FF` |

Level-1 family, directly integrated into the UI: the caret, operators, the
light-mode focus ring, and the cool accent.

## Importance pyramid

| Tier | Use | Families |
|---|---|---|
| **L1** | Deeply integrated: selections, accents, caret, design language. Bright colors lead. | C1 ultramarine, C8a azure |
| **L2** | Common anchored support. | C6 navy, C4 plant green |
| **L3** | Supporting colors for selected components. | C7 turquoise, C3 eco green |
| **L4** | Rare, application-specific. | C5 darkest greens |
| **L5** | Backup colors for particular functions only. | C8b indigo + the warm/pink/earth set |

## Secondary reference colors (L5 / special purpose)

| Token | Hex | Intended role |
|---|---|---|
| `magenta` | `#FF00C8` | Rare emphasis and prototype annotations |
| `gold` | `#B67E29` | Warm secondary surface |
| `maroon` | `#750303` | Warm dark surface |
| `warm-red` | `#B32B2B` | Warm secondary surface |
| `dusty-rose` | `#A45455` | Warm muted surface |
| `teal` | `#00816D` | Selected mobile/component reference |

## Confirmed semantic exceptions

`panelv` (final artwork, not a prototype) defines window-control semantics
independently of the general hierarchy. **These semantics override macOS-style
ordering or assumptions**: green expands, yellow hides, red closes — and each
carries a glyph, so the state is never encoded by color alone.

| Action | Hex | LimeEdit use |
|---|---|---|
| Expand / fullscreen | `#5BA453` | reserved (no expandable surfaces yet) |
| Hide / minimize | `#E9DE51` | reserved (no minimizable surfaces yet) |
| Close | `#E31515` | hover state of every ✕ close control; the RAW badge |

`on_off2` (also final artwork) uses `#F4D956` with `#3F136A` as the power
motif. LimeEdit has no power control; the pair is reserved and must not leak
into general chrome.

## LimeEdit UI tokens

The CSS custom properties of the default theme
(`public/css/limeedit.css`, `edemint-glass-*` blocks):

```css
/* light */                          /* dark */
--editor-bg: #ffffff;                --editor-bg: #000000;
--accent: #2001FF;                   --accent: #6D58FF;
--accent-cool: #0080FF;              --accent-cool: #0080FF;
--focus: #0080FF;                    --focus: #74FBEA;
--dirty: #2001FF;                    --dirty: #AEA3FF;
--menu-hover: rgba(32,1,255,.9);     --menu-hover: rgba(32,1,255,.9);
--match-bg: rgba(30,229,206,.4);     --match-bg: rgba(4,168,157,.55);
--sidebar-active: rgba(32,1,255,.15);--sidebar-active: rgba(109,88,255,.32);
```

The glass surfaces themselves are neutral white/black at low alpha (plus
`backdrop-filter`), so the palette reads as *accents on glass*, never as tinted
panels competing with content.

## Rules

- Lead with C1 and C8a. The design must read blue-first at a glance.
- Use C6 navy and C4 plant green as anchors; C3/C7 selectively for components,
  accents, and controlled transitions.
- Reserve C5, C8b, and the warm colors for rare/application-specific uses.
- The canvas is `#FFFFFF` or `#000000`, flat. Never a gradient, never an image.
- Match neighboring colors by hue and lightness; cross-family movement uses a
  deliberate transition (bright blue → bright green), not an abrupt jump.
- Do not treat yellow, pink, gold, red, or green prototype fills as defaults
  unless a component description explicitly assigns that meaning (`panelv` and
  `on_off2` are the two confirmed exceptions).
- Never encode state by color alone; retain shape, symbol, or text.
