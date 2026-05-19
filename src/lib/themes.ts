"use client";

// Themes are defined in the design.md format (https://designdotmd.directory)
// and live in `src/themes/`. Each file exports the raw markdown string; the
// parser in `designMd.ts` reads the YAML frontmatter and maps its semantic
// color tokens (primary / secondary / tertiary / neutral / surface) to this
// app's CSS variables.
//
// To add a theme: drop the markdown from any designdotmd.directory page into
// a new file under src/themes/, then import + register it in THEME_SOURCES
// below. No other code changes required.

import { themeFromDesignMd, type Theme } from "@/lib/designMd";
import midnightMd from "@/themes/midnight";
import emberMd from "@/themes/ember";
import orbitMd from "@/themes/orbit";
import paperMd from "@/themes/paper";
import pastelCandyMd from "@/themes/pastelCandy";

export type { Theme } from "@/lib/designMd";

const THEME_SOURCES: { id: string; src: string }[] = [
  { id: "orbit", src: orbitMd },
  { id: "midnight", src: midnightMd },
  { id: "ember", src: emberMd },
  { id: "paper", src: paperMd },
  { id: "pastel-candy", src: pastelCandyMd },
];

export const THEMES: Theme[] = THEME_SOURCES.map(({ id, src }) =>
  themeFromDesignMd(id, src)
);

// Orbit is the new default — pitch-black + orange. Midnight stays
// available as the classic dark choice for users who preferred the
// previous look. Saved settings override this for returning users.
export const DEFAULT_THEME_ID = "orbit";

export function getTheme(id: string): Theme {
  return THEMES.find((t) => t.id === id) ?? THEMES[0];
}

// Applies a theme to document.documentElement. Idempotent — calling repeatedly
// just rewrites the same custom properties. Safe to call from a useEffect.
export function applyTheme(theme: Theme): void {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  for (const [name, value] of Object.entries(theme.vars)) {
    root.style.setProperty(name, value);
  }
  // Light themes need the browser to swap form-control rendering. Set
  // color-scheme so native UI (scrollbars, inputs) tracks the theme.
  root.style.setProperty("color-scheme", theme.type);
}
