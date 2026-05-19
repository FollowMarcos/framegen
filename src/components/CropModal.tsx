"use client";

import { useEffect, useRef, useState } from "react";
import { Crop, Loader2, RotateCcw, X } from "lucide-react";
import { Button } from "@/components/fields";
import { cn } from "@/lib/utils";
import type { PickedImage } from "@/components/ImagePicker";

// Crops a reference image client-side, re-uploads the result, and hands the
// new PickedImage back to the caller (ImagePicker). Implementation notes:
//
//   - The rect is stored in normalized 0..1 coords so it survives container
//     resizes and keeps the math symmetric across handles.
//   - Cropping happens in a hidden <canvas> at the original image's natural
//     resolution — no downscaling, fal sees the full quality crop.
//   - Result goes through /api/upload, same as a fresh file pick, so it
//     joins the user's persisted uploads library and can be re-picked later
//     without re-cropping.

type Rect = { x: number; y: number; w: number; h: number }; // 0..1
type Handle = "move" | "nw" | "ne" | "sw" | "se";
type DragState = {
  handle: Handle;
  startRect: Rect;
  startNormX: number;
  startNormY: number;
};

const ASPECT_PRESETS: { id: string; label: string; ratio: number | null }[] = [
  { id: "free", label: "Free", ratio: null },
  { id: "1_1", label: "1:1", ratio: 1 },
  { id: "4_3", label: "4:3", ratio: 4 / 3 },
  { id: "3_4", label: "3:4", ratio: 3 / 4 },
  { id: "16_9", label: "16:9", ratio: 16 / 9 },
  { id: "9_16", label: "9:16", ratio: 9 / 16 },
];

const DEFAULT_RECT: Rect = { x: 0.1, y: 0.1, w: 0.8, h: 0.8 };
const MIN_SIZE = 0.05;

