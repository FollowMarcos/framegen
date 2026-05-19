"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import type Konva from "konva";
import type {
  AdjustmentStack,
  EditorDoc,
  ImageOverlay,
  Overlay,
  TextOverlay,
} from "@/lib/editor/types";
import { useEditorStore } from "@/lib/editor/store";
import { useGoogleFonts } from "@/lib/editor/useGoogleFonts";
import { emojiSvgUrl } from "@/lib/editor/twemoji";
import { saveDraft } from "@/lib/editor/drafts";
import { buildCssFilter, isIdentity } from "@/lib/editor/adjustments";
import { EditorToolbar } from "./EditorToolbar";
import { EditorCanvas } from "./EditorCanvas";
import { EditorAssetPicker } from "./EditorAssetPicker";
import { AdjustmentRail } from "./AdjustmentRail";
import { LayerRail } from "./LayerRail";
import { TextOverlayPanel } from "./TextOverlayPanel";

// ID generator for newly-spawned overlays. Doesn't need to be globally
// unique — just per-doc, so the array indices and findOne lookups don't
// collide.
function makeOverlayId(): string {
  return `o_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
}

export function EditorShell({ initial }: { initial: EditorDoc }) {
  const router = useRouter();
  const pathname = usePathname();
  const { state, dispatch, raw, canUndo, canRedo } = useEditorStore(initial);
  const { doc } = state;
  const stageRef = useRef<Konva.Stage | null>(null);

  // Mirror every mutation to localStorage immediately (no debounce) so
  // a refresh, browser crash, or lost connection can lose at most the
  // last keystroke. The server-side autosave below still runs at its
  // own debounced cadence — localStorage is the crash-recovery cache
  // beneath it.
  useEffect(() => {
    saveDraft(doc);
  }, [doc]);

  // URL upgrade: when the shell is rendered at /editor (no id in the
  // path), replace the URL with /editor/<id> the moment the doc has
  // an id. This way a refresh keeps the same document instead of
  // spawning a new untitled one. We use router.replace so the back
  // button doesn't trap the user on the unidentified entry route.
  useEffect(() => {
    if (pathname === "/editor") {
      router.replace(`/editor/${doc.id}`);
    }
  }, [pathname, doc.id, router]);

  // Inject + wait for Google Fonts. Konva caches text metrics from the
  // moment a node is created; once a webfont swaps in the displayed
  // glyphs change but the cached width/height don't — text appears
  // clipped or mis-spaced until the next interaction. We poke the stage
  // into redrawing the instant fonts become ready so the user never
  // sees a misaligned text overlay.
  const fonts = useGoogleFonts();
  useEffect(() => {
    if (!fonts.fontsReady) return;
    const stage = stageRef.current;
    if (!stage) return;
    stage.getLayers().forEach((l) => l.batchDraw());
  }, [fonts.generation, fonts.fontsReady]);

  // Asset picker modal — opened from the toolbar's "+image" button.
  // Lives at shell level so it stacks above the canvas without z-index
  // contention against Konva's transformer handles.
  const [pickerOpen, setPickerOpen] = useState(false);

  // Auto-save: debounce 600ms after the last mutation. The flag drives
  // the "saving…" indicator in the toolbar so the user can see when
  // their work hits disk.
  const [saving, setSaving] = useState(false);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSavedRef = useRef<number>(doc.updatedAt);

  useEffect(() => {
    if (doc.updatedAt === lastSavedRef.current) return;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    setSaving(true);
    saveTimerRef.current = setTimeout(async () => {
      try {
        await fetch("/api/editor", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(doc),
        });
        // Best-effort thumbnail upload — if the stage isn't mounted
        // yet (shouldn't happen at this point but defensive), skip.
        const stage = stageRef.current;
        if (stage) {
          const dataUrl = stage.toDataURL({ pixelRatio: 0.5, mimeType: "image/png" });
          const blob = await (await fetch(dataUrl)).blob();
          await fetch(`/api/editor/${doc.id}/thumb`, {
            method: "POST",
            headers: { "content-type": "image/png" },
            body: blob,
          });
        }
        lastSavedRef.current = doc.updatedAt;
      } catch {
        // Surfacing save errors would need a toast; the local-first
        // contract is that the in-memory doc is the source of truth
        // and disk lags. A subsequent edit retries automatically.
      } finally {
        setSaving(false);
      }
    }, 600);
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, [doc]);

  // Keyboard shortcuts: ⌘Z / ⌘⇧Z for undo/redo, Del/Backspace to delete
  // the selected overlay (but only when no input is focused, so typing
  // into the text panel doesn't blow up your layer).
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const active = document.activeElement;
      const inField =
        active instanceof HTMLInputElement ||
        active instanceof HTMLTextAreaElement ||
        active instanceof HTMLSelectElement ||
        (active instanceof HTMLElement && active.isContentEditable);

      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (e.shiftKey) {
          if (canRedo) raw({ type: "REDO" });
        } else if (canUndo) {
          raw({ type: "UNDO" });
        }
        return;
      }
      if ((e.key === "Delete" || e.key === "Backspace") && !inField) {
        if (doc.selectedId) {
          e.preventDefault();
          dispatch({ type: "REMOVE_OVERLAY", id: doc.selectedId });
        }
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [canUndo, canRedo, doc.selectedId, dispatch, raw]);

  const onAddText = useCallback(() => {
    const id = makeOverlayId();
    const overlay: TextOverlay = {
      id,
      kind: "text",
      x: doc.canvas.width / 2 - 150,
      y: doc.canvas.height / 2 - 30,
      width: 300,
      height: 60,
      rotation: 0,
      opacity: 1,
      locked: false,
      hidden: false,
      text: "Double-click to edit",
      fontFamily: "Inter",
      fontSize: 48,
      fontWeight: 600,
      italic: false,
      underline: false,
      color: "#ffffff",
      align: "center",
      lineHeight: 1.2,
      letterSpacing: 0,
    };
    dispatch({ type: "ADD_OVERLAY", overlay });
  }, [doc.canvas.width, doc.canvas.height, dispatch]);

  // Adds an emoji as a sticker — rendered as a Twemoji SVG image
  // overlay rather than a text overlay. Konva's canvas text path can't
  // render color emoji glyphs reliably across platforms (Windows in
  // particular falls back to monochrome and reports NaN bounding
  // boxes), so we route through the same image-overlay code path
  // every other sticker uses. The picker stays open so the user can
  // stack several stickers in a row, mirroring Instagram stories.
  const onAddEmoji = useCallback(
    (emoji: string) => {
      const url = emojiSvgUrl(emoji);
      // SVG has no intrinsic pixel size — treat it as a square equal
      // to ~⅓ of the shortest dimension so it lands at sticker scale.
      const size = Math.min(doc.canvas.width, doc.canvas.height) / 3;
      const overlay: ImageOverlay = {
        id: makeOverlayId(),
        kind: "image",
        x: doc.canvas.width / 2 - size / 2,
        y: doc.canvas.height / 2 - size / 2,
        width: size,
        height: size,
        rotation: 0,
        opacity: 1,
        locked: false,
        hidden: false,
        assetUrl: url,
        naturalWidth: size,
        naturalHeight: size,
      };
      dispatch({ type: "ADD_OVERLAY", overlay });
    },
    [doc.canvas.width, doc.canvas.height, dispatch]
  );

  // Spawns an image from any picker source (generations, uploads, or a
  // fresh device upload).
  //
  // First image into an empty doc becomes the BASE layer — that's what
  // the Adjust rail acts on, and what 99% of users mean by "I just want
  // to edit this image". Resize the canvas to match so the doc isn't a
  // square-cropped 1024×1024 when the source was 1024×1536.
  //
  // Once a base exists, subsequent images stack as overlays scaled to
  // ~⅓ of the shortest dimension — large enough to grab, small enough
  // not to eclipse what's underneath.
  const onAddImageFromUrl = useCallback(
    (url: string, naturalWidth: number, naturalHeight: number) => {
      if (!doc.base) {
        dispatch({
          type: "SET_CANVAS",
          width: naturalWidth,
          height: naturalHeight,
        });
        dispatch({
          type: "SET_BASE",
          base: {
            assetUrl: url,
            naturalWidth,
            naturalHeight,
            crop: null,
          },
        });
        return;
      }

      const targetMax = Math.min(doc.canvas.width, doc.canvas.height) / 3;
      const ratio = naturalWidth / naturalHeight;
      const width = ratio > 1 ? targetMax : targetMax * ratio;
      const height = ratio > 1 ? targetMax / ratio : targetMax;

      const overlay: ImageOverlay = {
        id: makeOverlayId(),
        kind: "image",
        x: (doc.canvas.width - width) / 2,
        y: (doc.canvas.height - height) / 2,
        width,
        height,
        rotation: 0,
        opacity: 1,
        locked: false,
        hidden: false,
        assetUrl: url,
        naturalWidth,
        naturalHeight,
      };
      dispatch({ type: "ADD_OVERLAY", overlay });
    },
    [doc.base, doc.canvas.width, doc.canvas.height, dispatch]
  );

  const onExport = useCallback(async () => {
    const stage = stageRef.current;
    if (!stage) return;

    // The Stage is sized to the *viewport* so pan + zoom work natively;
    // this means a naive toDataURL() captures dark space outside the
    // doc plus the user's current zoom level. We temporarily snap the
    // Stage to identity + doc dimensions, capture, then restore the
    // transform exactly as the user left it.
    const rotated =
      doc.adjustments.rotate === 90 || doc.adjustments.rotate === 270;
    const docW = rotated ? doc.canvas.height : doc.canvas.width;
    const docH = rotated ? doc.canvas.width : doc.canvas.height;

    const savedScale = { x: stage.scaleX(), y: stage.scaleY() };
    const savedPos = { x: stage.x(), y: stage.y() };
    const savedSize = { width: stage.width(), height: stage.height() };

    stage.scale({ x: 1, y: 1 });
    stage.position({ x: 0, y: 0 });
    stage.size({ width: docW, height: docH });

    // pixelRatio=2 gives a retina-quality PNG without bloating files
    // for the common case. Bytes here are paid by the user's disk,
    // not the server, so the ceiling is generous.
    const rawDataUrl = stage.toDataURL({
      pixelRatio: 2,
      mimeType: "image/png",
    });

    stage.scale(savedScale);
    stage.position(savedPos);
    stage.size(savedSize);
    stage.batchDraw();

    // The Adjust rail's CSS filter lives on a wrapping <div>, not on
    // the Konva tree, so we bake it in here with a 2D canvas pass.
    // Skip the round-trip when the adjustment stack is identity —
    // saves a load + redraw on the common "no adjustments" case.
    const finalUrl = isIdentity(doc.adjustments)
      ? rawDataUrl
      : await applyCssFilter(rawDataUrl, buildCssFilter(doc.adjustments));

    const a = document.createElement("a");
    a.href = finalUrl;
    a.download = `${doc.name || "edit"}.png`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  }, [
    doc.name,
    doc.adjustments,
    doc.canvas.width,
    doc.canvas.height,
  ]);

  const onMoveOverlay = useCallback(
    (id: string, direction: 1 | -1) => {
      const idx = doc.overlays.findIndex((o) => o.id === id);
      if (idx === -1) return;
      const target = idx + direction;
      if (target < 0 || target >= doc.overlays.length) return;
      dispatch({ type: "REORDER_OVERLAYS", fromIndex: idx, toIndex: target });
    },
    [doc.overlays, dispatch]
  );

  const selected =
    doc.overlays.find((o) => o.id === doc.selectedId) ?? null;
  const baseSelected = doc.selectedId === null && !!doc.base;

  return (
    <div className="flex flex-col h-screen bg-[var(--color-bg)] text-[var(--color-fg)]">
      <EditorToolbar
        name={doc.name}
        onNameChange={(v) => dispatch({ type: "SET_NAME", name: v })}
        onAddText={onAddText}
        onAddEmoji={onAddEmoji}
        onOpenAssetPicker={() => setPickerOpen(true)}
        onExport={onExport}
        onUndo={() => raw({ type: "UNDO" })}
        onRedo={() => raw({ type: "REDO" })}
        canUndo={canUndo}
        canRedo={canRedo}
        saving={saving}
      />

      <div className="flex-1 flex min-h-0">
        <AdjustmentRail
          adjustments={doc.adjustments}
          hasBase={!!doc.base}
          onChange={(key, value) =>
            dispatch({ type: "SET_ADJUSTMENT", key, value })
          }
          onReset={() => dispatch({ type: "RESET_ADJUSTMENTS" })}
          onRotate={() => {
            const next = (((doc.adjustments.rotate + 90) % 360) as AdjustmentStack["rotate"]);
            dispatch({ type: "SET_ADJUSTMENT", key: "rotate", value: next });
          }}
        />

        <div className="flex-1 min-w-0 flex flex-col">
          <EditorCanvas
            doc={doc}
            stageRef={stageRef}
            onSelect={(id) => dispatch({ type: "SELECT", id })}
            onUpdateOverlay={(id, patch) =>
              dispatch({
                type: "UPDATE_OVERLAY",
                id,
                patch: patch as Partial<Overlay>,
              })
            }
          />
        </div>

        <div className="flex flex-col w-64 shrink-0">
          <LayerRail
            overlays={doc.overlays}
            selectedId={doc.selectedId}
            hasBase={!!doc.base}
            baseSelected={baseSelected}
            baseThumbUrl={doc.base?.assetUrl}
            onSelect={(id) => dispatch({ type: "SELECT", id })}
            onToggleHidden={(id, hidden) =>
              dispatch({ type: "UPDATE_OVERLAY", id, patch: { hidden } })
            }
            onToggleLocked={(id, locked) =>
              dispatch({ type: "UPDATE_OVERLAY", id, patch: { locked } })
            }
            onRemove={(id) => dispatch({ type: "REMOVE_OVERLAY", id })}
            onMove={onMoveOverlay}
          />
          {selected && selected.kind === "text" && (
            <TextOverlayPanel
              overlay={selected}
              onChange={(patch) =>
                dispatch({
                  type: "UPDATE_OVERLAY",
                  id: selected.id,
                  patch: patch as Partial<Overlay>,
                })
              }
            />
          )}
        </div>
      </div>

      {pickerOpen && (
        <EditorAssetPicker
          onClose={() => setPickerOpen(false)}
          onPick={(asset) =>
            onAddImageFromUrl(asset.url, asset.naturalWidth, asset.naturalHeight)
          }
        />
      )}
    </div>
  );
}

// Bakes a CSS `filter` string into an image data URL by round-tripping
// through a 2D canvas. The same trick the post composer uses — only
// way to make the editor's live Adjust rail (which sits on a wrapping
// <div>) land in the exported PNG.
async function applyCssFilter(dataUrl: string, filter: string): Promise<string> {
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const el = new window.Image();
    el.onload = () => resolve(el);
    el.onerror = reject;
    el.src = dataUrl;
  });
  const canvas = document.createElement("canvas");
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  const ctx = canvas.getContext("2d");
  if (!ctx) return dataUrl;
  ctx.filter = filter;
  ctx.drawImage(img, 0, 0);
  return canvas.toDataURL("image/png");
}
