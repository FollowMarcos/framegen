// Shape of an editor document. A doc is a single editable canvas:
// one optional base image (sitting at the bottom, with a non-destructive
// adjustment stack applied to it) plus a stack of overlays (text and
// images) painted on top. The whole thing flattens to a single PNG at
// export time.

export type AdjustmentStack = {
  // All sliders are normalized to [-1, 1] except sharpen ([0, 1]) and
  // rotate (cardinal degrees). Zero is the identity for every entry —
  // an all-zero stack must render byte-identical to the base.
  exposure: number;
  contrast: number;
  highlights: number;
  shadows: number;
  saturation: number;
  vibrance: number;
  temperature: number;
  tint: number;
  sharpen: number;
  rotate: 0 | 90 | 180 | 270;
};

export const ZERO_ADJUSTMENTS: AdjustmentStack = {
  exposure: 0,
  contrast: 0,
  highlights: 0,
  shadows: 0,
  saturation: 0,
  vibrance: 0,
  temperature: 0,
  tint: 0,
  sharpen: 0,
  rotate: 0,
};

export type BaseLayer = {
  assetUrl: string;
  naturalWidth: number;
  naturalHeight: number;
  // null means "no crop" — render the entire image. Coordinates are in
  // the base's natural pixel space so the crop is resolution-independent.
  crop: { x: number; y: number; w: number; h: number } | null;
};

export type OverlayBase = {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  opacity: number;
  locked: boolean;
  hidden: boolean;
};

export type ImageOverlay = OverlayBase & {
  kind: "image";
  assetUrl: string;
  naturalWidth: number;
  naturalHeight: number;
};

// Decorative effects layered on top of the glyphs themselves. `null`
// means "no effect"; the optional shapes mirror the Konva fields they
// drive so we can pass them through without translation. Effect
// presets in the UI assemble these into common looks (drop shadow,
// outline, neon, sticker, glow). Keeping them as discrete props rather
// than a `preset` enum lets users tweak after picking a preset.
export type TextStroke = {
  width: number;
  color: string;
};

export type TextShadow = {
  color: string;
  blur: number;
  offsetX: number;
  offsetY: number;
  opacity: number;
};

export type TextOverlay = OverlayBase & {
  kind: "text";
  text: string;
  fontFamily: string;
  fontSize: number;
  fontWeight: 400 | 500 | 600 | 700;
  italic: boolean;
  underline: boolean;
  color: string;
  align: "left" | "center" | "right";
  lineHeight: number;
  letterSpacing: number;
  // Both optional so existing docs (saved before this field existed)
  // load cleanly — undefined reads as "no effect".
  stroke?: TextStroke | null;
  shadow?: TextShadow | null;
};

export type Overlay = ImageOverlay | TextOverlay;

export type EditorDoc = {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  canvas: { width: number; height: number; background: string };
  base: BaseLayer | null;
  adjustments: AdjustmentStack;
  // Overlays are stored bottom-to-top. The last entry renders on top.
  overlays: Overlay[];
  // The currently selected overlay id, kept in the doc so a reload
  // restores the selection. Null when nothing or only the base is
  // selected.
  selectedId: string | null;
};

// Sidecar shape returned by the list endpoint — strips the full overlay
// array to keep the listing payload small.
export type EditorDocSummary = {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  thumbUrl: string | null;
  width: number;
  height: number;
};
