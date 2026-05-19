"use client";

import { useSyncExternalStore, useCallback } from "react";

// User-facing settings, persisted to localStorage so they survive refresh
// without needing a server roundtrip.

export type MenuLayout = "sidebar" | "dock";

// Library view preferences — sort order, density (grid column count), and
// the "favorites only" filter. Persisted so users don't have to redial
// every time they reload.
export type LibrarySort =
  | "newest"
  | "oldest"
  | "prompt-az"
  | "prompt-za"
  | "model";

export const LIBRARY_SORTS: { id: LibrarySort; label: string }[] = [
  { id: "newest", label: "Newest first" },
  { id: "oldest", label: "Oldest first" },
  { id: "prompt-az", label: "Prompt A → Z" },
  { id: "prompt-za", label: "Prompt Z → A" },
  { id: "model", label: "By model" },
];

// Column count for the library grid. Clamped to [2, 7] in the slider UI;
// fewer than 2 wastes space, more than 7 makes thumbnails too small to
// read at typical viewports.
export const GRID_COLS_MIN = 2;
export const GRID_COLS_MAX = 7;
export const GRID_COLS_DEFAULT = 5;

// Optional power-user features. Each can be flipped on or off from
// Settings → Features. Defaults match the "advanced" preset (everything
// on) so the app is fully-featured out of the box; users who want a leaner
// surface pick "basic" or "medium" via the first-run wizard, or toggle
// individual flags themselves.
export type FeatureKey =
  | "variations"
  | "compareSlider"
  | "negativePrompt"
  | "promptHistory"
  | "referenceCropping";

export const FEATURE_KEYS: FeatureKey[] = [
  "variations",
  "compareSlider",
  "negativePrompt",
  "promptHistory",
  "referenceCropping",
];

export type FeatureFlags = Record<FeatureKey, boolean>;

// "Custom" isn't a real preset — it's the marker we set whenever the user
// toggles an individual flag, so the Features tab can show "you're outside
// any preset" instead of falsely highlighting one.
export type UiPreset = "basic" | "medium" | "advanced" | "custom";

export const PRESET_FLAGS: Record<Exclude<UiPreset, "custom">, FeatureFlags> = {
  basic: {
    variations: false,
    compareSlider: false,
    negativePrompt: false,
    promptHistory: false,
    referenceCropping: false,
  },
  medium: {
    variations: true,
    compareSlider: true,
    negativePrompt: false,
    promptHistory: false,
    referenceCropping: false,
  },
  advanced: {
    variations: true,
    compareSlider: true,
    negativePrompt: true,
    promptHistory: true,
    referenceCropping: true,
  },
};

export const FEATURE_LABELS: Record<FeatureKey, { title: string; hint: string }> = {
  variations: {
    title: "Variations",
    hint: "A 'more like this' button on every generated card.",
  },
  compareSlider: {
    title: "A/B compare slider",
    hint: "Draggable split-view when comparing exactly two images.",
  },
  negativePrompt: {
    title: "Negative prompts",
    hint: "Optional second prompt for what the model should avoid (model-dependent).",
  },
  promptHistory: {
    title: "Prompt history",
    hint: "Autocomplete suggestions pulled from prompts you've used before.",
  },
  referenceCropping: {
    title: "Reference cropping",
    hint: "Crop a reference image before sending it to fal.",
  },
};

export const PRESET_LABELS: Record<UiPreset, { title: string; hint: string }> = {
  basic: {
    title: "Basic",
    hint: "Just generate, edit, and organize. Power features hidden.",
  },
  medium: {
    title: "Medium",
    hint: "Adds variations and A/B compare. Sensible default for most.",
  },
  advanced: {
    title: "Advanced",
    hint: "Everything enabled — negative prompts, history, cropping, the lot.",
  },
  custom: {
    title: "Custom",
    hint: "Pick features one by one in Settings → Features.",
  },
};

