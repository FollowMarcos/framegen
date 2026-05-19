// Self-hosted Google Fonts for the editor.
//
// next/font/google fetches each font at build time and serves it from
// the same origin as the app — no third-party CDN, no offline failure
// mode, no privacy footgun. The trade-off is that every font has to
// be imported statically at module top level (the loader can't run at
// runtime), which is why this file is one long list of declarations.
//
// Konva renders text into a canvas, which means it needs the *real*
// resolved family string (e.g. "__Inter_abc123, __Inter_Fallback_abc123")
// rather than the human label. `resolveFontFamily` does that lookup so
// the rest of the app can keep storing the friendly name on overlays.

import {
  Anton,
  Archivo_Black,
  Bebas_Neue,
  Bowlby_One,
  Bungee,
  Caveat,
  Cormorant_Garamond,
  Dancing_Script,
  DM_Serif_Display,
  Inter,
  JetBrains_Mono,
  Lobster,
  Major_Mono_Display,
  Montserrat,
  Oswald,
  Pacifico,
  Permanent_Marker,
  Playfair_Display,
  Poppins,
  Press_Start_2P,
  Righteous,
  Roboto,
  Russo_One,
  Satisfy,
  Shadows_Into_Light,
} from "next/font/google";

const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

const montserrat = Montserrat({
  subsets: ["latin"],
  weight: ["400", "600", "700"],
  display: "swap",
});

const poppins = Poppins({
  subsets: ["latin"],
  weight: ["400", "600", "700"],
  display: "swap",
});

const roboto = Roboto({
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  display: "swap",
});

const archivoBlack = Archivo_Black({
  subsets: ["latin"],
  weight: ["400"],
  display: "swap",
});

const anton = Anton({ subsets: ["latin"], weight: ["400"], display: "swap" });
const oswald = Oswald({
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  display: "swap",
});
const bebasNeue = Bebas_Neue({
  subsets: ["latin"],
  weight: ["400"],
  display: "swap",
});
const playfair = Playfair_Display({
  subsets: ["latin"],
  weight: ["400", "700"],
  display: "swap",
});
const dmSerif = DM_Serif_Display({
  subsets: ["latin"],
  weight: ["400"],
  display: "swap",
});
const cormorant = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["400", "600"],
  display: "swap",
});
const bungee = Bungee({ subsets: ["latin"], weight: ["400"], display: "swap" });
const righteous = Righteous({
  subsets: ["latin"],
  weight: ["400"],
  display: "swap",
});
const pressStart = Press_Start_2P({
  subsets: ["latin"],
  weight: ["400"],
  display: "swap",
});
const bowlbyOne = Bowlby_One({
  subsets: ["latin"],
  weight: ["400"],
  display: "swap",
});
const russoOne = Russo_One({
  subsets: ["latin"],
  weight: ["400"],
  display: "swap",
});
const caveat = Caveat({
  subsets: ["latin"],
  weight: ["400", "700"],
  display: "swap",
});
const permanentMarker = Permanent_Marker({
  subsets: ["latin"],
  weight: ["400"],
  display: "swap",
});
const pacifico = Pacifico({
  subsets: ["latin"],
  weight: ["400"],
  display: "swap",
});
const lobster = Lobster({
  subsets: ["latin"],
  weight: ["400"],
  display: "swap",
});
const shadowsIntoLight = Shadows_Into_Light({
  subsets: ["latin"],
  weight: ["400"],
  display: "swap",
});
const dancingScript = Dancing_Script({
  subsets: ["latin"],
  weight: ["400", "700"],
  display: "swap",
});
const satisfy = Satisfy({
  subsets: ["latin"],
  weight: ["400"],
  display: "swap",
});
const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "700"],
  display: "swap",
});
const majorMono = Major_Mono_Display({
  subsets: ["latin"],
  weight: ["400"],
  display: "swap",
});

// Map from the human-readable family label stored on TextOverlay to
// the next/font-generated stack string. Lookups that miss the table
// pass through unchanged — useful for the system emoji font stack
// applied to emoji stickers (which sit on image overlays anyway, but
// the fallback is cheap).
export const FONT_FAMILY_MAP: Record<string, string> = {
  Inter: inter.style.fontFamily,
  Montserrat: montserrat.style.fontFamily,
  Poppins: poppins.style.fontFamily,
  Roboto: roboto.style.fontFamily,
  "Archivo Black": archivoBlack.style.fontFamily,
  Anton: anton.style.fontFamily,
  Oswald: oswald.style.fontFamily,
  "Bebas Neue": bebasNeue.style.fontFamily,
  "Playfair Display": playfair.style.fontFamily,
  "DM Serif Display": dmSerif.style.fontFamily,
  "Cormorant Garamond": cormorant.style.fontFamily,
  Bungee: bungee.style.fontFamily,
  Righteous: righteous.style.fontFamily,
  "Press Start 2P": pressStart.style.fontFamily,
  "Bowlby One": bowlbyOne.style.fontFamily,
  "Russo One": russoOne.style.fontFamily,
  Caveat: caveat.style.fontFamily,
  "Permanent Marker": permanentMarker.style.fontFamily,
  Pacifico: pacifico.style.fontFamily,
  Lobster: lobster.style.fontFamily,
  "Shadows Into Light": shadowsIntoLight.style.fontFamily,
  "Dancing Script": dancingScript.style.fontFamily,
  Satisfy: satisfy.style.fontFamily,
  "JetBrains Mono": jetbrainsMono.style.fontFamily,
  "Major Mono Display": majorMono.style.fontFamily,
};

export function resolveFontFamily(humanName: string): string {
  return FONT_FAMILY_MAP[humanName] ?? humanName;
}