export function CropModal({
  source,
  onClose,
  onApply,
}: {
  source: PickedImage;
  onClose: () => void;
  // Receives the cropped PickedImage (already uploaded). Caller is expected
  // to swap it into the references array.
  onApply: (cropped: PickedImage) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const dragRef = useRef<DragState | null>(null);

  const [rect, setRect] = useState<Rect>(DEFAULT_RECT);
  const [aspectId, setAspectId] = useState<string>("free");
  const [applying, setApplying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [naturalSize, setNaturalSize] = useState<{ w: number; h: number } | null>(null);

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

  function aspectRatio(): number | null {
    return ASPECT_PRESETS.find((p) => p.id === aspectId)?.ratio ?? null;
  }

  // Switching aspect ratio reshapes the current rect to honor it; centered
  // on the existing rect so the user doesn't lose their composition.
  function applyAspectToRect(ratio: number | null, r: Rect, displayRatio: number): Rect {
    if (ratio === null) return r;
    // Convert normalized w/h into pixel-space ratio inside the container,
    // then clamp.
    const cx = r.x + r.w / 2;
    const cy = r.y + r.h / 2;
    // Target rect: pick whichever of (current w, current h) is the binding
    // edge, derive the other from the ratio.
    // Express ratio in normalized space: width/height in 0..1 means we
    // need to account for the container's actual w/h px to map a "true"
    // ratio. displayRatio = containerWpx / containerHpx.
    // ratio_n = (w_n * containerW) / (h_n * containerH) → so h_n = w_n * dispRatio / ratio
    let w = r.w;
    let h = (w * displayRatio) / ratio;
    if (h > 1) {
      h = 1;
      w = (h * ratio) / displayRatio;
    }
    let x = cx - w / 2;
    let y = cy - h / 2;
    if (x < 0) x = 0;
    if (y < 0) y = 0;
    if (x + w > 1) x = 1 - w;
    if (y + h > 1) y = 1 - h;
    return { x, y, w, h };
  }

  useEffect(() => {
    const ratio = aspectRatio();
    const el = containerRef.current;
    if (!ratio || !el) return;
    const r = el.getBoundingClientRect();
    if (r.height === 0) return;
    setRect((prev) => applyAspectToRect(ratio, prev, r.width / r.height));
    // We intentionally exclude `rect` from deps: this fires only when the
    // user picks a different preset, not on every rect update.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aspectId]);

  function pointerToNorm(e: React.PointerEvent): { x: number; y: number } {
    const el = containerRef.current;
    if (!el) return { x: 0, y: 0 };
    const r = el.getBoundingClientRect();
    return {
      x: (e.clientX - r.left) / r.width,
      y: (e.clientY - r.top) / r.height,
    };
  }

  function onHandlePointerDown(handle: Handle) {
    return (e: React.PointerEvent) => {
      e.stopPropagation();
      (e.target as Element).setPointerCapture?.(e.pointerId);
      const { x, y } = pointerToNorm(e);
      dragRef.current = {
        handle,
        startRect: rect,
        startNormX: x,
        startNormY: y,
      };
    };
  }

  function onPointerMove(e: React.PointerEvent) {
    const drag = dragRef.current;
    if (!drag) return;
    const { x, y } = pointerToNorm(e);
    const dx = x - drag.startNormX;
    const dy = y - drag.startNormY;
    const el = containerRef.current;
    const dispRatio = el ? el.clientWidth / el.clientHeight : 1;
    const ratio = aspectRatio();

    let next: Rect = { ...drag.startRect };
    const r = drag.startRect;

    if (drag.handle === "move") {
      next.x = clamp01(r.x + dx, 0, 1 - r.w);
      next.y = clamp01(r.y + dy, 0, 1 - r.h);
    } else {
      // Corner drag — recompute one edge then clamp + optionally enforce
      // aspect ratio.
      if (drag.handle === "nw" || drag.handle === "sw") {
        const newX = clamp01(r.x + dx, 0, r.x + r.w - MIN_SIZE);
        next.w = r.x + r.w - newX;
        next.x = newX;
      } else {
        next.w = clamp01(r.w + dx, MIN_SIZE, 1 - r.x);
      }
      if (drag.handle === "nw" || drag.handle === "ne") {
        const newY = clamp01(r.y + dy, 0, r.y + r.h - MIN_SIZE);
        next.h = r.y + r.h - newY;
        next.y = newY;
      } else {
        next.h = clamp01(r.h + dy, MIN_SIZE, 1 - r.y);
      }

      if (ratio !== null) {
        // Recompute the non-pinned axis so the result honors ratio. The
        // anchor (opposite corner) stays fixed.
        const anchorX = drag.handle === "nw" || drag.handle === "sw"
          ? r.x + r.w
          : r.x;
        const anchorY = drag.handle === "nw" || drag.handle === "ne"
          ? r.y + r.h
          : r.y;
        // Derive h from w using display ratio so the visual rect is
        // proportionally correct, then clamp.
        let h = (next.w * dispRatio) / ratio;
        // If h would exceed the available vertical space from the anchor,
        // shrink w instead.
        const maxH = drag.handle === "nw" || drag.handle === "ne" ? anchorY : 1 - anchorY;
        if (h > maxH) {
          h = maxH;
          next.w = (h * ratio) / dispRatio;
        }
        next.h = h;
        // Recompute x/y from anchor.
        if (drag.handle === "nw" || drag.handle === "sw") {
          next.x = anchorX - next.w;
        }
        if (drag.handle === "nw" || drag.handle === "ne") {
          next.y = anchorY - next.h;
        }
      }
    }
    setRect(next);
  }

  function onPointerUp(e: React.PointerEvent) {
    (e.target as Element).releasePointerCapture?.(e.pointerId);
    dragRef.current = null;
  }

  function resetRect() {
    setRect(DEFAULT_RECT);
    setAspectId("free");
  }

  async function apply() {
    if (applying) return;
    setError(null);
    setApplying(true);
    try {
      const blob = await renderCropToBlob(source.preview, rect);
      const file = new File([blob], renamedFile(source.name), {
        type: "image/png",
      });
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: form });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || `upload failed (${res.status})`);
      }
      const { url } = (await res.json()) as { url: string };
      onApply({
        url,
        preview: URL.createObjectURL(blob),
        name: renamedFile(source.name),
      });
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "crop failed");
    } finally {
      setApplying(false);
    }
  }

  // Display-only rect (in pixels) for the live overlay.
  const px = (frac: number, total: number) => `${(frac * total).toFixed(2)}px`;

  // Cropped pixel dims, for the status line.
  const cropDimsLabel = naturalSize
    ? `${Math.round(rect.w * naturalSize.w)}×${Math.round(rect.h * naturalSize.h)}`
    : "—";

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="crop reference"
      onClick={onClose}
      className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-6 animate-in"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-[920px] h-[min(720px,calc(100vh-3rem))] rounded-xl border border-[var(--color-border)] overflow-hidden flex flex-col"
        style={{ backgroundColor: "var(--color-bg-elevated)" }}
      >
        <header className="flex items-center justify-between h-11 px-4 border-b border-[var(--color-border)] shrink-0">
          <div className="flex items-baseline gap-2 min-w-0">
            <h2 className="inline-flex items-center gap-2 text-[13px] font-semibold tracking-tight">
              <Crop className="size-3.5 text-[var(--color-muted)]" />
              Crop reference
            </h2>
            <span className="text-[11px] text-[var(--color-muted)] font-mono tabular-nums truncate">
              {cropDimsLabel}
            </span>
          </div>
          <button
            onClick={onClose}
            className="size-6 rounded-md grid place-items-center text-[var(--color-muted)] hover:text-[var(--color-fg)] hover:bg-[var(--color-surface)] transition"
            aria-label="close"
          >
            <X className="size-3.5" />
          </button>
        </header>

        <div className="flex-1 min-h-0 p-4 bg-black/40 grid place-items-center overflow-hidden">
          <div
            ref={containerRef}
            className="relative inline-block max-w-full max-h-full select-none"
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
          >
            { }
            <img
              ref={imgRef}
              src={source.preview}
              alt={source.name}
              draggable={false}
              onLoad={(e) => {
                const i = e.currentTarget;
                setNaturalSize({ w: i.naturalWidth, h: i.naturalHeight });
              }}
              className="max-h-[calc(100vh-16rem)] max-w-full object-contain block"
            />

            {/* Dim everything outside the crop with a 4-quadrant overlay. */}
            <div className="absolute inset-0 pointer-events-none">
              <Overlay rect={rect} />
            </div>

            {/* Crop rectangle + handles. */}
            <div
              role="region"
              aria-label="crop area"
              onPointerDown={onHandlePointerDown("move")}
              className="absolute border-2 border-white shadow-[0_0_0_1px_rgba(0,0,0,0.6)] cursor-move"
              style={{
                left: px(rect.x, containerRef.current?.clientWidth ?? 0),
                top: px(rect.y, containerRef.current?.clientHeight ?? 0),
                width: px(rect.w, containerRef.current?.clientWidth ?? 0),
                height: px(rect.h, containerRef.current?.clientHeight ?? 0),
              }}
            >
              <CornerHandle position="nw" onPointerDown={onHandlePointerDown("nw")} />
              <CornerHandle position="ne" onPointerDown={onHandlePointerDown("ne")} />
              <CornerHandle position="sw" onPointerDown={onHandlePointerDown("sw")} />
              <CornerHandle position="se" onPointerDown={onHandlePointerDown("se")} />
            </div>
          </div>
        </div>

        <div className="px-4 py-2 border-t border-[var(--color-border)] flex flex-wrap items-center gap-2 shrink-0">
          <span className="text-[10px] uppercase tracking-[0.08em] font-semibold text-[var(--color-muted)] mr-1">
            aspect
          </span>
          {ASPECT_PRESETS.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => setAspectId(p.id)}
              className={cn(
                "h-7 px-2.5 rounded-md border text-[11px] font-medium transition-colors",
                aspectId === p.id
                  ? "border-[var(--color-accent)] bg-[var(--color-accent-dim)] text-[var(--color-fg)]"
                  : "border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-muted)] hover:text-[var(--color-fg)] hover:border-[var(--color-border-strong)]"
              )}
            >
              {p.label}
            </button>
          ))}
          <div className="flex-1" />
          <button
            type="button"
            onClick={resetRect}
            className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-md text-[11px] font-medium text-[var(--color-muted)] hover:text-[var(--color-fg)] transition"
            title="reset crop"
          >
            <RotateCcw className="size-3" />
            reset
          </button>
        </div>

        <footer className="border-t border-[var(--color-border)] p-3 flex items-center justify-between gap-3 shrink-0">
          <div className="text-[11px] text-[var(--color-muted)] min-w-0">
            {error ? (
              <span className="text-[var(--color-danger)]">{error}</span>
            ) : (
              <>Result re-uploads to fal and lands in your uploads library.</>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="inline-flex items-center justify-center h-8 px-3 rounded-md bg-[var(--color-surface)] hover:bg-[var(--color-surface-hover)] border border-[var(--color-border)] text-[12px] font-medium transition"
            >
              Cancel
            </button>
            <Button onClick={apply} disabled={applying}>
              {applying ? <Loader2 className="size-3.5 animate-spin" /> : <Crop className="size-3.5" />}
              Apply crop
            </Button>
          </div>
        </footer>
      </div>
    </div>
  );
}

