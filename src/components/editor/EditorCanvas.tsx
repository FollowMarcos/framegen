"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Stage,
  Layer,
  Image as KonvaImage,
  Text as KonvaText,
  Transformer,
  Rect,
} from "react-konva";
import type Konva from "konva";
import { Maximize, Minus, Plus } from "lucide-react";
import type { EditorDoc, ImageOverlay, Overlay, TextOverlay } from "@/lib/editor/types";
import { buildCssFilter } from "@/lib/editor/adjustments";
import { resolveFontFamily } from "@/lib/editor/fontModules";

// Resolves an image URL into an HTMLImageElement once it has loaded.
// Returns null while loading so the canvas can skip the node rather than
// crash on undefined.naturalWidth.
function useImageElement(url: string | null | undefined): HTMLImageElement | null {
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  useEffect(() => {
    if (!url) {
      setImg(null);
      return;
    }
    const el = new window.Image();
    el.crossOrigin = "anonymous";
    el.src = url;
    let cancelled = false;
    el.onload = () => {
      if (!cancelled) setImg(el);
    };
    return () => {
      cancelled = true;
    };
  }, [url]);
  return img;
}

function ImageOverlayNode({
  overlay,
  isSelected,
  onSelect,
  onChange,
}: {
  overlay: ImageOverlay;
  isSelected: boolean;
  onSelect: () => void;
  onChange: (patch: Partial<ImageOverlay>) => void;
}) {
  const img = useImageElement(overlay.assetUrl);
  const ref = useRef<Konva.Image | null>(null);

  if (!img) return null;
  return (
    <KonvaImage
      ref={ref}
      id={overlay.id}
      image={img}
      x={overlay.x}
      y={overlay.y}
      width={overlay.width}
      height={overlay.height}
      rotation={overlay.rotation}
      opacity={overlay.hidden ? 0 : overlay.opacity}
      listening={!overlay.locked && !overlay.hidden}
      draggable={!overlay.locked && !overlay.hidden}
      onMouseDown={onSelect}
      onTap={onSelect}
      onDragEnd={(e) => onChange({ x: e.target.x(), y: e.target.y() })}
      onTransformEnd={() => {
        const node = ref.current;
        if (!node) return;
        const sx = node.scaleX();
        const sy = node.scaleY();
        node.scaleX(1);
        node.scaleY(1);
        onChange({
          x: node.x(),
          y: node.y(),
          width: Math.max(8, node.width() * sx),
          height: Math.max(8, node.height() * sy),
          rotation: node.rotation(),
        });
      }}
      stroke={isSelected ? "#3b82f6" : undefined}
      strokeWidth={isSelected ? 1 : 0}
      strokeScaleEnabled={false}
    />
  );
}

function TextOverlayNode({
  overlay,
  onSelect,
  onChange,
}: {
  overlay: TextOverlay;
  isSelected: boolean;
  onSelect: () => void;
  onChange: (patch: Partial<TextOverlay>) => void;
}) {
  const ref = useRef<Konva.Text | null>(null);
  const fontStyle = `${overlay.italic ? "italic " : ""}${overlay.fontWeight}`;
  // Effect props are optional; Konva treats undefined as "no stroke /
  // no shadow", so we can spread the overlay's values through without
  // gating on truthiness for every field individually.
  const strokeProps = overlay.stroke
    ? {
        stroke: overlay.stroke.color,
        strokeWidth: overlay.stroke.width,
        fillAfterStrokeEnabled: true,
        // Stroke is drawn at scene scale; without this the outline
        // thickens at high zoom and disappears at low zoom.
        strokeScaleEnabled: false,
      }
    : {};
  const shadowProps = overlay.shadow
    ? {
        shadowColor: overlay.shadow.color,
        shadowBlur: overlay.shadow.blur,
        shadowOffsetX: overlay.shadow.offsetX,
        shadowOffsetY: overlay.shadow.offsetY,
        shadowOpacity: overlay.shadow.opacity,
      }
    : {};
  return (
    <KonvaText
      ref={ref}
      id={overlay.id}
      text={overlay.text || " "}
      x={overlay.x}
      y={overlay.y}
      width={overlay.width}
      rotation={overlay.rotation}
      opacity={overlay.hidden ? 0 : overlay.opacity}
      fontFamily={resolveFontFamily(overlay.fontFamily)}
      fontSize={overlay.fontSize}
      fontStyle={fontStyle}
      textDecoration={overlay.underline ? "underline" : ""}
      fill={overlay.color}
      align={overlay.align}
      lineHeight={overlay.lineHeight}
      letterSpacing={overlay.letterSpacing}
      {...strokeProps}
      {...shadowProps}
      listening={!overlay.locked && !overlay.hidden}
      draggable={!overlay.locked && !overlay.hidden}
      onMouseDown={onSelect}
      onTap={onSelect}
      onDragEnd={(e) => onChange({ x: e.target.x(), y: e.target.y() })}
      onTransformEnd={() => {
        const node = ref.current;
        if (!node) return;
        const sx = node.scaleX();
        node.scaleX(1);
        node.scaleY(1);
        onChange({
          x: node.x(),
          y: node.y(),
          width: Math.max(20, node.width() * sx),
          fontSize: Math.max(8, overlay.fontSize * sx),
          rotation: node.rotation(),
        });
      }}
    />
  );
}

