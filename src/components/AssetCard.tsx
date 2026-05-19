"use client";

import { useEffect, useState } from "react";
import {
  Check,
  Download,
  Heart,
  Image as ImgIcon,
  Loader2,
  Pencil,
  RotateCcw,
  Send,
  Sparkles,
  Trash2,
} from "lucide-react";
import { PostComposer } from "@/components/post/PostComposer";
import type { StoredAsset } from "@/lib/storage";
import type { AddReferenceFromAsset } from "@/app/page";
import { DRAG_ASSET_MIME } from "@/app/page";
import { useFeatureFlag } from "@/lib/settings";
import { cn } from "@/lib/utils";

export function AssetCard({
  asset,
  onDelete,
  onOpen,
  onUseAsReference,
  refLoading,
  refsFull,
  selected,
  selectionMode,
  onToggleSelect,
  onTagClick,
  onReuse,
  reuseLoading,
  onVariation,
  variationLoading,
  onToggleFavorite,
}: {
  asset: StoredAsset;
  onDelete: (id: string) => void;
  onOpen: (asset: StoredAsset) => void;
  onUseAsReference?: AddReferenceFromAsset;
  refLoading?: boolean;
  refsFull?: boolean;
  selected?: boolean;
  selectionMode?: boolean;
  onToggleSelect?: (id: string) => void;
  onTagClick?: (tag: string) => void;
  onReuse?: (asset: StoredAsset) => void;
  reuseLoading?: boolean;
  // Fires a new generation with the same prompt/model/size — a quick "more
  // like this" affordance gated behind the `variations` feature flag.
  onVariation?: (asset: StoredAsset) => void;
  variationLoading?: boolean;
  // Flips the asset's `favorited` flag (optimistic in the parent).
  // Surfaced as a heart button on hover; filled in accent when active.
  onToggleFavorite?: (asset: StoredAsset) => void;
}) {
  const variationsEnabled = useFeatureFlag("variations");
  const refDisabled = refLoading || refsFull;
  // Post-composer modal state — local because nothing outside the card
  // needs to know it's open, and we want each card's open state to be
  // independent if the user opens several in succession.
  const [postOpen, setPostOpen] = useState(false);

  function handleDragStart(e: React.DragEvent) {
    e.dataTransfer.setData(DRAG_ASSET_MIME, asset.id);
    e.dataTransfer.setData("text/plain", asset.prompt);
    e.dataTransfer.effectAllowed = "copy";
  }

  function handleActivate(e: React.MouseEvent | React.KeyboardEvent) {
    const mouse = e as React.MouseEvent;
    if (mouse.shiftKey || mouse.metaKey || mouse.ctrlKey) {
      e.preventDefault();
      onToggleSelect?.(asset.id);
      return;
    }
    onOpen(asset);
  }

  return (
    <div
      draggable
      onDragStart={handleDragStart}
      className={cn(
        "group relative rounded-lg overflow-hidden bg-[var(--color-surface)] border transition-colors",
        selected
          ? "border-[var(--color-accent)] ring-2 ring-[var(--color-accent)]/40"
          : "border-[var(--color-border)] hover:border-[var(--color-border-strong)]"
      )}
    >
      {/*
        IMPORTANT: this is a div-as-button (not a real <button>) on purpose.
        Native buttons intercept mousedown and prevent the parent <div
        draggable> from starting a drag. A div lets drag-and-drop work
        across browsers while keeping click + keyboard accessibility.
      */}
      <div
        role="button"
        tabIndex={0}
        onClick={handleActivate}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            handleActivate(e);
          }
        }}
        className="block w-full aspect-square bg-black cursor-grab active:cursor-grabbing focus-visible:outline-none"
        aria-label={selected ? "deselect" : "open"}
      >
        { }
        <img
          src={asset.url}
          alt={asset.prompt}
          loading="lazy"
          draggable={false}
          className={cn(
            "w-full h-full object-cover pointer-events-none transition-transform duration-300 group-hover:scale-[1.02]",
            selected && "scale-[0.98]"
          )}
        />
      </div>

      {/* Selection checkbox — hover-revealed when no selection, always visible in selection mode */}
      {onToggleSelect && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onToggleSelect(asset.id);
          }}
          className={cn(
            "absolute top-2 left-2 size-5 rounded-md grid place-items-center border transition-all",
            selected
              ? "bg-[var(--color-accent)] border-[var(--color-accent)] text-[var(--color-fg-on-accent)] opacity-100"
              : "bg-black/65 backdrop-blur border-white/30 text-transparent hover:text-white",
            selectionMode || selected
              ? "opacity-100"
              : "opacity-0 group-hover:opacity-100"
          )}
          title={selected ? "deselect" : "select"}
          aria-label={selected ? "deselect" : "select"}
          aria-pressed={!!selected}
        >
          <Check className="size-3" strokeWidth={3} />
        </button>
      )}

      {/* Favorite toggle — always visible when favorited (so the user can
          see the state at a glance from the grid), hover-only otherwise.
          Sits in the top-right so it doesn't collide with the selection
          checkbox on the left. */}
      {onToggleFavorite && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onToggleFavorite(asset);
          }}
          className={cn(
            "absolute top-2 right-2 size-5 rounded-md grid place-items-center border transition-all",
            asset.favorited
              ? "bg-[var(--color-accent)] border-[var(--color-accent)] text-[var(--color-fg-on-accent)] opacity-100"
              : "bg-black/65 backdrop-blur border-white/30 text-white/85 hover:text-white opacity-0 group-hover:opacity-100"
          )}
          title={asset.favorited ? "remove from favorites" : "add to favorites"}
          aria-label={asset.favorited ? "remove from favorites" : "add to favorites"}
          aria-pressed={Boolean(asset.favorited)}
        >
          <Heart
            className="size-3"
            fill={asset.favorited ? "currentColor" : "none"}
            strokeWidth={asset.favorited ? 2 : 2.25}
          />
        </button>
      )}

      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-black/85 via-black/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />

      <div className="absolute bottom-0 inset-x-0 p-2.5 opacity-0 group-hover:opacity-100 transition-opacity">
        <p className="text-[11px] text-white/95 line-clamp-2 leading-snug mb-1.5" title={asset.prompt}>
          {asset.prompt}
        </p>
        {asset.tags && asset.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-1.5">
            {asset.tags.slice(0, 3).map((t) => (
              <button
                key={t}
                onClick={(e) => {
                  e.stopPropagation();
                  onTagClick?.(t);
                }}
                className="px-1.5 h-4 rounded-full bg-black/50 backdrop-blur text-[9px] text-white/85 font-mono hover:bg-[var(--color-accent)] hover:text-[var(--color-fg-on-accent)] transition"
                title={`filter by #${t}`}
              >
                #{t}
              </button>
            ))}
            {asset.tags.length > 3 && (
              <span className="px-1.5 h-4 rounded-full bg-black/40 backdrop-blur text-[9px] text-white/60 font-mono inline-flex items-center">
                +{asset.tags.length - 3}
              </span>
            )}
          </div>
        )}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1">
            {asset.width && asset.height && (
              <span className="text-[10px] font-mono text-white/70 px-1 py-0.5 rounded bg-black/40 backdrop-blur">
                {asset.width}×{asset.height}
              </span>
            )}
          </div>
          <div className="flex items-center gap-0.5">
            {variationsEnabled && onVariation && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  if (!variationLoading) onVariation(asset);
                }}
                disabled={variationLoading}
                className="size-6 grid place-items-center rounded text-white/70 hover:text-[var(--color-accent)] hover:bg-white/15 disabled:opacity-40 disabled:cursor-not-allowed transition"
                title={
                  variationLoading
                    ? "queueing variation…"
                    : "more like this — re-run same prompt + model"
                }
                aria-label="more like this"
              >
                {variationLoading ? (
                  <Loader2 className="size-3 animate-spin" />
                ) : (
                  <Sparkles className="size-3" />
                )}
              </button>
            )}
            {onReuse && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  if (!reuseLoading) onReuse(asset);
                }}
                disabled={reuseLoading}
                className="size-6 grid place-items-center rounded text-white/70 hover:text-[var(--color-accent)] hover:bg-white/15 disabled:opacity-40 disabled:cursor-not-allowed transition"
                title={reuseLoading ? "loading prompt + references…" : "reuse — prompt, size, references"}
                aria-label="reuse"
              >
                {reuseLoading ? (
                  <Loader2 className="size-3 animate-spin" />
                ) : (
                  <RotateCcw className="size-3" />
                )}
              </button>
            )}
            {onUseAsReference && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  if (!refDisabled) onUseAsReference(asset);
                }}
                disabled={refDisabled}
                className="size-6 grid place-items-center rounded text-white/70 hover:text-[var(--color-accent)] hover:bg-white/15 disabled:opacity-40 disabled:cursor-not-allowed transition"
                title={
                  refsFull
                    ? "max 4 references"
                    : refLoading
                      ? "adding…"
                      : "use as reference"
                }
                aria-label="use as reference"
              >
                {refLoading ? (
                  <Loader2 className="size-3 animate-spin" />
                ) : (
                  <ImgIcon className="size-3" />
                )}
              </button>
            )}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setPostOpen(true);
              }}
              className="size-6 grid place-items-center rounded text-white/70 hover:text-[var(--color-accent)] hover:bg-white/15 transition"
              title="post — crop, filter, share"
              aria-label="open post composer"
            >
              <Send className="size-3" />
            </button>
            <a
              href={`/editor?from=${encodeURIComponent(asset.url)}`}
              onClick={(e) => e.stopPropagation()}
              className="size-6 grid place-items-center rounded text-white/70 hover:text-[var(--color-accent)] hover:bg-white/15 transition"
              title="edit — adjust + add overlays"
              aria-label="open in editor"
            >
              <Pencil className="size-3" />
            </a>
            <a
              href={`/api/download?id=${encodeURIComponent(asset.id)}`}
              download={asset.fileName}
              onClick={(e) => e.stopPropagation()}
              className="size-6 grid place-items-center rounded text-white/70 hover:text-white hover:bg-white/15 transition"
              title="download (metadata stripped)"
              aria-label="download"
            >
              <Download className="size-3" />
            </a>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDelete(asset.id);
              }}
              className="size-6 grid place-items-center rounded text-white/70 hover:text-[var(--color-danger)] hover:bg-white/15 transition"
              title="delete"
              aria-label="delete"
            >
              <Trash2 className="size-3" />
            </button>
          </div>
        </div>
      </div>

      {postOpen && (
        <PostComposer
          imageUrl={asset.url}
          imageName={asset.fileName}
          onClose={() => setPostOpen(false)}
        />
      )}
    </div>
  );
}

