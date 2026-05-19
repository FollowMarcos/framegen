"use client";

import { useEffect, useMemo, useState } from "react";
import { ImageOff, Loader2, Pencil, RefreshCw, Search, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { UploadedAsset } from "@/lib/storage";

// Dashboard view for the user's persisted upload library. Read-mostly:
//   - shows every previously-uploaded reference image,
//   - exposes search + sort,
//   - allows deletion (local copy + sidecar; fal CDN copy is left alone),
//   - surfaces total disk usage so heavy users notice when they should
//     prune.
//
// The "pick into studio" flow uses the same data via UploadsLibraryModal —
// this section is intentionally management-focused: no selection, no
// "add to references" affordance.

type SortKey = "newest" | "oldest" | "largest" | "smallest" | "name";

const SORTS: { id: SortKey; label: string }[] = [
  { id: "newest", label: "Newest" },
  { id: "oldest", label: "Oldest" },
  { id: "largest", label: "Largest" },
  { id: "smallest", label: "Smallest" },
  { id: "name", label: "Name" },
];

export function UploadsSection() {
  const [uploads, setUploads] = useState<UploadedAsset[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<SortKey>("newest");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  async function load() {
    setError(null);
    try {
      const res = await fetch("/api/uploads", { cache: "no-store" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "failed to load uploads");
      setUploads(Array.isArray(json.uploads) ? json.uploads : []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "failed to load uploads");
      setUploads([]);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(() => {
    if (!uploads) return [];
    const q = search.trim().toLowerCase();
    const matches = q
      ? uploads.filter((u) => u.originalName.toLowerCase().includes(q))
      : uploads;
    const sorted = [...matches];
    switch (sort) {
      case "newest":
        sorted.sort((a, b) => b.uploadedAt.localeCompare(a.uploadedAt));
        break;
      case "oldest":
        sorted.sort((a, b) => a.uploadedAt.localeCompare(b.uploadedAt));
        break;
      case "largest":
        sorted.sort((a, b) => b.size - a.size);
        break;
      case "smallest":
        sorted.sort((a, b) => a.size - b.size);
        break;
      case "name":
        sorted.sort((a, b) =>
          a.originalName.localeCompare(b.originalName, undefined, {
            sensitivity: "base",
          })
        );
        break;
    }
    return sorted;
  }, [uploads, search, sort]);

  const totalBytes = (uploads ?? []).reduce((acc, u) => acc + u.size, 0);

  async function handleDelete(id: string, name: string) {
    if (deletingId) return;
    if (!confirm(`Delete "${name}"? The fal CDN copy is unaffected.`)) return;
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
    } catch (e) {
      setError(e instanceof Error ? e.message : "delete failed");
    } finally {
      setDeletingId(null);
    }
  }

  async function handleRefresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  return (
    <div className="space-y-5">
      <header className="flex items-baseline justify-between gap-4">
        <div>
          <h1 className="text-[15px] font-semibold tracking-tight">Uploads</h1>
          <p className="text-[11px] text-[var(--color-muted)] mt-0.5">
            Reference images you&apos;ve uploaded — re-pickable from the studio
            panel without re-uploading. Local copies live at{" "}
            <code className="font-mono">public/generations/uploads/</code>.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {uploads && uploads.length > 0 && (
            <span className="text-[11px] font-mono tabular-nums text-[var(--color-muted)]">
              {uploads.length} file{uploads.length === 1 ? "" : "s"} ·{" "}
              {formatBytes(totalBytes)}
            </span>
          )}
          <button
            type="button"
            onClick={handleRefresh}
            disabled={refreshing}
            className="size-8 rounded-md grid place-items-center text-[var(--color-muted)] hover:text-[var(--color-fg)] hover:bg-[var(--color-surface)] border border-[var(--color-border)] transition disabled:opacity-50"
            aria-label="refresh"
            title="refresh"
          >
            {refreshing ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <RefreshCw className="size-3.5" />
            )}
          </button>
        </div>
      </header>

      {uploads === null ? (
        <div className="grid place-items-center h-40 text-[12px] text-[var(--color-muted)]">
          <Loader2 className="size-4 animate-spin" />
        </div>
      ) : uploads.length === 0 ? (
        <EmptyState />
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative flex-1 min-w-[200px] max-w-[400px]">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-[var(--color-muted)] pointer-events-none" />
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="search by filename…"
                className="w-full h-8 pl-8 pr-3 rounded-md bg-[var(--color-surface)] border border-[var(--color-border)] text-[12px] outline-none hover:border-[var(--color-border-strong)] focus:border-[var(--color-accent)] transition-colors"
              />
            </div>
            <div className="inline-flex items-center gap-0.5 p-0.5 rounded-md bg-[var(--color-surface)] border border-[var(--color-border)]">
              {SORTS.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setSort(s.id)}
                  className={cn(
                    "h-7 px-2.5 rounded text-[11px] font-medium transition-colors",
                    sort === s.id
                      ? "bg-[var(--color-bg-elevated)] text-[var(--color-fg)] shadow-sm"
                      : "text-[var(--color-muted)] hover:text-[var(--color-fg-dim)]"
                  )}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          {error && (
            <div className="rounded-md border border-[var(--color-danger)]/30 bg-[var(--color-danger)]/5 px-3 py-2 text-[12px] text-[var(--color-danger)]">
              {error}
            </div>
          )}

          {filtered.length === 0 ? (
            <div className="grid place-items-center h-40 text-[12px] text-[var(--color-muted)]">
              no uploads match &ldquo;{search}&rdquo;
            </div>
          ) : (
            <div className="grid grid-cols-[repeat(auto-fill,minmax(160px,1fr))] gap-3">
              {filtered.map((u) => (
                <UploadTile
                  key={u.id}
                  upload={u}
                  deleting={deletingId === u.id}
                  onDelete={() => handleDelete(u.id, u.originalName)}
                />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function UploadTile({
  upload,
  deleting,
  onDelete,
}: {
  upload: UploadedAsset;
  deleting: boolean;
  onDelete: () => void;
}) {
  const dims = upload.width && upload.height ? `${upload.width}×${upload.height}` : null;
  return (
    <div className="group rounded-lg border border-[var(--color-border)] hover:border-[var(--color-border-strong)] bg-[var(--color-surface)] overflow-hidden transition">
      <div className="relative aspect-square bg-black">
        { }
        <img
          src={upload.localUrl}
          alt={upload.originalName}
          className="w-full h-full object-cover"
        />
        <div className="absolute top-2 right-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition">
          <a
            href={`/editor?from=${encodeURIComponent(upload.localUrl)}`}
            className="size-7 rounded-md bg-black/65 backdrop-blur text-white/85 hover:text-[var(--color-accent)] grid place-items-center transition"
            aria-label={`edit ${upload.originalName}`}
            title="open in editor"
          >
            <Pencil className="size-3.5" />
          </a>
          <button
            type="button"
            onClick={onDelete}
            disabled={deleting}
            className="size-7 rounded-md bg-black/65 backdrop-blur text-white/85 hover:text-[var(--color-danger)] grid place-items-center transition disabled:opacity-100 disabled:cursor-wait"
            aria-label={`delete ${upload.originalName}`}
            title="delete upload"
          >
            {deleting ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Trash2 className="size-3.5" />
            )}
          </button>
        </div>
      </div>
      <div className="px-2.5 py-2">
        <div className="text-[11.5px] font-medium text-[var(--color-fg)] truncate" title={upload.originalName}>
          {upload.originalName}
        </div>
        <div className="text-[10px] font-mono text-[var(--color-muted)] tabular-nums mt-0.5 flex items-center gap-1.5 flex-wrap">
          {dims && <span>{dims}</span>}
          {dims && <span className="text-[var(--color-muted-dim)]">·</span>}
          <span>{formatBytes(upload.size)}</span>
          <span className="text-[var(--color-muted-dim)]">·</span>
          <span title={new Date(upload.uploadedAt).toLocaleString()}>
            {relativeTime(upload.uploadedAt)}
          </span>
        </div>
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="rounded-lg border border-dashed border-[var(--color-border)] bg-[var(--color-surface)] py-16 grid place-items-center text-center">
      <div>
        <div className="size-12 mx-auto rounded-full bg-[var(--color-bg-elevated)] border border-[var(--color-border)] grid place-items-center mb-4">
          <ImageOff className="size-5 text-[var(--color-muted)]" />
        </div>
        <p className="text-[14px] font-medium text-[var(--color-fg-dim)]">
          No uploaded references yet
        </p>
        <p className="text-[12px] text-[var(--color-muted)] mt-1.5 max-w-[360px] mx-auto leading-snug">
          Drag or click to upload a reference image from the studio panel.
          The local copy will be persisted here so you can re-pick it
          without uploading again.
        </p>
      </div>
    </div>
  );
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function relativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  const diffSec = Math.max(0, (Date.now() - then) / 1000);
  if (diffSec < 60) return "just now";
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
  const days = Math.floor(diffSec / 86400);
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}
