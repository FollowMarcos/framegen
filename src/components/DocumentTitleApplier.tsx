"use client";

import { useEffect } from "react";
import { DEFAULT_APP_TITLE, useSettings } from "@/lib/settings";

// Keeps document.title in sync with the user-defined app title from settings.
// The static metadata.title in layout.tsx covers SSR (so the very first paint
// has a sensible tab title); this component takes over once the saved title
// is read from localStorage on the client.
export function DocumentTitleApplier(): null {
  const { settings } = useSettings();
  useEffect(() => {
    const title = settings.appTitle?.trim() || DEFAULT_APP_TITLE;
    document.title = title;
  }, [settings.appTitle]);
  return null;
}