export function AssetSkeleton({
  prompt,
  startedAt,
}: {
  prompt?: string;
  startedAt?: number;
} = {}) {
  return (
    <div className="rounded-lg overflow-hidden border border-[var(--color-border)] bg-[var(--color-surface)] aspect-square relative">
      <div className="absolute inset-0 bg-gradient-to-br from-[var(--color-surface)] via-[var(--color-surface-hover)] to-[var(--color-surface)] shimmer" />
      <div className="absolute inset-0 grid place-items-center">
        <div className="size-6 rounded-full border-2 border-[var(--color-border-strong)] border-t-[var(--color-accent)] animate-spin" />
      </div>
      {prompt && (
        <div className="absolute inset-x-0 bottom-0 p-2.5 bg-gradient-to-t from-black/85 via-black/40 to-transparent pointer-events-none">
          <p
            className="text-[11px] text-white/90 line-clamp-2 leading-snug"
            title={prompt}
          >
            {prompt}
          </p>
          {startedAt && (
            <div className="mt-1">
              <ElapsedTimer startedAt={startedAt} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ElapsedTimer({ startedAt }: { startedAt: number }) {
  const [, force] = useState(0);
  useEffect(() => {
    const id = setInterval(() => force((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, []);
  const seconds = Math.floor((Date.now() - startedAt) / 1000);
  return (
    <span className="text-[10px] font-mono text-white/60 tabular-nums">{seconds}s</span>
  );
}
