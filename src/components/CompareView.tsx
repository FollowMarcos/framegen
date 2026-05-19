"use client";

import { useEffect, useRef, useState } from "react";
import { Columns2, GripVertical, LayoutGrid, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useFeatureFlag } from "@/lib/settings";
import type { StoredAsset } from "@/lib/storage";

type CompareMode = "grid" | "slider";

// Compares 2–4 images side-by-side at the largest size that fits the viewport.
// Layouts: 2 → side-by-side, 3 → 3 columns, 4 → 2x2 grid. When exactly two
// images are loaded and the `compareSlider` feature flag is on, the user
// can toggle to an A/B slider that overlays the two images with a draggable
// divider — useful for spotting subtle differences a grid hides.
export function CompareView({
  assets,
  onClose,
}: {
  assets: StoredAsset[];
  onClose: () => void;
}) {
  const sliderEnabled = useFeatureFlag("compareSlider");
  const sliderAvailable = sliderEnabled && assets.length === 2;
  const [mode, setMode] = useState<CompareMode>("grid");

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  // Reset to grid if the user shrinks selection below 2 with the modal open.
  useEffect(() => {
    if (!sliderAvailable && mode === "slider") setMode("grid");
  }, [sliderAvailable, mode]);

  if (assets.length === 0) return null;

  const layout =
    assets.length === 2
      ? "grid-cols-2 grid-rows-1"
      : assets.length === 3
        ? "grid-cols-3 grid-rows-1"
        : "grid-cols-2 grid-rows-2";

  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={onClose}
      className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex flex-col p-6 animate-in"
    >
      <header
        onClick={(e) => e.stopPropagation()}
        className="flex items-center justify-between shrink-0 mb-3"
      >
        <div className="flex items-baseline gap-2">
          <h2 className="text-[13px] font-semibold tracking-tight">compare</h2>
          <span className="text-[11px] text-[var(--color-muted)]">
            {assets.length} image{assets.length === 1 ? "" : "s"} · esc to close
          </span>
        </div>

        <div className="flex items-center gap-2">
          {sliderAvailable && (
            <div
              role="tablist"
              aria-label="compare mode"
              className="inline-flex items-center gap-0.5 p-0.5 rounded-md bg-[var(--color-surface)] border border-[var(--color-border)]"
            >
              <ModeButton
                active={mode === "grid"}
                onClick={() => setMode("grid")}
                icon={<LayoutGrid className="size-3" />}
                label="Grid"
              />
              <ModeButton
                active={mode === "slider"}
                onClick={() => setMode("slider")}
                icon={<Columns2 className="size-3" />}
                label="A/B"
              />
            </div>
          )}
          <button
            onClick={onClose}
            className="size-7 rounded-md grid place-items-center text-[var(--color-muted)] hover:text-[var(--color-fg)] hover:bg-[var(--color-surface)] transition"
            aria-label="close"
          >
            <X className="size-4" />
          </button>
        </div>
      </header>

      <div
        onClick={(e) => e.stopPropagation()}
        className={cn(
          "flex-1 min-h-0",
          mode === "grid" && "grid gap-3",
          mode === "grid" && layout
        )}
      >
        {mode === "slider" && sliderAvailable ? (
          <SliderCompare a={assets[0]} b={assets[1]} />
        ) : (
          assets.map((asset, i) => (
            <Pane key={asset.id} asset={asset} index={i + 1} />
          ))
        )}
      </div>
    </div>
  );
}

function ModeButton({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 h-7 px-2.5 rounded text-[11px] font-medium transition-colors",
        active
          ? "bg-[var(--color-bg-elevated)] text-[var(--color-fg)] shadow-sm"
          : "text-[var(--color-muted)] hover:text-[var(--color-fg-dim)]"
      )}
    >
      {icon}
      {label}
    </button>
  );
}

function Pane({ asset, index }: { asset: StoredAsset; index: number }) {
  return (
    <figure className="relative bg-black rounded-xl overflow-hidden flex flex-col min-h-0 border border-[var(--color-border)]">
      <div className="flex-1 min-h-0 grid place-items-center p-2">
        { }
        <img
          src={asset.url}
          alt={asset.prompt}
          className="max-h-full max-w-full object-contain"
        />
      </div>
      <figcaption className="shrink-0 bg-[var(--color-bg-elevated)] border-t border-[var(--color-border)] px-3 py-2 flex items-start gap-2">
        <span className="size-5 rounded-md bg-[var(--color-accent-dim)] text-[var(--color-accent)] grid place-items-center text-[10px] font-mono shrink-0">
          {index}
        </span>
        <div className="min-w-0 flex-1">
          <p
            className="text-[11px] leading-snug text-[var(--color-fg-dim)] line-clamp-2"
            title={asset.prompt}
          >
            {asset.prompt}
          </p>
          <p className="text-[10px] text-[var(--color-muted)] font-mono mt-0.5">
            {asset.width && asset.height && `${asset.width}×${asset.height}`}
            {(asset.extras as Record<string, unknown> | undefined)?.quality
              ? ` · ${(asset.extras as Record<string, unknown>).quality}`
              : ""}
          </p>
        </div>
      </figcaption>
    </figure>
  );
}

