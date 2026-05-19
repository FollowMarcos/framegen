"use client";

import { useEffect, useState } from "react";
import { FONT_FAMILY_MAP } from "./fontModules";

// Self-hosted now — next/font/google bakes every catalogue font into
// the build, so there's no <link> to inject and no CDN to depend on.
// All this hook does is wait for the browser to confirm the font
// files have actually downloaded, then bump a counter that the
// canvas listens to so it can redraw text nodes with the correct
// metrics instead of the fallback's wider glyphs.
export function useGoogleFonts(): { fontsReady: boolean; generation: number } {
  const [fontsReady, setFontsReady] = useState(false);
  const [generation, setGeneration] = useState(0);

  useEffect(() => {
    if (typeof document === "undefined") return;
    let cancelled = false;
    async function waitForFonts() {
      try {
        // document.fonts.load triggers the actual network fetch for
        // each face — without it, font-display: swap leaves the
        // browser sitting on the fallback until something on the
        // page references the @font-face. The canvas doesn't.
        await Promise.all(
          Object.values(FONT_FAMILY_MAP).map((family) =>
            document.fonts.load(`16px ${family}`)
          )
        );
        await document.fonts.ready;
      } catch {
        // Network hiccup or unsupported browser — fall through to
        // "ready" so the UI doesn't spin forever. Canvas will render
        // with the platform fallback and switch to the real face on
        // the next state change.
      }
      if (cancelled) return;
      setFontsReady(true);
      setGeneration((g) => g + 1);
    }
    waitForFonts();
    return () => {
      cancelled = true;
    };
  }, []);

  return { fontsReady, generation };
}
