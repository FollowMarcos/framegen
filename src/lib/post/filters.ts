// CSS-filter presets for the post composer.
//
// Each preset is a single `filter` string applied both to the preview
// <img> and baked into the exported PNG via ctx.filter. The names lean
// "what it does to the photo" rather than camera-brand-lookalikes —
// easier to scan when you're picking quickly.
//
// Values are tuned for strong, characterful looks: subtle filters
// don't sell the difference in a 64-px chip, so each preset commits
// hard enough that the preview tells you what you're picking.

export type FilterPreset = {
  id: string;
  label: string;
  filter: string;
};

export const FILTER_PRESETS: FilterPreset[] = [
  { id: "none", label: "Original", filter: "none" },

  // Color presets — most-used pair on the left so they sit first
  // in the grid.
  {
    id: "crisp",
    label: "Crisp",
    // Clean contrast + saturation lift; the default-feel polish for
    // anything that came out a hair flat.
    filter: "contrast(1.12) saturate(1.18) brightness(1.02)",
  },
  {
    id: "vivid",
    label: "Vivid",
    filter: "saturate(1.55) contrast(1.12) brightness(1.02)",
  },
  {
    id: "drama",
    label: "Drama",
    // Heavy contrast + sat — useful for portraits / album-cover energy.
    filter: "contrast(1.35) saturate(1.4)",
  },

  // Temperature shifts.
  {
    id: "warm",
    label: "Warm",
    filter:
      "sepia(0.25) saturate(1.35) hue-rotate(-12deg) brightness(1.06)",
  },
  {
    id: "cool",
    label: "Cool",
    filter:
      "contrast(1.05) saturate(1.1) hue-rotate(18deg) brightness(1.04)",
  },

  // Faded / soft / cream — three flavours of "less saturated, lifted
  // shadows" with different colour casts.
  {
    id: "cream",
    label: "Cream",
    filter: "sepia(0.18) saturate(0.92) brightness(1.1) contrast(0.95)",
  },
  {
    id: "faded",
    label: "Faded",
    filter: "contrast(0.82) saturate(0.72) brightness(1.1) sepia(0.1)",
  },
  {
    id: "dreamy",
    label: "Dreamy",
    filter: "saturate(0.85) brightness(1.12) contrast(0.88) sepia(0.08)",
  },

  // Vintage / aged.
  {
    id: "vintage",
    label: "Vintage",
    filter: "sepia(0.5) saturate(0.82) contrast(1.12) brightness(0.94)",
  },
  {
    id: "moody",
    label: "Moody",
    // Dark + desaturated — works on landscapes / interiors.
    filter: "contrast(1.28) saturate(0.78) brightness(0.86)",
  },

  // Monochrome pair.
  { id: "mono", label: "Mono", filter: "saturate(0) contrast(1.08)" },
  {
    id: "noir",
    label: "Noir",
    filter: "saturate(0) contrast(1.42) brightness(0.92)",
  },
];

export const DEFAULT_FILTER: FilterPreset = FILTER_PRESETS[0];