// A/B split view: image B is layered on top of image A, with a draggable
// vertical divider that controls how far image B extends from the left.
// Implemented with `clip-path: inset(...)` so we avoid a second `img` tag
// for the masked half (less DOM, fewer paint passes) — both images render
// once, and only the clip-path changes as the user drags.
function SliderCompare({ a, b }: { a: StoredAsset; b: StoredAsset }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [split, setSplit] = useState(0.5); // 0..1, fraction of width showing B
  const [dragging, setDragging] = useState(false);

  // Mirror split into a ref so the pointermove handler doesn't need to be
  // recreated on every state change (which would lose the active drag).
  const splitRef = useRef(split);
  splitRef.current = split;

  function updateFromClientX(clientX: number) {
    const el = containerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const pct = (clientX - rect.left) / rect.width;
    setSplit(Math.max(0, Math.min(1, pct)));
  }

  function onPointerDown(e: React.PointerEvent) {
    (e.target as Element).setPointerCapture?.(e.pointerId);
    setDragging(true);
    updateFromClientX(e.clientX);
  }

  function onPointerMove(e: React.PointerEvent) {
    if (!dragging) return;
    updateFromClientX(e.clientX);
  }

  function onPointerUp(e: React.PointerEvent) {
    (e.target as Element).releasePointerCapture?.(e.pointerId);
    setDragging(false);
  }

  // Keyboard nudges for accessibility — when the divider has focus the user
  // can use arrow keys to fine-tune the split without a mouse.
  function onKeyDown(e: React.KeyboardEvent) {
    const step = e.shiftKey ? 0.1 : 0.02;
    if (e.key === "ArrowLeft") {
      e.preventDefault();
      setSplit((s) => Math.max(0, s - step));
    } else if (e.key === "ArrowRight") {
      e.preventDefault();
      setSplit((s) => Math.min(1, s + step));
    }
  }

  const splitPct = `${split * 100}%`;

  return (
    <figure className="relative w-full h-full rounded-xl overflow-hidden border border-[var(--color-border)] bg-black">
      <div
        ref={containerRef}
        className="absolute inset-0 select-none"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        {/* A — the "before" image, full width. */}
        { }
        <img
          src={a.url}
          alt={a.prompt}
          draggable={false}
          className="absolute inset-0 w-full h-full object-contain pointer-events-none"
        />
        {/* B — the "after" image, clipped to [0..split] of the width. */}
        { }
        <img
          src={b.url}
          alt={b.prompt}
          draggable={false}
          className="absolute inset-0 w-full h-full object-contain pointer-events-none"
          style={{ clipPath: `inset(0 ${100 - split * 100}% 0 0)` }}
        />

        {/* Divider — visible vertical line + grab handle in the middle. */}
        <div
          role="separator"
          aria-orientation="vertical"
          aria-valuenow={Math.round(split * 100)}
          aria-valuemin={0}
          aria-valuemax={100}
          tabIndex={0}
          onKeyDown={onKeyDown}
          className={cn(
            "absolute top-0 bottom-0 -translate-x-1/2 w-px bg-white cursor-ew-resize outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]/60",
            dragging && "bg-[var(--color-accent)]"
          )}
          style={{ left: splitPct }}
        >
          <div
            className={cn(
              "absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 size-9 rounded-full bg-white text-black grid place-items-center shadow-lg transition-transform",
              dragging && "scale-110"
            )}
            aria-hidden
          >
            <GripVertical className="size-4" strokeWidth={2.5} />
          </div>
        </div>

        {/* Corner labels so you don't lose track of which side is which. */}
        <span className="absolute top-3 left-3 px-2 py-1 rounded-md bg-black/65 text-white text-[10px] font-mono tracking-wider pointer-events-none">
          B
        </span>
        <span className="absolute top-3 right-3 px-2 py-1 rounded-md bg-black/65 text-white text-[10px] font-mono tracking-wider pointer-events-none">
          A
        </span>
      </div>
    </figure>
  );
}
