// Aspect-ratio presets for the post composer.
//
// "Original" is the default — most users posting an AI image want the
// frame they generated, not a forced crop. The fixed-aspect presets
// (square, portrait, landscape, story) follow Instagram's "natural"
// upload resolutions (1080 long edge) since anything larger gets
// re-encoded on upload anyway.

export type Aspect = {
  id: "original" | "square" | "portrait" | "landscape" | "story";
  label: string;
  // Human-readable ratio shown next to the label.
  ratioLabel: string;
  // Output pixel dimensions. When undefined ("Original"), the renderer
  // uses the source image's natural dimensions instead.
  width?: number;
  height?: number;
};

export const ASPECTS: Aspect[] = [
  { id: "original", label: "Original", ratioLabel: "as-is" },
  { id: "square", label: "Square", ratioLabel: "1:1", width: 1080, height: 1080 },
  { id: "portrait", label: "Portrait", ratioLabel: "4:5", width: 1080, height: 1350 },
  { id: "landscape", label: "Landscape", ratioLabel: "1.91:1", width: 1080, height: 566 },
  { id: "story", label: "Story", ratioLabel: "9:16", width: 1080, height: 1920 },
];

export const DEFAULT_ASPECT: Aspect = ASPECTS[0];
