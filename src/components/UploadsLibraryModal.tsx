"use client";

import { useEffect, useState } from "react";
import { Check, ImageOff, Loader2, Search, Trash2, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/fields";
import type { PickedImage } from "@/components/ImagePicker";
import type { UploadedAsset } from "@/lib/storage";

// Modal for browsing previously-uploaded reference images. Used as the
// "have I uploaded this before?" companion to ImagePicker's drop-zone:
//   - shows every persisted upload (newest first),
//   - lets the user multi-select with a slot budget,
//   - converts the selection into PickedImage[] for the caller,
//   - optionally surfaces a delete affordance for cleanup.
//
// Reused by the dashboard's Uploads page with `pickable={false}` to render
// a management-only view (no slot budget, delete only).

export function UploadsLibraryModal({
  onClose,
  onPick,
  slotsAvailable,
  pickable = true,
}: {
  onClose: () => void;
  // When the user confirms a selection, the caller receives the converted
  // PickedImage[] (one per selected upload). Optional so the dashboard
  // variant can omit it entirely.
  onPick?: (picks: PickedImage[]) => void;
  // How many references the caller can still accept. Selection clamps to
  // this; ignored when pickable is false.
  slotsAvailable?: number;
  pickable?: boolean;
}) {
  const [uploads, setUploads] = useState<UploadedAsset[] | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Load uploads on mount + lock body scroll while the modal is open.
  useEffect(() => {
    let cancelled = false;
    fetch("/api/uploads", { cache: "no-store" })
      .then((r) => r.json())
      .then((json) => {
        if (cancelled) return;
        setUploads(Array.isArray(json.uploads) ? json.uploads : []);
      })
      .catch((e) => {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : "failed to load uploads");
        setUploads([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

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

  const filtered = (uploads ?? []).filter((u) =>
    search.trim().length === 0
      ? true
      : u.originalName.toLowerCase().includes(search.toLowerCase())
  );

  // Selection respects the caller's slot budget — picking a 5th when only 4
  // slots remain just silently no-ops on that thumbnail. Reflected visually
  // by greying out the thumb.
  function toggle(id: string) {
    if (!pickable) return;
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        if (slotsAvailable !== undefined && next.size >= slotsAvailable) {
          return prev;
        }
        next.add(id);
      }
      return next;
    });
  }

  function confirm() {
    if (!onPick) return;
    const picks: PickedImage[] = [];
    for (const id of selected) {
      const u = uploads?.find((x) => x.id === id);
      if (!u) continue;
      picks.push({
        url: u.remoteUrl,
        preview: u.localUrl,
        name: u.originalName,
      });
    }
    onPick(picks);
    onClose();
  }

  async function handleDelete(id: string) {
    if (deletingId) return;
    setDeletingId(id);
    try {
      const res = await fetch(`/api/uploads?id=${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || "delete failed");
      }
      setUploads((prev) => prev?.filter((u) => u.id !== id) ?? null);
      setSelected((prev) => {
        if (!prev.has(id)) return prev;
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "delete failed");
    } finally {
      setDeletingId(null);
    }
  }

  const slotsExhausted =
    slotsAvailable !== undefined && selected.size >= slotsAvailable;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="uploads library"
      onClick={onClose}
      className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-6 animate-in"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-[1080px] h-[min(720px,calc(100vh-3rem))] rounded-xl border border-[var(--color-border)] overflow-hidden flex flex-col"
        style={{ backgroundColor: "var(--color-bg-elevated)" }}
      >
        <header className="flex items-center justify-between h-11 px-4 border-b border-[var(--color-border)] shrink-0">
          <div className="flex items-baseline gap-2">
            <h2 className="text-[13px] font-semibold tracking-tight">
              {pickable ? "Pick from your uploads" : "Manage uploads"}
            </h2>
            {uploads && (
              <span className="text-[11px] font-mono tabular-nums text-[var(--color-muted)]">
                {filtered.length}
                {filtered.length !== uploads.length ? ` / ${uploads.length}` : ""}
              </span>
            )}
          </div>
          <button
            onClick={onClose}
            className="size-6 rounded-md grid place-items-center text-[var(--color-muted)] hover:text-[var(--color-fg)] hover:bg-[var(--color-surface)] transition"
            aria-label="close"
          >
            <X className="size-3.5" />
          </button>
        </header>

        <div className="px-4 py-3 border-b border-[var(--color-border)] shrink-0">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-[var(--color-muted)] pointer-events-none" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="search by filename…"
              className="w-full h-8 pl-8 pr-3 rounded-md bg-[var(--color-surface)] border border-[var(--color-border)] text-[12px] outline-none hover:border-[var(--color-border-strong)] focus:border-[var(--color-accent)] transition-colors"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 min-h-0">
          {uploads === null ? (
            <div className="grid place-items-center h-full text-[12px] text-[var(--color-muted)]">
              <Loader2 className="size-4 animate-spin" />
            </div>
          ) : uploads.length === 0 ? (
            <EmptyState />
          ) : filtered.length === 0 ? (
            <div className="grid place-items-center h-full text-[12px] text-[var(--color-muted)]">
              no uploads match &ldquo;{search}&rdquo;
            </div>
          ) : (
            <div className="grid grid-cols-[repeat(auto-fill,minmax(140px,1fr))] gap-3">
              {filtered.map((u) => {
                const isSelected = selected.has(u.id);
                const isDimmed = pickable && !isSelected && slotsExhausted;
                return (
                  <UploadThumb
                    key={u.id}
                    upload={u}
                    selected={isSelected}
                    dimmed={isDimmed}
                    pickable={pickable}
                    deleting={deletingId === u.id}
                    onToggle={() => toggle(u.id)}
                    onDelete={() => handleDelete(u.id)}
                  />
                );
              })}
            </div>
          )}
        </div>

        <footer className="border-t border-[var(--color-border)] p-3 flex items-center justify-between gap-3 shrink-0">
          <div className="text-[11px] text-[var(--color-muted)] min-w-0 break-words">
            {error ? (
              <span className="text-[var(--color-danger)]">{error}</span>
            ) : pickable ? (
              slotsAvailable === 0 ? (
                <>reference slots full — clear one to add more</>
              ) : (
                <>
                  {selected.size} selected
                  {slotsAvailable !== undefined && (
                    <span className="text-[var(--color-muted-dim)]">
                      {" "}
                      · {slotsAvailable - selected.size} slot
                      {slotsAvailable - selected.size === 1 ? "" : "s"} left
                    </span>
                  )}
                </>
              )
            ) : (
              <>local copies served from <code className="font-mono">public/generations/uploads/</code></>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="inline-flex items-center justify-center h-8 px-3 rounded-md bg-[var(--color-surface)] hover:bg-[var(--color-surface-hover)] border border-[var(--color-border)] text-[12px] font-medium transition"
            >
              {pickable ? "Cancel" : "Done"}
            </button>
            {pickable && (
              <Button
                onClick={confirm}
                disabled={selected.size === 0 || slotsAvailable === 0}
              >
                Add {selected.size > 0 ? selected.size : ""} reference
                {selected.size === 1 ? "" : "s"}
              </Button>
            )}
          </div>
        </footer>
      </div>
    </div>
  );
}

function UploadThumb({
  upload,
  selected,
  dimmed,
  pickable,
  deleting,
  onToggle,
  onDelete,
}: {
  upload: UploadedAsset;
  selected: boolean;
  dimmed: boolean;
  pickable: boolean;
  deleting: boolean;
  onToggle: () => void;
  onDelete: () => void;
}) {
  const sizeKb = upload.size / 1024;
  const sizeLabel =
    sizeKb < 1024 ? `${sizeKb.toFixed(0)} KB` : `${(sizeKb / 1024).toFixed(1)} MB`;
  const dimsLabel =
    upload.width && upload.height ? `${upload.width}×${upload.height}` : null;

  return (
    <div
      className={cn(
        "group relative aspect-square rounded-lg overflow-hidden border bg-black transition",
        selected
          ? "border-[var(--color-accent)] ring-2 ring-[var(--color-accent)]/40"
          : "border-[var(--color-border)] hover:border-[var(--color-border-strong)]",
        dimmed && "opacity-40 cursor-not-allowed"
      )}
    >
      <button
        type="button"
        onClick={pickable ? onToggle : undefined}
        disabled={dimmed || !pickable}
        className="absolute inset-0 cursor-pointer disabled:cursor-not-allowed"
        aria-pressed={selected}
        aria-label={`${selected ? "deselect" : "select"} ${upload.originalName}`}
      >
        { }
        <img
          src={upload.localUrl}
          alt={upload.originalName}
          className="w-full h-full object-cover"
        />
      </button>

      {selected && (
        <div className="absolute top-2 left-2 size-5 rounded-md bg-[var(--color-accent)] text-[var(--color-fg-on-accent)] grid place-items-center pointer-events-none">
          <Check className="size-3" strokeWidth={3} />
        </div>
      )}

      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onDelete();
        }}
        disabled={deleting}
        className="absolute top-2 right-2 size-6 rounded-md bg-black/65 backdrop-blur text-white/85 hover:text-[var(--color-danger)] grid place-items-center opacity-0 group-hover:opacity-100 transition disabled:opacity-100 disabled:cursor-wait"
        aria-label={`delete ${upload.originalName}`}
        title="delete upload"
      >
        {deleting ? (
          <Loader2 className="size-3 animate-spin" />
        ) : (
          <Trash2 className="size-3" />
        )}
      </button>

      <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 to-transparent px-2 py-1.5 opacity-0 group-hover:opacity-100 transition">
        <div className="text-[10.5px] text-white/95 font-medium truncate" title={upload.originalName}>
          {upload.originalName}
        </div>
        <div className="text-[9px] font-mono text-white/60 tabular-nums">
          {dimsLabel ? `${dimsLabel} · ` : ""}
          {sizeLabel}
        </div>
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="grid place-items-center h-full text-center">
      <div>
        <div className="size-10 mx-auto rounded-full bg-[var(--color-surface)] border border-[var(--color-border)] grid place-items-center mb-3">
          <ImageOff className="size-4 text-[var(--color-muted)]" />
        </div>
        <p className="text-[13px] font-medium text-[var(--color-fg-dim)]">
          no uploads yet
        </p>
        <p className="text-[11px] text-[var(--color-muted)] mt-1 max-w-[280px] mx-auto leading-snug">
          Upload a reference image from the studio panel and it&apos;ll show up
          here so you can pick it again later without re-uploading.
        </p>
      </div>
    </div>
  );
}