export type Settings = {
  pageSize: number; // 0 = unlimited (render every filtered asset)
  themeId: string;
  appTitle: string;
  menuLayout: MenuLayout;
  uiPreset: UiPreset;
  featureFlags: FeatureFlags;
  // Tracks whether the first-run preset wizard has been shown. Stored
  // separately from the preset itself so users who dismiss the wizard
  // without choosing don't get re-prompted on every reload.
  wizardSeen: boolean;
  // Library view preferences.
  librarySort: LibrarySort;
  libraryGridCols: number;
  libraryFavoritesOnly: boolean;
};

export const PAGE_SIZE_OPTIONS = [24, 50, 100, 200, 0] as const;

export const DEFAULT_APP_TITLE = "Frame";
export const MAX_APP_TITLE_LENGTH = 40;

export const DEFAULT_SETTINGS: Settings = {
  pageSize: 100,
  themeId: "orbit",
  appTitle: DEFAULT_APP_TITLE,
  menuLayout: "sidebar",
  // Out-of-the-box: everything on. The wizard's "Basic" / "Medium" cards
  // only ever turn things off; opting out is a deliberate, recoverable
  // action.
  uiPreset: "advanced",
  featureFlags: PRESET_FLAGS.advanced,
  wizardSeen: false,
  librarySort: "newest",
  libraryGridCols: GRID_COLS_DEFAULT,
  libraryFavoritesOnly: false,
};

const KEY = "frame.settings.v1";

function read(): Settings {
  if (typeof window === "undefined") return DEFAULT_SETTINGS;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return DEFAULT_SETTINGS;
    const parsed = JSON.parse(raw) as Partial<Settings>;
    // Nested fields (featureFlags) need their own merge or older saved
    // states will drop newly-introduced flags. A shallow spread would set
    // featureFlags to whatever was on disk, missing keys included.
    const featureFlags: FeatureFlags = {
      ...DEFAULT_SETTINGS.featureFlags,
      ...(parsed.featureFlags ?? {}),
    };
    return { ...DEFAULT_SETTINGS, ...parsed, featureFlags };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

function write(s: Settings) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    // localStorage full or unavailable — ignore.
  }
}

// Module-scoped shared store so every useSettings() instance sees the same
// state. Without this, updating the theme in SettingsModal would only
// re-render that one component — ThemeApplier (a sibling) would keep showing
// the old theme until a full page reload re-ran its initial read.

let currentSettings: Settings = DEFAULT_SETTINGS;
let initialized = false;
const subscribers = new Set<() => void>();

function getSnapshot(): Settings {
  if (!initialized && typeof window !== "undefined") {
    currentSettings = read();
    initialized = true;
  }
  return currentSettings;
}

function getServerSnapshot(): Settings {
  // SSR has no localStorage — always default. Client hydrates with the
  // real value via getSnapshot post-mount.
  return DEFAULT_SETTINGS;
}

function subscribe(callback: () => void): () => void {
  subscribers.add(callback);
  return () => {
    subscribers.delete(callback);
  };
}

export function useSettings(): {
  settings: Settings;
  update: (patch: Partial<Settings>) => void;
} {
  const settings = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const update = useCallback((patch: Partial<Settings>) => {
    currentSettings = { ...currentSettings, ...patch };
    write(currentSettings);
    subscribers.forEach((cb) => cb());
  }, []);

  return { settings, update };
}

export function formatPageSize(n: number): string {
  return n === 0 ? "unlimited" : String(n);
}

// Convenience hook for components that only need to gate themselves on a
// single feature flag. Saves them from threading the whole Settings object
// through props or re-implementing the useSyncExternalStore subscription.
export function useFeatureFlag(key: FeatureKey): boolean {
  const { settings } = useSettings();
  return settings.featureFlags?.[key] ?? DEFAULT_SETTINGS.featureFlags[key];
}

// Applies a named preset's flags to the user's settings. Wraps the slightly
// awkward "set both uiPreset AND featureFlags" pattern so callers can't
// forget one half.
export function presetPatch(preset: UiPreset): Partial<Settings> {
  if (preset === "custom") return { uiPreset: "custom" };
  return { uiPreset: preset, featureFlags: PRESET_FLAGS[preset] };
}
