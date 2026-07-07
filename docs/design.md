# LimeEdit design reference — Edemint Liquid Glass

This document is the authoritative brief for LimeEdit's default look. It
applies the **Edemint design system** (from the Edemint project's prototypes
and palette) to LimeEdit, rendered in the visual language of **Apple's Liquid
Glass**. The measured palette and its hierarchy live in
[`palette.md`](palette.md); the implementation state in
[`design_implementation.md`](design_implementation.md).

## The three layers

1. **Canvas.** Flat, pure white `#FFFFFF` in light mode, pure black `#000000`
   in dark mode. **No gradient, no wallpaper, no texture — ever.** The canvas
   is silence; everything expressive happens above it.
2. **Content.** The editor surface. Opaque white/black, so text is maximally
   readable; syntax color is where the palette's blue-led hierarchy shows.
3. **Glass.** All chrome — menu bar, sidebar, navigation bar, status bar,
   menus, dialogs, panels — is frosted, translucent liquid glass floating over
   the two layers below.

## The glass material

Modeled on Apple's Liquid Glass (the dynamic material of macOS/iOS 26):

- **Translucency + blur.** Surfaces are neutral white/black at low alpha with
  `backdrop-filter: blur(24px) saturate(185%)`, so whatever sits behind them
  reads through, softened and enriched.
- **Specular edges.** Every floating surface carries a bright top inner
  highlight and a fainter bottom inner edge — the "lensing" read of light
  bending through glass — plus a hairline translucent border.
- **Floating controls layer.** Menus, dialogs and panels sit visually *above*
  the app with large, soft shadows; they are objects, not regions.
- **Rounded geometry.** Rounded rectangles are the default shape language
  (from the Edemint prototypes). Panels use 16–18 px radii; controls (buttons,
  inputs, popups) are full **capsules**. Placeholder app boxes in the
  prototypes are intentionally oversized; production controls are smaller.
- **Adaptive.** The material is defined for light and dark; the dark variant
  dims its speculars rather than merely inverting colors.

## Color

Blue leads. Ultramarine `#2001FF` and azure `#0080FF` are the level-1 accents
(selection, caret, focus, primary actions); navy and plant green anchor;
eco green and turquoise support; warm colors are reserved. The full measured
families, the importance pyramid, and the usage rules are in
[`palette.md`](palette.md) — that file is the color authority.

## Confirmed semantics (final artwork)

Two of the Edemint references are **finished designs, not prototypes**, and
their meanings are binding:

- **`panelv` — window actions.** Green (`#5BA453`) expands or enters
  fullscreen, yellow (`#E9DE51`) hides/minimizes, red (`#E31515`) closes.
  These semantics override macOS ordering or assumptions. Each control carries
  a glyph (chevrons, pill, ✕) so the action is never communicated by color
  alone. In LimeEdit every ✕ close control adopts the red on hover; yellow and
  green are reserved until minimizable/expandable surfaces exist.
- **`on_off2` — power motif.** The yellow ring (`#F4D956`) with the violet
  wave (`#3F136A`) is the expandable power/standby control. LimeEdit has no
  power control; the motif is reserved and must not leak into general chrome.

## Prototype references (approximate direction)

The remaining references are prototypes: geometry, hierarchy, placement, and
interaction roles are authoritative; their flat fills are role markers, not
production colors.

| Reference | Meaning carried into LimeEdit |
|---|---|
| `color_palette` | The color authority — see `palette.md`. |
| `main_homescreen` | A persistent left rail of important items (LimeEdit: the sidebar of open documents and files); a status region kept separate from content (status bar); an expandable search/completer (Open Quickly, `⌘P`). |
| `dock` | Overlay surfaces summoned on demand over empty space (LimeEdit: the command palette and Open Quickly overlays). |
| `mobileratioqo` / `mobile_dock_ratio_2` | Blue-led narrow-screen behavior; deferred — LimeEdit is desktop-first. |
| `login_screen` | Persistent time/status above, centered identity, compact input (LimeEdit: the account panel's avatar-first hierarchy). |

## Motion — like macOS

Animation is a property of the glass, not decoration:

- Floating surfaces **materialize with a spring**: a small scale/translate
  overshoot (`cubic-bezier(0.34, 1.4, 0.64, 1)` family), the way macOS pops
  menus and sheets. Nothing merely blinks into existence.
- Controls **respond to touch**: a gentle lift on hover, a compress on press.
- Hover/selection states ease; the caret glides; scrolling has momentum
  (Monaco's smooth caret + smooth scrolling).
- Every animation honors two kill-switches: the user's **View ▸ Smooth
  Animations** toggle and the OS `prefers-reduced-motion`. Both reduce the UI
  to instant transitions without losing any state information.

## Non-negotiables

- Canvas: `#FFFFFF` / `#000000`, flat. No gradients on the background.
- Blue-first palette per `palette.md`; warm colors only where semantically
  assigned.
- Rounded-rectangle/capsule geometry throughout.
- State must never be communicated by color alone; retain symbols, shape, or
  text.
- Motion must degrade gracefully to no motion.

## Relationship to other LimeEdit themes

Edemint Liquid Glass (light + dark) is the default. The earlier themes —
BBEdit Liquid Glass (wallpapered glass), the flat Zed themes, the Zed One
palettes, and the original LimeEdit light/dark — remain available from
**View ▸ Color Theme…** and are unaffected by this brief.
