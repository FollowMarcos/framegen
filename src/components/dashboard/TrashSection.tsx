"use client";

import { useEffect, useState } from "react";
import { Loader2, RefreshCw, RotateCcw, Trash2, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { StoredAsset } from "@/lib/storage";

// Type echoes the server-side TrashedAsset shape — kept inline here so the
// client doesn't pull in the storage module just for a type.
type TrashedAsset = StoredAsset & { deletedAt: string };

const TTL_DAYS = 30;

export function TrashSection() {
  const [items, setItems] = useState<TrashedAsset[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  async function load() {
    setError(null);
    try {
      const res = await fetch("/api/trash", { cache: "no-store" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "failed to load trash");
      setItems(Array.isArray(json.items) ? json.items : []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "failed to load trash");
      setItems([]);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function handleRestore(id: string) {
    if (busyId) return;
    setBusyId(id);
    try {
      const res = await fetch(`/api/trash?id=${encodeURIComponent(id)}&action=restore`, {
        method: "POST",
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || "restore failed");
      }
      setItems((prev) => prev?.filter((x) => x.id !== id) ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "restore failed");
    } finally {
      setBusyId(null);
    }
  }

  async function handlePurge(id: string, prompt: string) {
    if (busyId) return;
    const label = prompt.length > 60 ? prompt.slice(0, 60) + "…" : prompt;
    if (
      !confirm(
        `Delete "${label}" forever? This skips the 30-day recovery window and cannot be undone.`
      )
    ) {
      return;
    }
    setBusyId(id);
    try {
      const res = await fetch(`/api/trash?id=${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || "delete failed");
      }
      setItems((prev) => prev?.filter((x) => x.id !== id) ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "delete failed");
    } finally {
      setBusyId(null);
    }
  }

  async function handleEmpty() {
    if (!items || items.length === 0) return;
    if (
      !confirm(
        `Permanently delete all ${items.length} item${items.length === 1 ? "" : "s"} in trash? This cannot be undone.`
      )
    ) {
      return;
    }
    try {
      const res = await fetch("/api/trash", { method: "DELETE" });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || "empty trash failed");
      }
      setItems([]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "empty trash failed");
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
          <h1 className="text-[15px] font-semibold tracking-tight">Trash</h1>
          <p className="text-[11px] text-[var(--color-muted)] mt-0.5">
            Deleted assets sit here for {TTL_DAYS} days before being purged
            automatically. Restore brings them back into the library; delete-
            forever skips the timer.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {items && items.length > 0 && (
            <button
              type="button"
              onClick={handleEmpty}
              className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md bg-[var(--color-surface)] hover:bg-[var(--color-danger)]/10 hover:text-[var(--color-danger)] hover:border-[var(--color-danger)]/40 border border-[var(--color-border)] text-[12px] font-medium text-[var(--color-fg-dim)] transition"
              title="permanently delete everything in trash"
            >
              <Trash2 className="size-3.5" />
              empty trash
            </button>
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

      {error && (
        <div className="rounded-md border border-[var(--color-danger)]/30 bg-[var(--color-danger)]/5 px-3 py-2 text-[12px] text-[var(--color-danger)]">
          {error}
        </div>
      )}

      {items === null ? (
        <div className="grid place-items-center h-40 text-[12px] text-[var(--color-muted)]">
          <Loader2 className="size-4 animate-spin" />
        </div>
      ) : items.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(180px,1fr))] gap-3">
          {items.map((item) => (
            <TrashTile
              key={item.id}
              item={item}
              busy={busyId === item.id}
              onRestore={() => handleRestore(item.id)}
              onPurge={() => handlePurge(item.id, item.prompt)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function TrashTile({
  item,
  busy,
  onRestore,
  onPurge,
}: {
  item: TrashedAsset;
  busy: boolean;
  onRestore: () => void;
  onPurge: () => void;
}) {
  const daysLeft = computeDaysLeft(item.deletedAt);
  const expiringSoon = daysLeft !== null && daysLeft <= 3;

  return (
    <div
      className={cn(
        "group rounded-lg border bg-[var(--color-surface)] overflow-hidden transition",
        expiringSoon
          ? "border-[var(--color-danger)]/40 hover:border-[var(--color-danger)]/60"
          : "border-[var(--color-border)] hover:border-[var(--color-border-strong)]"
      )}
    >
      <div className="relative aspect-square bg-black">
        { }
        <img
          src={item.url}
          alt={item.prompt}
          className="w-full h-full object-cover opacity-70 group-hover:opacity-100 transition"
        />
        {expiringSoon && (
          <div className="absolute top-2 left-2 inline-flex items-center gap-1 px-1.5 h-5 rounded bg-[var(--color-danger)] text-white text-[10px] font-semibold tracking-tight">
            <AlertTriangle className="size-2.5" strokeWidth={3} />
            {daysLeft === 0 ? "purging today" : `${daysLeft}d left`}
          </div>
        )}
      </div>
      <div className="px-2.5 py-2 space-y-2">
        <p
          className="text-[11.5px] text-[var(--color-fg-dim)] line-clamp-2 leading-snug break-words"
          title={item.prompt}
        >
          {item.prompt}
        </p>
        <div className="text-[10px] font-mono text-[var(--color-muted)] tabular-nums">
          deleted {relativeTime(item.deletedAt)}
          {daysLeft !== null && !expiringSoon && (
            <span className="text-[var(--color-muted-dim)]"> · {daysLeft}d left</span>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={onRestore}
            disabled={busy}
            className="flex-1 inline-flex items-center justify-center gap-1 h-7 rounded-md bg-[var(--color-fg)] text-[var(--color-bg)] text-[11px] font-semibold hover:opacity-85 transition-opacity disabled:opacity-50"
            title="restore to library"
          >
            {busy ? <Loader2 className="size-3 animate-spin" /> : <RotateCcw className="size-3" />}
            restore
          </button>
          <button
            type="button"
            onClick={onPurge}
            disabled={busy}
            className="size-7 grid place-items-center rounded-md text-[var(--color-muted)] hover:text-[var(--color-danger)] hover:bg-[var(--color-surface-hover)] border border-[var(--color-border)] transition disabled:opacity-50"
            aria-label="delete forever"
            title="delete forever"
          >
            <Trash2 className="size-3" />
          </button>
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
          <Trash2 className="size-5 text-[var(--color-muted)]" />
        </div>
        <p className="text-[14px] font-medium text-[var(--color-fg-dim)]">
          Trash is empty
        </p>
        <p className="text-[12px] text-[var(--color-muted)] mt-1.5 max-w-[360px] mx-auto leading-snug">
          Deleted assets land here for {TTL_DAYS} days so you can recover them
          if you change your mind. Everything purges automatically after that.
        </p>
      </div>
    </div>
  );
}

function computeDaysLeft(deletedAt: string): number | null {
  const t = new Date(deletedAt).getTime();
  if (!Number.isFinite(t)) return null;
  const purgeAt = t + TTL_DAYS * 24 * 60 * 60 * 1000;
  const ms = purgeAt - Date.now();
  return Math.max(0, Math.ceil(ms / (24 * 60 * 60 * 1000)));
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
