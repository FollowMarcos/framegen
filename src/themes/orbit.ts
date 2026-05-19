// Inspired by the "Orbit" dashboard aesthetic — pitch-black canvas, vivid
// orange accent reserved for the single most important state on screen
// (the active row, the call-to-action, the highlighted bar in a chart).
// Pairs with monospaced labels (COMPANY, DESIGNER, "vs last month") for
// type metadata — which the components handle via font-mono utility
// classes, not via the theme.
const theme = `---
version: alpha
name: Orbit
description: Pitch-black canvas with a vivid orange accent. High-contrast, dashboard-first.
colors:
  primary: "#f5f5f5"
  secondary: "#7a7a7a"
  tertiary: "#ff7a1a"
  neutral: "#0a0a0a"
  surface: "#161616"
  on-primary: "#0a0a0a"
---
## Overview

Deep, near-pure black canvas. A single vivid orange drives interaction —
the active nav item, the highlighted bar in a chart, the primary button.
Everything else stays in monochrome so the orange always has work to do.

## Colors

- **Primary (\`#f5f5f5\`):** Foreground text. Pure-ish white, never #fff
  exactly — gives the eye a soft edge against the black canvas.
- **Secondary (\`#7a7a7a\`):** Muted text, captions, "vs last month"
  metadata.
- **Tertiary (\`#ff7a1a\`):** The single accent. Save it for one element
  per surface.
- **Neutral (\`#0a0a0a\`):** Page background.
- **Surface (\`#161616\`):** Cards, modals, popovers.

## Do's and Don'ts

- **Do** use the orange sparingly — it should be the brightest pixel in
  view at any given moment.
- **Don't** introduce a second accent. The whole point of this theme is
  that orange means "this matters."
`;

export default theme;
