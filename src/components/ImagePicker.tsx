"use client";

import { useRef, useState } from "react";
import { Crop, FolderOpen, ImagePlus, Loader2, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { DRAG_ASSET_MIME } from "@/app/page";
import { CropModal } from "@/components/CropModal";
import { UploadsLibraryModal } from "@/components/UploadsLibraryModal";
import { useFeatureFlag } from "@/lib/settings";

export type PickedImage = { url: string; preview: string; name: string };

export function ImagePicker({
  value,
  onChange,
  max = 1,
  label,
  description,
  compact,
  onDropAsset,
  emptyVariant = "verbose",
}: {
  value: PickedImage[];
  onChange: (v: PickedImage[]) => void;
  max?: number;
  label?: string;
  description?: string;
  compact?: boolean;
  onDropAsset?: (assetId: string) => void;
  // Controls how the empty state renders:
  //   "verbose" — full dropzone + "browse previous uploads" button below.
  //               Use when the picker has plenty of horizontal real estate.
  //   "icon"    — a single 40×40 button that opens the OS file dialog.
  //               Use in tight surfaces (e.g. the floating studio dock).
  emptyVariant?: "verbose" | "icon";
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  // Controls visibility of the "browse previously uploaded" modal. Kept
  // local because no parent ever needs to drive it.
  const [browseOpen, setBrowseOpen] = useState(false);
  // Index of the thumb currently open in the crop modal; null when closed.
  const [cropIndex, setCropIndex] = useState<number | null>(null);
  const croppingEnabled = useFeatureFlag("referenceCropping");

  async function handleFiles(files: FileList | File[] | null) {
    if (!files || (files as FileList).length === 0) return;
    setError(null);
    setUploading(true);
    try {
      const next: PickedImage[] = [...value];
      for (const file of Array.from(files as FileList)) {
        if (next.length >= max) break;
        const form = new FormData();
        form.append("file", file);
        const res = await fetch("/api/upload", { method: "POST", body: form });
        if (!res.ok) {
          const j = await res.json().catch(() => ({}));
          throw new Error(j.error || `upload failed (${res.status})`);
        }
        const { url } = (await res.json()) as { url: string };
        next.push({
          url,
          preview: URL.createObjectURL(file),
          name: file.name,
        });
      }
      onChange(next);
    } catch (e) {
      setError(e instanceof Error ? e.message : "upload failed");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  function remove(i: number) {
    const next = value.slice();
    next.splice(i, 1);
    onChange(next);
  }

  const showLabel = Boolean(label);
  const slotsLeft = max - value.length;
  const empty = value.length === 0;

  return (
    <div>
      {showLabel && (
        <div className="flex items-baseline justify-between mb-1.5">
          <span className="text-[11px] font-medium text-[var(--color-fg-dim)]">{label}</span>
          {description && (
            <span className="text-[10px] text-[var(--color-muted-dim)]">{description}</span>
          )}
        </div>
      )}

      {empty && emptyVariant === "icon" ? (
        // Vertical 40-wide stack of two buttons — fits the dock's empty
        // refs slot in a single 40px column (matches textarea height when
        // stacked). The first opens the OS file dialog (also accepts
        // drag-and-drop); the second opens the persisted uploads picker.
        <div className="flex flex-col gap-1.5">
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(false);
              const assetId = e.dataTransfer.getData(DRAG_ASSET_MIME);
              if (assetId && onDropAsset) {
                onDropAsset(assetId);
                return;
              }
              handleFiles(e.dataTransfer.files);
            }}
            disabled={uploading}
            title={`upload reference${max > 1 ? ` (up to ${max})` : ""}`}
            aria-label="upload reference image"
            className={cn(
              "size-10 grid place-items-center rounded-lg border border-dashed transition-colors disabled:opacity-50",
              dragOver
                ? "border-[var(--color-accent)] bg-[var(--color-accent-dim)] text-[var(--color-fg)]"
                : "border-[var(--color-border)] hover:border-[var(--color-border-strong)] bg-[var(--color-surface)] text-[var(--color-muted)] hover:text-[var(--color-fg)]"
            )}
          >
            {uploading ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <ImagePlus className="size-4" />
            )}
          </button>
          <button
            type="button"
            onClick={() => setBrowseOpen(true)}
            disabled={uploading}
            title="browse previous uploads"
            aria-label="browse previous uploads"
            className="size-10 grid place-items-center rounded-lg border border-[var(--color-border)] hover:border-[var(--color-border-strong)] bg-[var(--color-surface)] text-[var(--color-muted)] hover:text-[var(--color-fg)] transition-colors disabled:opacity-50"
          >
            <FolderOpen className="size-4" />
          </button>
        </div>
      ) : empty ? (
        <div className="space-y-1.5">
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(false);
              const assetId = e.dataTransfer.getData(DRAG_ASSET_MIME);
              if (assetId && onDropAsset) {
                onDropAsset(assetId);
                return;
              }
              handleFiles(e.dataTransfer.files);
            }}
            disabled={uploading}
            className={cn(
              "w-full rounded-lg border border-dashed flex flex-col items-center justify-center gap-1.5 transition-colors text-[var(--color-muted)] hover:text-[var(--color-fg)]",
              compact ? "py-4" : "py-7",
              dragOver
                ? "border-[var(--color-accent)] bg-[var(--color-accent-dim)]"
                : "border-[var(--color-border)] hover:border-[var(--color-border-strong)] bg-[var(--color-surface)]"
            )}
          >
            {uploading ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <ImagePlus className="size-4" />
            )}
            <span className="text-[11px] font-medium">
              {uploading ? "uploading…" : "click or drop image"}
            </span>
            {max > 1 && (
              <span className="text-[10px] text-[var(--color-muted-dim)]">up to {max}</span>
            )}
          </button>
          <button
            type="button"
            onClick={() => setBrowseOpen(true)}
            disabled={uploading}
            className="w-full inline-flex items-center justify-center gap-1.5 h-8 rounded-md bg-[var(--color-surface)] hover:bg-[var(--color-surface-hover)] border border-[var(--color-border)] hover:border-[var(--color-border-strong)] text-[11px] font-medium text-[var(--color-muted)] hover:text-[var(--color-fg-dim)] transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <FolderOpen className="size-3.5" />
            browse previous uploads
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-4 gap-1.5">
          {value.map((img, i) => (
            <div
              key={i}
              className="group relative aspect-square rounded-md overflow-hidden border border-[var(--color-border)] bg-black"
            >
              { }
              <img
                src={img.preview}
                alt={img.name}
                className="w-full h-full object-cover"
              />
              <div className="absolute top-1 right-1 flex items-center gap-1">
                {croppingEnabled && (
                  <button
                    type="button"
                    onClick={() => setCropIndex(i)}
                    className="size-5 rounded bg-black/70 hover:bg-[var(--color-accent)] hover:text-[var(--color-fg-on-accent)] grid place-items-center transition text-white opacity-0 group-hover:opacity-100"
                    aria-label="crop"
                    title="crop"
                  >
                    <Crop className="size-3" />
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => remove(i)}
                  className="size-5 rounded bg-black/70 hover:bg-[var(--color-danger)] grid place-items-center transition text-white"
                  aria-label="remove"
                >
                  <X className="size-3" />
                </button>
              </div>
            </div>
          ))}
          {slotsLeft > 0 && (
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              disabled={uploading}
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragOver(false);
                const assetId = e.dataTransfer.getData(DRAG_ASSET_MIME);
                if (assetId && onDropAsset) {
                  onDropAsset(assetId);
                  return;
                }
                handleFiles(e.dataTransfer.files);
              }}
              className={cn(
                "aspect-square rounded-md border border-dashed flex items-center justify-center transition-colors text-[var(--color-muted)] hover:text-[var(--color-fg)]",
                dragOver
                  ? "border-[var(--color-accent)] bg-[var(--color-accent-dim)]"
                  : "border-[var(--color-border)] hover:border-[var(--color-border-strong)] bg-[var(--color-surface)]"
              )}
            >
              {uploading ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <ImagePlus className="size-3.5" />
              )}
            </button>
          )}
        </div>
      )}

      {!empty && slotsLeft > 0 && (
        <button
          type="button"
          onClick={() => setBrowseOpen(true)}
          disabled={uploading}
          className="mt-1.5 w-full inline-flex items-center justify-center gap-1.5 h-7 rounded-md bg-[var(--color-surface)] hover:bg-[var(--color-surface-hover)] border border-[var(--color-border)] hover:border-[var(--color-border-strong)] text-[11px] font-medium text-[var(--color-muted)] hover:text-[var(--color-fg-dim)] transition disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <FolderOpen className="size-3" />
          browse previous uploads
        </button>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple={max > 1}
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
      />
      {error && <p className="mt-2 text-[11px] text-[var(--color-danger)]">{error}</p>}

      {browseOpen && (
        <UploadsLibraryModal
          onClose={() => setBrowseOpen(false)}
          onPick={(picks) => {
            // Respect the same slot budget the upload flow honors. The
            // modal already clamps selection to `slotsAvailable`, but we
            // re-clamp defensively in case the caller's `value` changed
            // while the modal was open (e.g. a drag-drop completed).
            const room = max - value.length;
            onChange([...value, ...picks.slice(0, room)]);
          }}
          slotsAvailable={slotsLeft}
        />
      )}

      {cropIndex !== null && value[cropIndex] && (
        <CropModal
          source={value[cropIndex]}
          onClose={() => setCropIndex(null)}
          onApply={(cropped) => {
            // Replace the cropped reference in place — keeps the position
            // in the references row, so prompt mentions like @image1 keep
            // pointing at the same slot.
            const next = value.slice();
            next[cropIndex] = cropped;
            onChange(next);
          }}
        />
      )}
    </div>
  );
}
