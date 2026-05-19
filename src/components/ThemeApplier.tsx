"use client";

import { useEffect } from "react";
import { applyTheme, getTheme, DEFAULT_THEME_ID } from "@/lib/themes";
import { useSettings } from "@/lib/settings";

// Reads the saved theme from settings (localStorage) on mount and applies
// it to document.documentElement. Re-applies whenever the user picks a
// different theme. Render this once near the app root.
//
// Note: there's a brief flash on initial load if the user is on a non-
// default theme — the server renders the default and the client applies
// the saved theme post-hydration. The fix is an inline blocking script in
// <head> that reads localStorage before paint; we can add that later if
// the flash bothers anyone.
export function ThemeApplier() {
  const { settings } = useSettings();
  useEffect(() => {
    const theme = getTheme(settings.themeId || DEFAULT_THEME_ID);
    applyTheme(theme);
  }, [settings.themeId]);
  return null;
}