function CornerHandle({
  position,
  onPointerDown,
}: {
  position: "nw" | "ne" | "sw" | "se";
  onPointerDown: (e: React.PointerEvent) => void;
}) {
  const positionClass = {
    nw: "-top-1.5 -left-1.5 cursor-nw-resize",
    ne: "-top-1.5 -right-1.5 cursor-ne-resize",
    sw: "-bottom-1.5 -left-1.5 cursor-sw-resize",
    se: "-bottom-1.5 -right-1.5 cursor-se-resize",
  }[position];
  return (
    <div
      role="button"
      aria-label={`resize ${position}`}
      onPointerDown={onPointerDown}
      className={cn(
        "absolute size-3 rounded-sm bg-white border border-black/40 touch-none",
        positionClass
      )}
    />
  );
}

function Overlay({ rect }: { rect: Rect }) {
  // Four black/50 panels around the crop rectangle, expressed as CSS
  // percentages so they scale with the container.
  const r = rect;
  return (
    <>
      <div
        className="absolute bg-black/55"
        style={{ left: 0, top: 0, right: 0, height: `${r.y * 100}%` }}
      />
      <div
        className="absolute bg-black/55"
        style={{ left: 0, top: `${(r.y + r.h) * 100}%`, right: 0, bottom: 0 }}
      />
      <div
        className="absolute bg-black/55"
        style={{
          left: 0,
          top: `${r.y * 100}%`,
          width: `${r.x * 100}%`,
          height: `${r.h * 100}%`,
        }}
      />
      <div
        className="absolute bg-black/55"
        style={{
          left: `${(r.x + r.w) * 100}%`,
          top: `${r.y * 100}%`,
          right: 0,
          height: `${r.h * 100}%`,
        }}
      />
    </>
  );
}

function clamp01(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

function renamedFile(originalName: string): string {
  const dot = originalName.lastIndexOf(".");
  const base = dot > 0 ? originalName.slice(0, dot) : originalName;
  return `${base}-cropped.png`;
}

// Rasterizes the cropped region from `imageSrc` into a PNG blob using a
// hidden canvas. Done at the source image's natural resolution so quality
// isn't lost — the rect is normalized 0..1, multiplied by natural dims.
async function renderCropToBlob(imageSrc: string, rect: Rect): Promise<Blob> {
  const img = new Image();
  img.src = imageSrc;
  await new Promise<void>((resolve, reject) => {
    if (img.complete && img.naturalWidth > 0) {
      resolve();
      return;
    }
    img.onload = () => resolve();
    img.onerror = () => reject(new Error("could not load source image"));
  });
  const sw = img.naturalWidth * rect.w;
  const sh = img.naturalHeight * rect.h;
  const sx = img.naturalWidth * rect.x;
  const sy = img.naturalHeight * rect.y;
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(sw));
  canvas.height = Math.max(1, Math.round(sh));
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas 2d unavailable");
  ctx.drawImage(img, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("canvas toBlob returned null"))),
      "image/png"
    );
  });
}
