"use client";

import type { PickedImage } from "@/components/ImagePicker";
import { findSize, type SizeOption } from "@/lib/sizes";
import type { Quality } from "@/lib/fal";
import type { StoredAsset, StoredSource } from "@/lib/storage";

// Prefill is the "set the studio panel to look like this asset" payload.
// `token` is a monotonically increasing number — the StudioPanel watches it
// in a useEffect and only applies a prefill once per change, so re-renders
// of the same prefill object don't reset the user's edits.
export type StudioPrefill = {
  token: number;
  prompt: string;
  size?: SizeOption;
  matchSourceAspect?: boolean;
  quality?: Quality;
  mask?: PickedImage[];
};

// Result of preparing a reuse: the prefill (applied via prop) and the
// references that must be set on page-level state.
export type ReusePreparation = {
  prefill: Omit<StudioPrefill, "token">;
  references: PickedImage[];
};

async function uploadLocalToFal(url: string, fileName: string): Promise<{ url: string }> {
  const blob = await (await fetch(url)).blob();
  const file = new File([blob], fileName, { type: blob.type || "image/png" });
  const form = new FormData();
  form.append("file", file);
  const res = await fetch("/api/upload", { method: "POST", body: form });
  if (!res.ok) {
    const j = await res.json().catch(() => ({}));
    throw new Error(j.error || `upload failed (${res.status})`);
  }
  return (await res.json()) as { url: string };
}

function readSources(extras: Record<string, unknown> | undefined): StoredSource[] {
  const v = extras?.sources;
  if (!Array.isArray(v)) return [];
  return v.filter(
    (s): s is StoredSource => Boolean(s) && typeof (s as StoredSource).url === "string"
  );
}

function readMask(extras: Record<string, unknown> | undefined): StoredSource | null {
  const v = extras?.mask;
  if (v && typeof (v as StoredSource).url === "string") return v as StoredSource;
  return null;
}

function readImageSize(
  extras: Record<string, unknown> | undefined
): { type: "auto" } | { type: "wh"; width: number; height: number } | null {
  const v = extras?.image_size;
  if (v === "auto") return { type: "auto" };
  if (v && typeof v === "object") {
    const { width, height } = v as { width?: number; height?: number };
    if (typeof width === "number" && typeof height === "number") {
      return { type: "wh", width, height };
    }
  }
  return null;
}

// Builds a prefill from a library asset. Re-uploads the asset's persisted
// reference + mask images to fal storage so they can be used in a new
// generation immediately.
export async function prepareReuse(asset: StoredAsset): Promise<ReusePreparation> {
  const sources = readSources(asset.extras);
  const maskSrc = readMask(asset.extras);

  // Re-upload references in parallel.
  const references: PickedImage[] = await Promise.all(
    sources.map(async (s) => {
      const { url } = await uploadLocalToFal(s.url, s.fileName);
      return { url, preview: s.url, name: s.fileName };
    })
  );

  let mask: PickedImage[] | undefined;
  if (maskSrc) {
    const { url } = await uploadLocalToFal(maskSrc.url, maskSrc.fileName);
    mask = [{ url, preview: maskSrc.url, name: maskSrc.fileName }];
  }

  // Resolve size + match-source-aspect from the recorded image_size.
  let size: SizeOption | undefined;
  let matchSourceAspect = false;

  const recorded = readImageSize(asset.extras);
  if (recorded?.type === "auto") {
    // The asset was generated with "match source" (auto). Reproduce that.
    matchSourceAspect = references.length > 0;
  } else if (recorded?.type === "wh") {
    size = findSize(recorded.width, recorded.height) ?? undefined;
  } else if (asset.width && asset.height) {
    // Fallback: try matching against the saved output dimensions.
    size = findSize(asset.width, asset.height) ?? undefined;
  }

  const qualityVal = (asset.extras as Record<string, unknown> | undefined)?.quality;
  const quality =
    qualityVal === "auto" || qualityVal === "low" || qualityVal === "medium" || qualityVal === "high"
      ? (qualityVal as Quality)
      : undefined;

  return {
    prefill: {
      prompt: asset.prompt,
      size,
      matchSourceAspect,
      quality,
      mask,
    },
    references,
  };
}
