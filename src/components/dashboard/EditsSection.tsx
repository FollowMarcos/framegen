"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2, Plus, RefreshCw, Trash2 } from "lucide-react";
import type { EditorDocSummary } from "@/lib/editor/types";

// Dashboard listing for editor documents. Shows a thumbnail grid, a "New
// blank canvas" CTA, and lets the user delete saved edits. The thumbnail
// shown here is the same flattened PNG the editor auto-uploads on every
// save, so it stays current without us having to invalidate anything.
export function EditsSection() {
  const router = useRouter();
  const [docs, setDocs] = useState<EditorDocSummary[] | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await fetch("/api/editor", { cache: "no-store" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "failed to load");
      setDocs(Array.isArray(json.docs) ? json.docs : []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "failed to load");
      setDocs([]);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function handleRefresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  async function handleDelete(id: string, name: string) {
    if (deleting) return;
    if (!confirm(`Delete "${name}"? This can't be undone.`)) return;
    setDeleting(id);
    try {
      const res = await fetch(`/api/editor/${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("delete failed");
      setDocs((prev) => prev?.filter((d) => d.id !== id) ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "delete failed");
    } finally {
      setDeleting(null);
    }
  }

  return (
    <div className="space-y-5">
      <header className="flex items-baseline justify-between gap-4">
        <div>
          <h1 className="text-[15px] font-semibold tracking-tight">Edits</h1>
          <p className="text-[11px] text-[var(--color-muted)] mt-0.5">
            Editor documents — adjust images and add text/image overlays on
            top. Files live at{" "}
            <code className="font-mono">public/editor/</code>.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => router.push("/editor")}
            className="h-8 px-3 rounded-md bg-[var(--color-accent)] text-[var(--color-fg-on-accent)] text-[12px] font-semibold inline-flex items-center gap-1.5 hover:bg-[var(--color-accent-hover)] transition"
          >
            <Plus className="size-3.5" />
            New canvas
          </button>
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

      {error && (
        <div className="rounded-md border border-[var(--color-danger)]/30 bg-[var(--color-danger)]/5 px-3 py-2 text-[12px] text-[var(--color-danger)]">
          {error}
        </div>
      )}

      {docs === null ? (
        <div className="grid place-items-center h-40 text-[12px] text-[var(--color-muted)]">
          <Loader2 className="size-4 animate-spin" />
        </div>
      ) : docs.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-3">
          {docs.map((d) => (
            <DocTile
              key={d.id}
              doc={d}
              deleting={deleting === d.id}
              onDelete={() => handleDelete(d.id, d.name)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function DocTile({
  doc,
  deleting,
  onDelete,
}: {
  doc: EditorDocSummary;
  deleting: boolean;
  onDelete: () => void;
}) {
  return (
    <div className="group rounded-lg border border-[var(--color-border)] hover:border-[var(--color-border-strong)] bg-[var(--color-surface)] overflow-hidden transition relative">
      <Link
        href={`/editor/${encodeURIComponent(doc.id)}`}
        className="block relative aspect-square bg-black"
      >
        {doc.thumbUrl ? (
          // Plain <img> so a missing thumb (404) doesn't crash the
          // route, and we don't pay the Next/Image optimization toll
          // for tiny preview tiles.
          <img
            src={doc.thumbUrl}
            alt={doc.name}
            className="w-full h-full object-contain"
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).style.opacity = "0";
            }}
          />
        ) : null}
      </Link>
      <button
        type="button"
        onClick={onDelete}
        disabled={deleting}
        className="absolute top-2 right-2 size-7 rounded-md bg-black/65 backdrop-blur text-white/85 hover:text-[var(--color-danger)] grid place-items-center opacity-0 group-hover:opacity-100 transition disabled:opacity-100 disabled:cursor-wait"
        aria-label={`delete ${doc.name}`}
        title="delete edit"
      >
        {deleting ? (
          <Loader2 className="size-3.5 animate-spin" />
        ) : (
          <Trash2 className="size-3.5" />
        )}
      </button>
      <Link
        href={`/editor/${encodeURIComponent(doc.id)}`}
        className="block px-2.5 py-2"
      >
        <div
          className="text-[11.5px] font-medium text-[var(--color-fg)] truncate"
          title={doc.name}
        >
          {doc.name || "untitled"}
        </div>
        <div className="text-[10px] font-mono text-[var(--color-muted)] tabular-nums mt-0.5 flex items-center gap-1.5 flex-wrap">
          <span>
            {doc.width}×{doc.height}
          </span>
          <span className="text-[var(--color-muted-dim)]">·</span>
          <span title={new Date(doc.updatedAt).toLocaleString()}>
            {relativeTime(doc.updatedAt)}
          </span>
        </div>
      </Link>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="rounded-lg border border-dashed border-[var(--color-border)] bg-[var(--color-surface)] py-16 grid place-items-center text-center">
      <div>
        <p className="text-[14px] font-medium text-[var(--color-fg-dim)]">
          No edits yet
        </p>
        <p className="text-[12px] text-[var(--color-muted)] mt-1.5 max-w-[360px] mx-auto leading-snug">
          Start a new blank canvas, or open any generation/upload in the
          editor with the pencil button.
        </p>
        <Link
          href="/editor"
          className="mt-4 inline-flex items-center gap-1.5 h-8 px-3 rounded-md bg-[var(--color-accent)] text-[var(--color-fg-on-accent)] text-[12px] font-semibold hover:bg-[var(--color-accent-hover)] transition"
        >
          <Plus className="size-3.5" />
          New canvas
        </Link>
      </div>
    </div>
  );
}

function relativeTime(ts: number): string {
  const diffSec = Math.max(0, (Date.now() - ts) / 1000);
  if (diffSec < 60) return "just now";
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
  const days = Math.floor(diffSec / 86400);
  if (days < 30) return `${days}d ago`;
  return new Date(ts).toLocaleDateString();
}
