"use client";

// Unified custom-model registry. Replaces lib/customUpscaleModels.ts.
// Stored in localStorage so it's per-browser and requires no server state.
//
// Four supported kinds, each with different downstream usage:
//   - "upscale"     : fully wired. UpscaleModal shows them; /api/upscale
//                     dispatches with a generic input shape for any id not
//                     in the built-in switch.
//   - "image-gen"   : registerable. Use a custom one by setting it as
//                     the default in Settings — /api/generate forwards the
//                     model id when provided.
//   - "image-edit"  : same as image-gen, used when references are attached.
//   - "video"       : registerable + listed in the dashboard, but generating
//                     videos is not wired up in the UI yet. Document a path
//                     forward; don't auto-trigger.

export type CustomModelKind = "upscale" | "image-gen" | "image-edit" | "video";

export type ModelPricing =
  | { kind: "per_mp"; usdPerMP: number; note?: string }
  | { kind: "per_second"; usdPerSecond: number; estimateSeconds: number; note?: string };

export type CustomModel = {
  id: string; // fal model path, e.g. "fal-ai/foo-bar"
  kind: CustomModelKind;
  name: string;
  description: string;
  qualityHint?: "basic" | "balanced" | "premium";
  // upscale-only:
  factor?: { allowed: number[]; default: number };
  pricing: ModelPricing;
  createdAt: string;
};

const KEY = "frame.customModels.v1";
const LEGACY_KEY = "frame.customUpscaleModels.v1";

function migrateLegacy(): CustomModel[] {
  // One-shot migration from the old upscale-only key. Drops the legacy
  // entry after copying so we don't keep two stores in sync.
  if (typeof window === "undefined") return [];
  try {
    const legacy = localStorage.getItem(LEGACY_KEY);
    if (!legacy) return [];
    const parsed = JSON.parse(legacy) as Array<Omit<CustomModel, "kind" | "createdAt">>;
    if (!Array.isArray(parsed)) return [];
    const migrated: CustomModel[] = parsed.map((m) => ({
      ...m,
      kind: "upscale",
      createdAt: new Date().toISOString(),
    }));
    localStorage.setItem(KEY, JSON.stringify(migrated));
    localStorage.removeItem(LEGACY_KEY);
    return migrated;
  } catch {
    return [];
  }
}

function read(): CustomModel[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) {
      // First read — try to migrate from the legacy upscale-only store.
      return migrateLegacy();
    }
    const parsed = JSON.parse(raw) as CustomModel[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function write(list: CustomModel[]) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(KEY, JSON.stringify(list));
  } catch {
    // ignore
  }
}

export function listCustomModels(kind?: CustomModelKind): CustomModel[] {
  const all = read();
  return kind ? all.filter((m) => m.kind === kind) : all;
}

export function addCustomModel(
  m: Omit<CustomModel, "createdAt">
): CustomModel {
  const list = read();
  if (list.some((x) => x.id === m.id)) {
    throw new Error("a model with that id already exists");
  }
  const entry: CustomModel = { ...m, createdAt: new Date().toISOString() };
  list.push(entry);
  write(list);
  return entry;
}

export function removeCustomModel(id: string) {
  write(read().filter((m) => m.id !== id));
}

export const CUSTOM_MODEL_KIND_LABELS: Record<CustomModelKind, string> = {
  upscale: "Upscale",
  "image-gen": "Image generation",
  "image-edit": "Image edit",
  video: "Video",
};

export const CUSTOM_MODEL_KIND_NOTES: Record<CustomModelKind, string> = {
  upscale:
    "Fully wired. Appears in the Upscale picker next to the built-in models. Uses a generic input shape (image_url + upscale_factor + scale).",
  "image-gen":
    "Stored. To use as the studio panel's default model, pick it under Settings → default models. Sends prompt + image_size + quality with no references.",
  "image-edit":
    "Stored. Active when references are present and selected as the default in Settings. Sends prompt + image_urls + optional mask_url.",
  video:
    "Stored only. There's no video generation flow in the UI yet — generating video requires adding a route + a new panel. See the Documentation section.",
};
