// Curated Google Fonts catalogue for the editor's text overlays.
//
// The catalogue is deliberately small — too many fonts paralyses the
// picker, and every entry costs network bytes on first load. We picked
// a spread that covers the styles people actually reach for in a
// "make this graphic look good" workflow: a few solid sans-serifs,
// a couple of serifs, marker / handwriting, and a few display oddballs
// for variety. Inter ships with the app so it stays the default.

export type FontCategory =
  | "Sans"
  | "Serif"
  | "Display"
  | "Handwriting"
  | "Mono";

export type FontDef = {
  // The CSS `font-family` value. Multi-word names like "Bebas Neue" must
  // stay unquoted here — Konva quotes them itself when it builds the
  // font shorthand.
  family: string;
  category: FontCategory;
  // Weights we want loaded. Keeping this small reduces the @font-face
  // payload; users can pick any of these via the weight selector.
  weights: number[];
  // True if the font is already available without loading anything —
  // either it's bundled with the app (Inter) or it's a system font we
  // know all major OSes ship. Listed here so the loader can skip them.
  builtIn?: boolean;
};

export const FONTS: FontDef[] = [
  // Sans — workhorse fonts for headlines + body
  { family: "Inter", category: "Sans", weights: [400, 500, 600, 700], builtIn: true },
  { family: "Montserrat", category: "Sans", weights: [400, 600, 700] },
  { family: "Poppins", category: "Sans", weights: [400, 600, 700] },
  { family: "Roboto", category: "Sans", weights: [400, 500, 700] },
  { family: "Archivo Black", category: "Sans", weights: [400] },
  { family: "Anton", category: "Sans", weights: [400] },
  { family: "Oswald", category: "Sans", weights: [400, 500, 700] },
  { family: "Bebas Neue", category: "Sans", weights: [400] },

  // Serif — for editorial / luxe vibes
  { family: "Playfair Display", category: "Serif", weights: [400, 700] },
  { family: "DM Serif Display", category: "Serif", weights: [400] },
  { family: "Cormorant Garamond", category: "Serif", weights: [400, 600] },

  // Display — bold / weird / poster-y
  { family: "Bungee", category: "Display", weights: [400] },
  { family: "Righteous", category: "Display", weights: [400] },
  { family: "Press Start 2P", category: "Display", weights: [400] },
  { family: "Bowlby One", category: "Display", weights: [400] },
  { family: "Russo One", category: "Display", weights: [400] },

  // Handwriting — TikTok caption energy
  { family: "Caveat", category: "Handwriting", weights: [400, 700] },
  { family: "Permanent Marker", category: "Handwriting", weights: [400] },
  { family: "Pacifico", category: "Handwriting", weights: [400] },
  { family: "Lobster", category: "Handwriting", weights: [400] },
  { family: "Shadows Into Light", category: "Handwriting", weights: [400] },
  { family: "Dancing Script", category: "Handwriting", weights: [400, 700] },
  { family: "Satisfy", category: "Handwriting", weights: [400] },

  // Mono
  { family: "JetBrains Mono", category: "Mono", weights: [400, 700] },
  { family: "Major Mono Display", category: "Mono", weights: [400] },
];

// Categorised view used by the font picker UI.
export const FONTS_BY_CATEGORY: Record<FontCategory, FontDef[]> = {
  Sans: FONTS.filter((f) => f.category === "Sans"),
  Serif: FONTS.filter((f) => f.category === "Serif"),
  Display: FONTS.filter((f) => f.category === "Display"),
  Handwriting: FONTS.filter((f) => f.category === "Handwriting"),
  Mono: FONTS.filter((f) => f.category === "Mono"),
};

export const CATEGORY_ORDER: FontCategory[] = [
  "Sans",
  "Serif",
  "Display",
  "Handwriting",
  "Mono",
];
