import type {
  TextOverlay,
  TextShadow,
  TextStroke,
} from "./types";

// Curated text-effect presets. Each preset is a *function* of the
// current overlay so presets that depend on the text colour (Neon,
// Glow, Sticker) can pick up the user's choice instead of hard-coding
// a swatch the user didn't ask for.
//
// A preset returns the `stroke` and `shadow` fields it wants applied;
// the panel merges these into the overlay so the user can still tweak
// individual values after applying. `null` means "clear that effect".

export type TextEffectPreset = {
  id: string;
  label: string;
  apply: (overlay: TextOverlay) => {
    stroke: TextStroke | null;
    shadow: TextShadow | null;
  };
};

export const TEXT_EFFECT_PRESETS: TextEffectPreset[] = [
  {
    id: "none",
    label: "None",
    apply: () => ({ stroke: null, shadow: null }),
  },
  {
    id: "shadow",
    label: "Shadow",
    apply: () => ({
      stroke: null,
      shadow: {
        color: "#000000",
        blur: 8,
        offsetX: 2,
        offsetY: 4,
        opacity: 0.55,
      },
    }),
  },
  {
    id: "outline-black",
    label: "Outline",
    apply: (o) => ({
      stroke: { color: "#000000", width: Math.max(2, o.fontSize * 0.04) },
      shadow: null,
    }),
  },
  {
    id: "outline-white",
    label: "White outline",
    apply: (o) => ({
      stroke: { color: "#ffffff", width: Math.max(2, o.fontSize * 0.04) },
      shadow: null,
    }),
  },
  {
    id: "neon",
    label: "Neon",
    // Glow uses the text's own fill colour so changing the colour
    // updates the glow too. The stroke is a slightly desaturated
    // sibling to keep the outline readable when the fill is bright.
    apply: (o) => ({
      stroke: { color: o.color, width: Math.max(1.5, o.fontSize * 0.025) },
      shadow: {
        color: o.color,
        blur: Math.max(16, o.fontSize * 0.35),
        offsetX: 0,
        offsetY: 0,
        opacity: 0.95,
      },
    }),
  },
  {
    id: "sticker",
    label: "Sticker",
    // Heavy white outline + soft shadow — the classic IG sticker.
    apply: (o) => ({
      stroke: { color: "#ffffff", width: Math.max(4, o.fontSize * 0.08) },
      shadow: {
        color: "#000000",
        blur: 12,
        offsetX: 0,
        offsetY: 4,
        opacity: 0.35,
      },
    }),
  },
  {
    id: "glow",
    label: "Glow",
    apply: (o) => ({
      stroke: null,
      shadow: {
        color: o.color,
        blur: Math.max(24, o.fontSize * 0.5),
        offsetX: 0,
        offsetY: 0,
        opacity: 0.8,
      },
    }),
  },
  {
    id: "long-shadow",
    label: "Long shadow",
    // Tight, opaque shadow offset down-right — the 2010s "Material"
    // long-shadow look, useful for thumbnails / titles.
    apply: () => ({
      stroke: null,
      shadow: {
        color: "#000000",
        blur: 0,
        offsetX: 6,
        offsetY: 6,
        opacity: 1,
      },
    }),
  },
];

// Heuristic match of the overlay's current effect fields against the
// preset library — used to highlight the active swatch in the panel
// when the user re-selects a text layer. Approximate by checking just
// the stroke colour and shadow presence, since presets store derived
// numbers that change with fontSize.
export function detectActivePresetId(overlay: TextOverlay): string {
  if (!overlay.stroke && !overlay.shadow) return "none";
  if (overlay.stroke && overlay.stroke.color === "#000000" && !overlay.shadow)
    return "outline-black";
  if (overlay.stroke && overlay.stroke.color === "#ffffff" && !overlay.shadow)
    return "outline-white";
  if (
    overlay.stroke &&
    overlay.stroke.color === "#ffffff" &&
    overlay.shadow &&
    overlay.shadow.color === "#000000"
  )
    return "sticker";
  if (overlay.stroke && overlay.shadow && overlay.shadow.color === overlay.color)
    return "neon";
  if (
    !overlay.stroke &&
    overlay.shadow &&
    overlay.shadow.color === overlay.color &&
    overlay.shadow.blur > 16
  )
    return "glow";
  if (
    !overlay.stroke &&
    overlay.shadow &&
    overlay.shadow.color === "#000000" &&
    overlay.shadow.blur === 0
  )
    return "long-shadow";
  if (
    !overlay.stroke &&
    overlay.shadow &&
    overlay.shadow.color === "#000000"
  )
    return "shadow";
  return "custom";
}