// View state describes the user's pan + zoom on top of the doc's own
// coordinate system. `fit` mode auto-fills the viewport with a small
// margin; `manual` lets the user drive scale and offset directly via
// wheel, pinch, or the on-canvas zoom controls.
type ViewState =
  | { mode: "fit" }
  | { mode: "manual"; scale: number; offsetX: number; offsetY: number };

const MIN_ZOOM = 0.1;
const MAX_ZOOM = 8;
const ZOOM_STEP = 1.2;

// Computes the fit scale + center offset given the container and doc
// dimensions. Pulled out so we can use the same math in `fit` mode and
// after the user clicks the "Fit" button to re-center.
function computeFit(
  containerW: number,
  containerH: number,
  docW: number,
  docH: number
): { scale: number; offsetX: number; offsetY: number } {
  if (!containerW || !containerH || !docW || !docH) {
    return { scale: 1, offsetX: 0, offsetY: 0 };
  }
  const pad = 48;
  const sx = (containerW - pad) / docW;
  const sy = (containerH - pad) / docH;
  const scale = Math.min(sx, sy, 1);
  const offsetX = (containerW - docW * scale) / 2;
  const offsetY = (containerH - docH * scale) / 2;
  return { scale, offsetX, offsetY };
}

export function EditorCanvas({
  doc,
  onSelect,
  onUpdateOverlay,
  stageRef,
}: {
  doc: EditorDoc;
  onSelect: (id: string | null) => void;
  onUpdateOverlay: (id: string, patch: Partial<Overlay>) => void;
  stageRef: React.MutableRefObject<Konva.Stage | null>;
}) {
  const base = useImageElement(doc.base?.assetUrl);
  const transformerRef = useRef<Konva.Transformer | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });

  // View transform: defaults to fit. The user takes manual control with
  // the first zoom gesture (wheel, pinch, +/− button) and stays manual
  // until they click "Fit" again.
  const [view, setView] = useState<ViewState>({ mode: "fit" });

  // Track whether space is held — when down, drag the stage to pan; when
  // up, dragging hits overlays as usual. Captured at the document level
  // since the canvas may not have focus.
  const [spaceDown, setSpaceDown] = useState(false);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.code === "Space") {
        const active = document.activeElement;
        const inField =
          active instanceof HTMLInputElement ||
          active instanceof HTMLTextAreaElement ||
          (active instanceof HTMLElement && active.isContentEditable);
        if (!inField) {
          e.preventDefault();
          setSpaceDown(true);
        }
      }
    }
    function onKeyUp(e: KeyboardEvent) {
      if (e.code === "Space") setSpaceDown(false);
    }
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, []);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const obs = new ResizeObserver((entries) => {
      const r = entries[0];
      if (!r) return;
      setContainerSize({
        width: r.contentRect.width,
        height: r.contentRect.height,
      });
    });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  const rotated = doc.adjustments.rotate === 90 || doc.adjustments.rotate === 270;
  const docW = rotated ? doc.canvas.height : doc.canvas.width;
  const docH = rotated ? doc.canvas.width : doc.canvas.height;

  // Resolve view state to concrete scale + offset numbers used by the
  // Stage. `fit` recomputes on every container/doc resize; `manual`
  // passes through the stored values.
  const fit = computeFit(containerSize.width, containerSize.height, docW, docH);
  const scale = view.mode === "fit" ? fit.scale : view.scale;
  const offsetX = view.mode === "fit" ? fit.offsetX : view.offsetX;
  const offsetY = view.mode === "fit" ? fit.offsetY : view.offsetY;

  // Wheel handler: ctrl/cmd-wheel zooms toward the cursor, plain wheel
  // pans. Trackpad pinch fires wheel with ctrlKey=true on most browsers.
  const onWheel = useCallback(
    (e: Konva.KonvaEventObject<WheelEvent>) => {
      e.evt.preventDefault();
      const stage = stageRef.current;
      if (!stage) return;

      if (e.evt.ctrlKey || e.evt.metaKey) {
        const direction = e.evt.deltaY > 0 ? 1 / ZOOM_STEP : ZOOM_STEP;
        const newScale = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, scale * direction));
        // Anchor the zoom to the cursor so the point under the mouse
        // stays put. Formula: newOffset = pointer - (pointer - oldOffset) * (newScale/oldScale)
        const pointer = stage.getPointerPosition();
        if (!pointer) return;
        const newOffsetX = pointer.x - ((pointer.x - offsetX) * newScale) / scale;
        const newOffsetY = pointer.y - ((pointer.y - offsetY) * newScale) / scale;
        setView({
          mode: "manual",
          scale: newScale,
          offsetX: newOffsetX,
          offsetY: newOffsetY,
        });
      } else {
        // Plain wheel pans the canvas. Negative deltaY means scroll up,
        // which should move the doc downward.
        setView((v) => {
          const cur =
            v.mode === "manual"
              ? v
              : { mode: "manual" as const, scale: fit.scale, offsetX: fit.offsetX, offsetY: fit.offsetY };
          return {
            mode: "manual",
            scale: cur.scale,
            offsetX: cur.offsetX - e.evt.deltaX,
            offsetY: cur.offsetY - e.evt.deltaY,
          };
        });
      }
    },
    [scale, offsetX, offsetY, fit, stageRef]
  );

  // Zoom in/out by a fixed factor, anchored at the viewport center.
  const zoomBy = useCallback(
    (factor: number) => {
      const newScale = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, scale * factor));
      const cx = containerSize.width / 2;
      const cy = containerSize.height / 2;
      const newOffsetX = cx - ((cx - offsetX) * newScale) / scale;
      const newOffsetY = cy - ((cy - offsetY) * newScale) / scale;
      setView({ mode: "manual", scale: newScale, offsetX: newOffsetX, offsetY: newOffsetY });
    },
    [scale, offsetX, offsetY, containerSize]
  );

  const zoomToFit = useCallback(() => setView({ mode: "fit" }), []);
  const zoomTo100 = useCallback(() => {
    const cx = containerSize.width / 2;
    const cy = containerSize.height / 2;
    setView({
      mode: "manual",
      scale: 1,
      offsetX: cx - docW / 2,
      offsetY: cy - docH / 2,
    });
  }, [containerSize, docW, docH]);

  // Keyboard shortcuts for zoom: ⌘0 → fit, ⌘1 → 100%, ⌘+/⌘− to zoom.
  // These are global so the editor responds even when focus isn't on the
  // canvas itself.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (!(e.metaKey || e.ctrlKey)) return;
      const active = document.activeElement;
      const inField =
        active instanceof HTMLInputElement ||
        active instanceof HTMLTextAreaElement ||
        (active instanceof HTMLElement && active.isContentEditable);
      if (inField) return;
      if (e.key === "0") {
        e.preventDefault();
        zoomToFit();
      } else if (e.key === "1") {
        e.preventDefault();
        zoomTo100();
      } else if (e.key === "=" || e.key === "+") {
        e.preventDefault();
        zoomBy(ZOOM_STEP);
      } else if (e.key === "-") {
        e.preventDefault();
        zoomBy(1 / ZOOM_STEP);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [zoomToFit, zoomTo100, zoomBy]);

  useEffect(() => {
    const tr = transformerRef.current;
    const stage = stageRef.current;
    if (!tr || !stage) return;
    if (!doc.selectedId) {
      tr.nodes([]);
      tr.getLayer()?.batchDraw();
      return;
    }
    const node = stage.findOne(`#${doc.selectedId}`);
    tr.nodes(node ? [node] : []);
    tr.getLayer()?.batchDraw();
  }, [doc.selectedId, doc.overlays, stageRef]);

  const cssFilter = buildCssFilter(doc.adjustments);

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full overflow-hidden bg-[var(--color-bg)]"
      style={{
        minHeight: 0,
        cursor: spaceDown ? "grab" : "default",
        // Subtle dot pattern outside the doc — gives the viewport a
        // sense of "infinite canvas" when zoomed in past the doc edge.
        backgroundImage:
          "radial-gradient(circle, var(--color-border) 1px, transparent 1px)",
        backgroundSize: "16px 16px",
      }}
    >
      {/* CSS filter wrapper sized to the *whole viewport* so the doc
          stays filtered regardless of where the user has panned the
          stage. The Stage itself sits inside and gets the transform. */}
      <div
        className="absolute inset-0"
        style={{ filter: cssFilter }}
      >
        <Stage
          ref={(node) => {
            stageRef.current = node;
          }}
          width={containerSize.width}
          height={containerSize.height}
          scaleX={scale}
          scaleY={scale}
          x={offsetX}
          y={offsetY}
          draggable={spaceDown}
          onWheel={onWheel}
          onDragEnd={(e) => {
            if (!spaceDown) return;
            const stage = e.target;
            setView({
              mode: "manual",
              scale,
              offsetX: stage.x(),
              offsetY: stage.y(),
            });
          }}
          onMouseDown={(e) => {
            if (e.target === e.target.getStage()) onSelect(null);
          }}
          onTap={(e) => {
            if (e.target === e.target.getStage()) onSelect(null);
          }}
        >
          <Layer listening>
            <Rect
              x={0}
              y={0}
              width={docW}
              height={docH}
              fill={doc.canvas.background}
              shadowColor="black"
              shadowBlur={20}
              shadowOpacity={0.4}
              shadowOffsetY={6}
            />
            {base && doc.base && (
              <KonvaImage
                image={base}
                x={doc.canvas.width / 2}
                y={doc.canvas.height / 2}
                width={doc.canvas.width}
                height={doc.canvas.height}
                offsetX={doc.canvas.width / 2}
                offsetY={doc.canvas.height / 2}
                rotation={doc.adjustments.rotate}
                listening={false}
              />
            )}
            {doc.overlays.map((o) => {
              const isSelected = doc.selectedId === o.id;
              const onSel = () => onSelect(o.id);
              if (o.kind === "image") {
                return (
                  <ImageOverlayNode
                    key={o.id}
                    overlay={o}
                    isSelected={isSelected}
                    onSelect={onSel}
                    onChange={(patch) => onUpdateOverlay(o.id, patch)}
                  />
                );
              }
              return (
                <TextOverlayNode
                  key={o.id}
                  overlay={o}
                  isSelected={isSelected}
                  onSelect={onSel}
                  onChange={(patch) => onUpdateOverlay(o.id, patch)}
                />
              );
            })}
            <Transformer
              ref={transformerRef}
              rotateEnabled
              keepRatio={false}
              borderStroke="#3b82f6"
              anchorStroke="#3b82f6"
              anchorFill="#ffffff"
              anchorSize={8}
              ignoreStroke
            />
          </Layer>
        </Stage>
      </div>

      {/* Zoom HUD — bottom-right. Floats above the canvas, doesn't take
          part in the filter wrapper so it stays color-accurate even when
          adjustments swing hard. */}
      <div className="absolute bottom-3 right-3 flex items-center gap-0.5 p-0.5 rounded-md bg-[var(--color-bg-elevated)]/95 backdrop-blur border border-[var(--color-border)] shadow-lg">
        <ZoomBtn onClick={() => zoomBy(1 / ZOOM_STEP)} title="zoom out (⌘ −)">
          <Minus className="size-3.5" />
        </ZoomBtn>
        <button
          type="button"
          onClick={zoomTo100}
          title="zoom to 100% (⌘ 1)"
          className="h-7 px-2 text-[11px] font-mono tabular-nums text-[var(--color-fg-dim)] hover:text-[var(--color-fg)] hover:bg-[var(--color-surface)] rounded transition min-w-[3.5rem]"
        >
          {Math.round(scale * 100)}%
        </button>
        <ZoomBtn onClick={() => zoomBy(ZOOM_STEP)} title="zoom in (⌘ +)">
          <Plus className="size-3.5" />
        </ZoomBtn>
        <div className="mx-0.5 h-4 w-px bg-[var(--color-border)]" aria-hidden />
        <ZoomBtn
          onClick={zoomToFit}
          title="fit to screen (⌘ 0)"
          active={view.mode === "fit"}
        >
          <Maximize className="size-3.5" />
        </ZoomBtn>
      </div>
    </div>
  );
}

function ZoomBtn({
  onClick,
  title,
  active,
  children,
}: {
  onClick: () => void;
  title: string;
  active?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      aria-label={title}
      className={
        "size-7 grid place-items-center rounded transition-colors " +
        (active
          ? "text-[var(--color-accent)] bg-[var(--color-surface)]"
          : "text-[var(--color-muted)] hover:text-[var(--color-fg)] hover:bg-[var(--color-surface)]")
      }
    >
      {children}
    </button>
  );
}
