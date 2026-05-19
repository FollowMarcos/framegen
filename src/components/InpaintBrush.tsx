"use client";

import { useEffect, useRef, useState } from "react";
import { Eraser, Loader2, Paintbrush, RotateCcw, Save, X } from "lucide-react";
import { Button } from "@/components/fields";
import type { PickedImage } from "@/components/ImagePicker";
import { cn } from "@/lib/utils";

// Canvas-based mask editor. The user paints white strokes on a black canvas
// the same size as the source image. We export the mask as a PNG, upload it
// to fal storage, and call back with the resulting URL.
//
// Output convention (matches /api/generate's mask_url usage): white pixels
// = "edit this area", black pixels = "keep".
export function InpaintBrush({
  source,
  onClose,
  onMaskReady,
}: {
  source: PickedImage;
  onClose: () => void;
  onMaskReady: (mask: PickedImage) => void;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  // Two canvases overlaid on the image: the "mask" stores the actual data
  // (black/white) we'll export; the "display" shows the user a tinted preview
  // (semi-transparent accent color where they've painted).
  const maskCanvasRef = useRef<HTMLCanvasElement>(null);
  const displayCanvasRef = useRef<HTMLCanvasElement>(null);

  const [brushSize, setBrushSize] = useState(40);
  const [mode, setMode] = useState<"paint" | "erase">("paint");
  const [drawing, setDrawing] = useState(false);
  const [ready, setReady] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hover, setHover] = useState<{ x: number; y: number } | null>(null);

  // Set canvases to the natural image size once it loads.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
      if (e.key === "[") setBrushSize((s) => Math.max(4, s - 4));
      if (e.key === "]") setBrushSize((s) => Math.min(200, s + 4));
      if (e.key.toLowerCase() === "b") setMode("paint");
      if (e.key.toLowerCase() === "e") setMode("erase");
    }
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  function initCanvases() {
    const img = imgRef.current;
    const mask = maskCanvasRef.current;
    const disp = displayCanvasRef.current;
    if (!img || !mask || !disp || img.naturalWidth === 0) return;
    mask.width = img.naturalWidth;
    mask.height = img.naturalHeight;
    disp.width = img.naturalWidth;
    disp.height = img.naturalHeight;
    const mctx = mask.getContext("2d");
    if (mctx) {
      mctx.fillStyle = "#000000";
      mctx.fillRect(0, 0, mask.width, mask.height);
    }
    setReady(true);
  }

  function clearMask() {
    const mask = maskCanvasRef.current;
    const disp = displayCanvasRef.current;
    if (!mask || !disp) return;
    const mctx = mask.getContext("2d");
    const dctx = disp.getContext("2d");
    if (mctx) {
      mctx.fillStyle = "#000000";
      mctx.fillRect(0, 0, mask.width, mask.height);
    }
    if (dctx) dctx.clearRect(0, 0, disp.width, disp.height);
  }

  function pointFromEvent(e: React.PointerEvent<HTMLDivElement>) {
    const img = imgRef.current;
    if (!img) return null;
    const rect = img.getBoundingClientRect();
    const scaleX = img.naturalWidth / rect.width;
    const scaleY = img.naturalHeight / rect.height;
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
      screenX: e.clientX - rect.left,
      screenY: e.clientY - rect.top,
    };
  }

  function stroke(from: { x: number; y: number } | null, to: { x: number; y: number }) {
    const mask = maskCanvasRef.current;
    const disp = displayCanvasRef.current;
    if (!mask || !disp) return;

    const mctx = mask.getContext("2d");
    const dctx = disp.getContext("2d");
    if (!mctx || !dctx) return;

    const paint = mode === "paint";

    // Mask canvas: write data (white = edit, black = keep).
    mctx.lineWidth = brushSize;
    mctx.lineCap = "round";
    mctx.lineJoin = "round";
    mctx.strokeStyle = paint ? "#ffffff" : "#000000";
    mctx.beginPath();
    if (from) mctx.moveTo(from.x, from.y);
    else mctx.moveTo(to.x, to.y);
    mctx.lineTo(to.x, to.y);
    mctx.stroke();

    // Display canvas: paint a translucent accent color so the user sees their mask.
    dctx.lineWidth = brushSize;
    dctx.lineCap = "round";
    dctx.lineJoin = "round";
    if (paint) {
      dctx.globalCompositeOperation = "source-over";
      dctx.strokeStyle = "rgba(167, 139, 250, 0.55)";
    } else {
      dctx.globalCompositeOperation = "destination-out";
      dctx.strokeStyle = "rgba(0, 0, 0, 1)";
    }
    dctx.beginPath();
    if (from) dctx.moveTo(from.x, from.y);
    else dctx.moveTo(to.x, to.y);
    dctx.lineTo(to.x, to.y);
    dctx.stroke();
    dctx.globalCompositeOperation = "source-over";
  }

  const lastRef = useRef<{ x: number; y: number } | null>(null);

  function onPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    if (!ready) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    setDrawing(true);
    const p = pointFromEvent(e);
    if (!p) return;
    lastRef.current = { x: p.x, y: p.y };
    stroke(null, { x: p.x, y: p.y });
    setHover({ x: p.screenX, y: p.screenY });
  }

  function onPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    const p = pointFromEvent(e);
    if (p) setHover({ x: p.screenX, y: p.screenY });
    if (!drawing || !p) return;
    stroke(lastRef.current, { x: p.x, y: p.y });
    lastRef.current = { x: p.x, y: p.y };
  }

  function onPointerUp(e: React.PointerEvent<HTMLDivElement>) {
    setDrawing(false);
    lastRef.current = null;
    e.currentTarget.releasePointerCapture(e.pointerId);
  }

  async function saveMask() {
    if (saving) return;
    const mask = maskCanvasRef.current;
    if (!mask) return;
    // Detect empty mask (all black).
    const ctx = mask.getContext("2d");
    if (ctx) {
      const pixels = ctx.getImageData(0, 0, mask.width, mask.height).data;
      let anyWhite = false;
      // Sample every 4th pixel for speed.
      for (let i = 0; i < pixels.length; i += 16) {
        if (pixels[i] > 16) {
          anyWhite = true;
          break;
        }
      }
      if (!anyWhite) {
        setError("paint at least one stroke first");
        return;
      }
    }

    setSaving(true);
    setError(null);
    try {
      const blob: Blob | null = await new Promise((resolve) =>
        mask.toBlob((b) => resolve(b), "image/png")
      );
      if (!blob) throw new Error("could not export mask");
      const file = new File([blob], "inpaint-mask.png", { type: "image/png" });
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: form });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || `upload failed (${res.status})`);
      }
      const { url } = (await res.json()) as { url: string };
      const preview = URL.createObjectURL(blob);
      onMaskReady({ url, preview, name: "inpaint-mask.png" });
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "save failed");
      setSaving(false);
    }
  }

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
          <h2 className="text-[13px] font-semibold tracking-tight">paint mask</h2>
          <span className="text-[11px] text-[var(--color-muted)]">
            white = edit · black = keep
          </span>
        </div>
        <button
          onClick={onClose}
          className="size-7 rounded-md grid place-items-center text-[var(--color-muted)] hover:text-[var(--color-fg)] hover:bg-[var(--color-surface)] transition"
          aria-label="close"
        >
          <X className="size-4" />
        </button>
      </header>

      <div
        ref={wrapRef}
        onClick={(e) => e.stopPropagation()}
        className="flex-1 min-h-0 grid place-items-center relative"
      >
        <div
          className="relative inline-block"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerLeave={() => setHover(null)}
          style={{ cursor: ready ? "none" : "default" }}
        >
          { }
          <img
            ref={imgRef}
            src={source.preview}
            alt="source"
            draggable={false}
            onLoad={initCanvases}
            className="max-h-[calc(100vh-12rem)] max-w-full object-contain block select-none"
          />
          <canvas
            ref={displayCanvasRef}
            className="absolute inset-0 w-full h-full pointer-events-none"
            aria-hidden
          />
          {/* mask canvas is hidden — it holds the data we export */}
          <canvas
            ref={maskCanvasRef}
            className="hidden"
            aria-hidden
          />
          {ready && hover && (
            <div
              aria-hidden
              className="absolute pointer-events-none rounded-full border border-white/80"
              style={{
                left: hover.x,
                top: hover.y,
                width: brushSizeOnScreen(brushSize, imgRef.current),
                height: brushSizeOnScreen(brushSize, imgRef.current),
                transform: "translate(-50%, -50%)",
                boxShadow: "0 0 0 1px rgba(0,0,0,0.5)",
              }}
            />
          )}
        </div>
      </div>

      <footer
        onClick={(e) => e.stopPropagation()}
        className="shrink-0 mt-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-elevated)] p-3 flex items-center gap-3 flex-wrap"
      >
        <ToolToggle
          active={mode === "paint"}
          onClick={() => setMode("paint")}
          label="brush · b"
          icon={<Paintbrush className="size-3.5" />}
        />
        <ToolToggle
          active={mode === "erase"}
          onClick={() => setMode("erase")}
          label="eraser · e"
          icon={<Eraser className="size-3.5" />}
        />

        <div className="flex items-center gap-2 flex-1 min-w-[180px]">
          <span className="text-[10px] text-[var(--color-muted)] font-mono w-12">
            size {brushSize}
          </span>
          <input
            type="range"
            min={4}
            max={200}
            value={brushSize}
            onChange={(e) => setBrushSize(parseInt(e.target.value, 10))}
            className="flex-1 accent-[var(--color-accent)]"
          />
        </div>

        <button
          type="button"
          onClick={clearMask}
          className="inline-flex items-center gap-1.5 h-8 px-2.5 rounded-md bg-[var(--color-surface)] border border-[var(--color-border)] text-[12px] text-[var(--color-muted)] hover:text-[var(--color-fg)] hover:border-[var(--color-border-strong)] transition"
        >
          <RotateCcw className="size-3.5" />
          clear
        </button>

        {error && (
          <span className="text-[11px] text-[var(--color-danger)] mr-2">{error}</span>
        )}

        <Button onClick={saveMask} loading={saving}>
          {!saving && <Save className="size-3.5" />}
          use mask
        </Button>
      </footer>
    </div>
  );
}

function brushSizeOnScreen(
  natural: number,
  img: HTMLImageElement | null
): number {
  if (!img || img.naturalWidth === 0) return natural;
  const rect = img.getBoundingClientRect();
  return Math.max(4, (rect.width / img.naturalWidth) * natural);
}

function ToolToggle({
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
      onClick={onClick}
      aria-pressed={active}
      title={label}
      className={cn(
        "inline-flex items-center gap-1.5 h-8 px-2.5 rounded-md text-[12px] transition-colors",
        active
          ? "bg-[var(--color-accent)] text-[var(--color-fg-on-accent)]"
          : "bg-[var(--color-surface)] border border-[var(--color-border)] text-[var(--color-muted)] hover:text-[var(--color-fg)] hover:border-[var(--color-border-strong)]"
      )}
    >
      {icon}
      {label.split(" · ")[0]}
    </button>
  );
}
