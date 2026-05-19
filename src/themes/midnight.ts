// Theme source: design.md format (https://designdotmd.directory). Drop in a
// new theme by copying its markdown into a new file alongside this one and
// adding it to src/lib/themes.ts.
const theme = `---
version: alpha
name: Midnight
description: Default dark theme. Deep blacks with a lavender accent.
colors:
  primary: "#f5f5f7"
  secondary: "#86868d"
  tertiary: "#a78bfa"
  neutral: "#0a0a0b"
  surface: "#111114"
  on-primary: "#0a0a0b"
---
## Overview

The default. Near-black canvas, soft white text, a lavender accent reserved
for the one action that matters per surface.

## Colors

- **Primary (\`#f5f5f7\`):** Foreground text.
- **Secondary (\`#86868d\`):** Muted text, borders, captions.
- **Tertiary (\`#a78bfa\`):** Interaction driver — the primary button, focus.
- **Neutral (\`#0a0a0b\`):** Page background.
- **Surface (\`#111114\`):** Cards, modals, popovers.
`;

export default theme;
