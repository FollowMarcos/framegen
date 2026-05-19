"use client";

import { useEffect, useMemo, useState } from "react";
import { Download, Loader2, Share2, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { ASPECTS, DEFAULT_ASPECT, type Aspect } from "@/lib/post/aspects";
import { FILTER_PRESETS, DEFAULT_FILTER, type FilterPreset } from "@/lib/post/filters";
import {
  canShareFiles,
  downloadBlob,
  renderPostBlob,
} from "@/lib/post/export";

// Instagram-style post composer. One image in, one PNG out — no
// overlays, no layers, no caption. The default aspect is "Original"
// because most users posting an AI generation want the frame they
// generated, not a forced crop; the fixed-aspect presets are there
// for when the user has a specific platform target in mind.
//
// Live preview uses CSS filters on a plain <img>; the export pipeline
// re-applies the same filter via ctx.filter so what the user sees
// in the modal is what they get.
export function PostComposer({
  imageUrl,
  imageName,
  onClose,
}: {
  imageUrl: string;
  imageName?: string;
  onClose: () => void;
}) {
  const [aspect, setAspect] = useState<Aspect>(DEFAULT_ASPECT);
  const [filter, setFilter] = useState<FilterPreset>(DEFAULT_FILTER);
  const [busy, setBusy] = useState<null | "download" | "share">(null);
  const [error, setError] = useState<string | null>(null);
  // Probed at mount so the preview can size the Original aspect
  // correctly without re-measuring on every render.
  const [naturalSize, setNaturalSize] = useState<{
    width: number;
    height: number;
  } | null>(null);

  const shareSupported = useMemo(() => canShareFiles(), []);

  // Lock body scroll + Escape closes.
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  // Probe the source image once so the Original-aspect preview can
  // letterbox correctly. Cheap — same image is already in the
  // browser cache via the preview <img>.
  useEffect(() => {
    let cancelled = false;
    const img = new window.Image();
    img.onload = () => {
      if (!cancelled) {
        setNaturalSize({ width: img.naturalWidth, height: img.naturalHeight });
      }
    };
    img.src = imageUrl;
    return () => {
      cancelled = true;
    };
  }, [imageUrl]);

  const fileBase = (imageName?.replace(/\.[a-z0-9]+$/i, "") || "post").slice(0, 40);

  async function handleDownload() {
    setBusy("download");
    setError(null);
    try {
      const blob = await renderPostBlob({
        imageUrl,
        aspect,
        filter: filter.filter,
      });
      downloadBlob(blob, `${fileBase}-${aspect.id}.png`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "render failed");
    } finally {
      setBusy(null);
    }
  }

  async function handleShare() {
    setBusy("share");
    setError(null);
    try {
      const blob = await renderPostBlob({
        imageUrl,
        aspect,
        filter: filter.filter,
      });
      const file = new File([blob], `${fileBase}-${aspect.id}.png`, {
        type: "image/png",
      });
      await navigator.share({ files: [file] });
    } catch (e) {
      // AbortError fires when the user dismisses the OS share sheet —
      // not a real failure, so swallow it. Everything else surfaces.
      if (e instanceof Error && e.name !== "AbortError") {
        setError(e.message);
      }
    } finally {
      setBusy(null);
    }
  }

  // Aspect ratio for the preview frame. Original mode reads from the
  // probed natural size; fixed presets use their declared dimensions.
  const previewRatio: { w: number; h: number } | null =
    aspect.width && aspect.height
      ? { w: aspect.width, h: aspect.height }
      : naturalSize
        ? { w: naturalSize.width, h: naturalSize.height }
        : null;

  // Cover-fit only applies to the fixed presets — Original shows the
  // whole image unaltered.
  const previewObjectFit: "cover" | "contain" =
    aspect.width && aspect.height ? "cover" : "contain";

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="create post"
      className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm grid place-items-center p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-[min(960px,96vw)] h-[min(720px,92vh)] rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-elevated)] shadow-2xl flex flex-col overflow-hidden">
        <header className="flex items-center gap-3 h-12 px-4 border-b border-[var(--color-border)] shrink-0">
          <h2 className="text-[13px] font-semibold tracking-tight">Create post</h2>
          <span className="text-[11px] text-[var(--color-muted)]">
            Pick an aspect, pick a filter, download.
          </span>
          <button
            type="button"
            onClick={onClose}
            className="ml-auto size-8 grid place-items-center rounded-md text-[var(--color-muted)] hover:text-[var(--color-fg)] hover:bg-[var(--color-surface)] transition"
            aria-label="close"
          >
            <X className="size-4" />
          </button>
        </header>

        {/* Aspect-ratio tabs. Original sits first so the default reads
            as the obvious "no crop" pick. */}
        <div className="flex items-center justify-center gap-1 px-4 py-2 border-b border-[var(--color-border)] shrink-0 overflow-x-auto">
          {ASPECTS.map((a) => (
            <button
              key={a.id}
              type="button"
              onClick={() => setAspect(a)}
              className={cn(
                "h-8 px-3 rounded-md text-[12px] font-medium transition-colors inline-flex items-baseline gap-1.5 shrink-0",
                aspect.id === a.id
                  ? "bg-[var(--color-accent)] text-[var(--color-fg-on-accent)]"
                  : "text-[var(--color-fg-dim)] hover:bg-[var(--color-surface)]"
              )}
              aria-pressed={aspect.id === a.id}
            >
              {a.label}
              <span
                className={cn(
                  "text-[10px] font-mono tabular-nums",
                  aspect.id === a.id ? "opacity-80" : "text-[var(--color-muted)]"
                )}
              >
                {a.ratioLabel}
              </span>
            </button>
          ))}
        </div>

        <div className="flex-1 min-h-0 grid grid-cols-[1fr_320px] overflow-hidden">
          {/* Preview area — letterboxes the cropped/filtered image
              against a dark backdrop so the aspect feels intentional. */}
          <div className="relative bg-black grid place-items-center p-6 min-h-0 overflow-hidden">
            {previewRatio && (
              <div
                className="relative shadow-[0_10px_40px_-12px_rgba(0,0,0,0.7)]"
                style={{
                  aspectRatio: `${previewRatio.w} / ${previewRatio.h}`,
                  maxWidth: "100%",
                  maxHeight: "100%",
                  width: previewRatio.w >= previewRatio.h ? "100%" : "auto",
                  height: previewRatio.w < previewRatio.h ? "100%" : "auto",
                }}
              >
                <img
                  src={imageUrl}
                  alt="preview"
                  className="absolute inset-0 w-full h-full"
                  style={{
                    filter: filter.filter,
                    objectFit: previewObjectFit,
                  }}
                />
              </div>
            )}
          </div>

          {/* Right rail — filters and share buttons. No caption row. */}
          <div className="flex flex-col border-l border-[var(--color-border)] min-h-0">
            <div className="flex-1 border-b border-[var(--color-border)] p-3 overflow-y-auto">
              <h3 className="text-[10px] font-semibold uppercase tracking-wider text-[var(--color-muted)] mb-2 px-1">
                Filters
              </h3>
              <div className="grid grid-cols-3 gap-1.5">
                {FILTER_PRESETS.map((p) => (
                  <FilterChip
                    key={p.id}
                    preset={p}
                    imageUrl={imageUrl}
                    selected={filter.id === p.id}
                    onSelect={() => setFilter(p)}
                  />
                ))}
              </div>
            </div>

            <div className="p-3 space-y-2 shrink-0">
              {error && (
                <div className="text-[11px] text-[var(--color-danger)] bg-[var(--color-danger)]/10 border border-[var(--color-danger)]/30 rounded px-2 py-1.5">
                  {error}
                </div>
              )}
              <button
                type="button"
                onClick={handleDownload}
                disabled={busy !== null}
                className={cn(
                  "w-full h-10 rounded-md inline-flex items-center justify-center gap-1.5 text-[12.5px] font-semibold transition",
                  "bg-[var(--color-accent)] text-[var(--color-fg-on-accent)]",
                  "hover:bg-[var(--color-accent-hover)]",
                  "disabled:opacity-50 disabled:cursor-not-allowed"
                )}
              >
                {busy === "download" ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <Download className="size-3.5" />
                )}
                Download PNG
              </button>
              {shareSupported && (
                <button
                  type="button"
                  onClick={handleShare}
                  disabled={busy !== null}
                  className="w-full h-9 rounded-md inline-flex items-center justify-center gap-1.5 text-[12px] font-medium border border-[var(--color-border)] bg-[var(--color-surface)] hover:bg-[var(--color-surface-hover)] disabled:opacity-50 disabled:cursor-not-allowed transition"
                >
                  {busy === "share" ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : (
                    <Share2 className="size-3.5" />
                  )}
                  Share…
                </button>
              )}
              <p className="text-[10px] text-[var(--color-muted)] leading-snug pt-1">
                Web apps can&apos;t upload directly to IG, TikTok, or X —
                download the PNG and upload from the app.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Single filter swatch — a thumbnail of the source image with the
// preset's CSS filter applied. Functions as both preview and pick.
function FilterChip({
  preset,
  imageUrl,
  selected,
  onSelect,
}: {
  preset: FilterPreset;
  imageUrl: string;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={cn(
        "group flex flex-col items-stretch text-left rounded-md overflow-hidden border-2 transition",
        selected
          ? "border-[var(--color-accent)]"
          : "border-transparent hover:border-[var(--color-border-strong)]"
      )}
    >
      <div className="relative aspect-square bg-black">
        <img
          src={imageUrl}
          alt={preset.label}
          className="absolute inset-0 w-full h-full object-cover"
          style={{ filter: preset.filter }}
        />
      </div>
      <span
        className={cn(
          "block text-[10.5px] font-medium px-1 py-1 text-center truncate",
          selected ? "text-[var(--color-fg)]" : "text-[var(--color-fg-dim)]"
        )}
      >
        {preset.label}
      </span>
    </button>
  );
}
