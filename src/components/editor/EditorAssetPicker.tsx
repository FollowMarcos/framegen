"use client";

import { useEffect, useRef, useState } from "react";
import { ImageOff, ImagePlus, Loader2, Search, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { StoredAsset, UploadedAsset } from "@/lib/storage";

// Picked asset shape the editor consumes. We resolve natural dimensions
// up front so the caller can construct an ImageOverlay without waiting
// on a second image load. `name` flows through to the optional history
// label; not strictly required.
export type EditorPickedAsset = {
  url: string;
  naturalWidth: number;
  naturalHeight: number;
  name: string;
};

type Tab = "generations" | "uploads";

// Tabbed asset picker for the editor toolbar's "+image" button. Tabs:
//   Generations — anything the studio has generated locally
//   Uploads     — the persisted reference library
// A "Upload from device" CTA in the header re-uses the same /api/upload
// pipeline so anything dropped here also ends up in the Uploads tab.
//
// Single-select on purpose: the editor consumes one overlay per click.
// Selecting an asset closes the modal immediately, mirroring how Finder /
// asset pickers in other tools behave once the slot budget is one.
export function EditorAssetPicker({
  onClose,
  onPick,
}: {
  onClose: () => void;
  onPick: (asset: EditorPickedAsset) => void | Promise<void>;
}) {
  const [tab, setTab] = useState<Tab>("generations");
  const [generations, setGenerations] = useState<StoredAsset[] | null>(null);
  const [uploads, setUploads] = useState<UploadedAsset[] | null>(null);
  const [search, setSearch] = useState("");
  const [uploading, setUploading] = useState(false);
  const [busyPickId, setBusyPickId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Lock body scroll while open + listen for Escape.
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

  // Lazy-load each list the first time its tab is shown. Both fetches are
  // unauthed inside the proxy-gated app, so we just hit the endpoints
  // directly without a session token.
  useEffect(() => {
    let cancelled = false;
    if (tab === "generations" && generations === null) {
      fetch("/api/generations", { cache: "no-store" })
        .then((r) => r.json())
        .then((j) => {
          if (cancelled) return;
          setGenerations(Array.isArray(j.assets) ? j.assets : []);
        })
        .catch((e) => {
          if (cancelled) return;
          setError(e instanceof Error ? e.message : "failed to load generations");
          setGenerations([]);
        });
    } else if (tab === "uploads" && uploads === null) {
      fetch("/api/uploads", { cache: "no-store" })
        .then((r) => r.json())
        .then((j) => {
          if (cancelled) return;
          setUploads(Array.isArray(j.uploads) ? j.uploads : []);
        })
        .catch((e) => {
          if (cancelled) return;
          setError(e instanceof Error ? e.message : "failed to load uploads");
          setUploads([]);
        });
    }
    return () => {
      cancelled = true;
    };
  }, [tab, generations, uploads]);

  async function commitPick(
    id: string,
    url: string,
    name: string,
    width?: number,
    height?: number
  ) {
    setBusyPickId(id);
    try {
      let w = width;
      let h = height;
      if (!w || !h) {
        // Sidecars don't always record dimensions (older uploads, edge
        // cases). Probe the image so the editor never lands on a 0×0
        // overlay that's invisible until the user drags a handle.
        const img = await loadImage(url);
        w = img.naturalWidth;
        h = img.naturalHeight;
      }
      await onPick({ url, naturalWidth: w, naturalHeight: h, name });
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "failed to pick image");
      setBusyPickId(null);
    }
  }

  async function handleDeviceUpload(files: FileList | null) {
    if (!files || files.length === 0) return;
    const file = files[0];
    setUploading(true);
    setError(null);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: form });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || `upload failed (${res.status})`);
      }
      const { url } = (await res.json()) as { url: string };
      const img = await loadImage(url);
      // Bust the uploads cache so the new file shows up if the user
      // flips back to that tab later.
      setUploads(null);
      await onPick({
        url,
        naturalWidth: img.naturalWidth,
        naturalHeight: img.naturalHeight,
        name: file.name,
      });
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "upload failed");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  const items =
    tab === "generations"
      ? filterGenerations(generations, search)
      : filterUploads(uploads, search);
  const loading = tab === "generations" ? generations === null : uploads === null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="pick image"
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm grid place-items-center p-6"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-[min(900px,95vw)] h-[min(700px,90vh)] rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-elevated)] shadow-2xl flex flex-col overflow-hidden">
        <header className="flex items-center gap-3 h-12 px-4 border-b border-[var(--color-border)] shrink-0">
          <h2 className="text-[13px] font-semibold tracking-tight">
            Pick an image
          </h2>

          <div className="inline-flex items-center gap-0.5 p-0.5 rounded-md bg-[var(--color-surface)] border border-[var(--color-border)] ml-1">
            <TabButton active={tab === "generations"} onClick={() => setTab("generations")}>
              Generations
            </TabButton>
            <TabButton active={tab === "uploads"} onClick={() => setTab("uploads")}>
              Uploads
            </TabButton>
          </div>

          <div className="relative flex-1 max-w-[280px]">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-[var(--color-muted)] pointer-events-none" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={tab === "generations" ? "Search prompts…" : "Search filenames…"}
              className="w-full h-8 pl-8 pr-3 rounded-md bg-[var(--color-surface)] border border-[var(--color-border)] text-[12px] outline-none hover:border-[var(--color-border-strong)] focus:border-[var(--color-accent)] transition-colors"
            />
          </div>

          <div className="ml-auto flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="h-8 px-3 rounded-md bg-[var(--color-surface)] border border-[var(--color-border)] hover:border-[var(--color-border-strong)] text-[11.5px] font-medium inline-flex items-center gap-1.5 transition disabled:opacity-50"
            >
              {uploading ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <ImagePlus className="size-3.5" />
              )}
              Upload from device
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => handleDeviceUpload(e.target.files)}
            />
            <button
              type="button"
              onClick={onClose}
              className="size-8 grid place-items-center rounded-md text-[var(--color-muted)] hover:text-[var(--color-fg)] hover:bg-[var(--color-surface)] transition"
              aria-label="close"
            >
              <X className="size-4" />
            </button>
          </div>
        </header>

        {error && (
          <div className="px-4 py-2 text-[11.5px] text-[var(--color-danger)] bg-[var(--color-danger)]/5 border-b border-[var(--color-danger)]/20">
            {error}
          </div>
        )}

        <div className="flex-1 overflow-y-auto p-4">
          {loading ? (
            <div className="h-full grid place-items-center text-[var(--color-muted)]">
              <Loader2 className="size-5 animate-spin" />
            </div>
          ) : items.length === 0 ? (
            <EmptyTab tab={tab} hasFilter={!!search.trim()} />
          ) : (
            <div className="grid grid-cols-[repeat(auto-fill,minmax(140px,1fr))] gap-3">
              {items.map((item) => (
                <PickerTile
                  key={item.id}
                  item={item}
                  busy={busyPickId === item.id}
                  onPick={() =>
                    commitPick(
                      item.id,
                      item.url,
                      item.label,
                      item.width,
                      item.height
                    )
                  }
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "h-7 px-3 rounded text-[11.5px] font-medium transition-colors",
        active
          ? "bg-[var(--color-bg-elevated)] text-[var(--color-fg)] shadow-sm"
          : "text-[var(--color-muted)] hover:text-[var(--color-fg-dim)]"
      )}
    >
      {children}
    </button>
  );
}

// Normalized shape for the grid so we can render generations + uploads
// from the same component without two parallel branches everywhere.
type PickerItem = {
  id: string;
  url: string;
  label: string;
  subtitle: string;
  width?: number;
  height?: number;
};

function filterGenerations(
  list: StoredAsset[] | null,
  search: string
): PickerItem[] {
  if (!list) return [];
  const q = search.trim().toLowerCase();
  const filtered = q
    ? list.filter((a) => a.prompt.toLowerCase().includes(q))
    : list;
  return filtered.map((a) => ({
    id: a.id,
    url: a.url,
    label: a.prompt || "untitled",
    subtitle:
      a.width && a.height
        ? `${a.width}×${a.height}`
        : new Date(a.createdAt).toLocaleDateString(),
    width: a.width,
    height: a.height,
  }));
}

function filterUploads(
  list: UploadedAsset[] | null,
  search: string
): PickerItem[] {
  if (!list) return [];
  const q = search.trim().toLowerCase();
  const filtered = q
    ? list.filter((u) => u.originalName.toLowerCase().includes(q))
    : list;
  return filtered.map((u) => ({
    id: u.id,
    url: u.localUrl,
    label: u.originalName,
    subtitle:
      u.width && u.height
        ? `${u.width}×${u.height}`
        : new Date(u.uploadedAt).toLocaleDateString(),
    width: u.width,
    height: u.height,
  }));
}

function PickerTile({
  item,
  busy,
  onPick,
}: {
  item: PickerItem;
  busy: boolean;
  onPick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onPick}
      disabled={busy}
      className="group rounded-lg border border-[var(--color-border)] hover:border-[var(--color-accent)] bg-[var(--color-surface)] overflow-hidden text-left transition focus:outline-none focus:border-[var(--color-accent)] disabled:opacity-60 disabled:cursor-wait"
    >
      <div className="relative aspect-square bg-black">
        <img
          src={item.url}
          alt={item.label}
          className="w-full h-full object-cover transition-transform group-hover:scale-[1.02]"
        />
        {busy && (
          <div className="absolute inset-0 grid place-items-center bg-black/40 backdrop-blur-sm">
            <Loader2 className="size-5 animate-spin text-white" />
          </div>
        )}
      </div>
      <div className="px-2 py-1.5">
        <div className="text-[11px] font-medium text-[var(--color-fg)] truncate" title={item.label}>
          {item.label}
        </div>
        <div className="text-[10px] font-mono text-[var(--color-muted)] tabular-nums truncate">
          {item.subtitle}
        </div>
      </div>
    </button>
  );
}

function EmptyTab({ tab, hasFilter }: { tab: Tab; hasFilter: boolean }) {
  if (hasFilter) {
    return (
      <div className="h-full grid place-items-center text-[12px] text-[var(--color-muted)]">
        No matches.
      </div>
    );
  }
  return (
    <div className="h-full grid place-items-center text-center">
      <div>
        <div className="size-12 mx-auto rounded-full bg-[var(--color-surface)] border border-[var(--color-border)] grid place-items-center mb-3">
          <ImageOff className="size-5 text-[var(--color-muted)]" />
        </div>
        <p className="text-[13px] font-medium text-[var(--color-fg-dim)]">
          {tab === "generations" ? "No generations yet" : "No uploads yet"}
        </p>
        <p className="text-[11px] text-[var(--color-muted)] mt-1 max-w-[280px] mx-auto leading-snug">
          {tab === "generations"
            ? "Generate an image in the studio to make it available here."
            : "Use Upload from device above to add a reference image."}
        </p>
      </div>
    </div>
  );
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const el = new window.Image();
    el.crossOrigin = "anonymous";
    el.onload = () => resolve(el);
    el.onerror = reject;
    el.src = url;
  });
}
