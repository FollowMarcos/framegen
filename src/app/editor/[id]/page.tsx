"use client";

import { use, useEffect, useState } from "react";
import { AlertTriangle } from "lucide-react";
import { EditorMount } from "@/components/editor/EditorMount";
import type { EditorDoc } from "@/lib/editor/types";
import { deleteDraft, loadDraft } from "@/lib/editor/drafts";

// Loads a persisted editor document by id. The server is the source of
// truth for saved work; localStorage is a crash-recovery cache that
// runs alongside it. Three resolution paths:
//
// 1. Server hit + local draft is older or absent → use server doc
// 2. Server hit + local draft is *newer* → divergence, ask the user
// 3. Server miss → use the local draft (URL-upgrade + autosave gap)
//
// Path 2 is the one that used to silently lose work: if the user
// edited offline then later opened the doc on a connected device, the
// server doc would win. We now block on a user choice instead.
export default function EditorDocPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [doc, setDoc] = useState<EditorDoc | null>(null);
  const [conflict, setConflict] = useState<{
    server: EditorDoc;
    local: EditorDoc;
  } | null>(null);
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const res = await fetch(`/api/editor/${id}`, { cache: "no-store" });
      const local = loadDraft(id);

      if (res.ok) {
        const json = (await res.json()) as { doc: EditorDoc };
        const server = json.doc;
        // 5-second grace window — clock drift between client and
        // server commonly puts the local timestamp a few seconds
        // ahead even when they're effectively the same save.
        const driftMs = 5000;
        if (local && local.updatedAt > server.updatedAt + driftMs) {
          if (!cancelled) setConflict({ server, local });
          return;
        }
        if (!cancelled) setDoc(server);
        return;
      }

      // Server 404 — fall back to the local draft. Covers the
      // URL-upgrade flow on a brand-new canvas whose autosave
      // hasn't reached disk yet.
      if (local) {
        if (!cancelled) setDoc(local);
        return;
      }
      if (!cancelled) setMissing(true);
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [id]);

  if (missing) {
    return (
      <div className="h-screen w-screen grid place-items-center bg-[var(--color-bg)] text-[var(--color-muted)] text-[12px]">
        Editor document not found.
      </div>
    );
  }
  if (conflict) {
    return (
      <ConflictResolver
        server={conflict.server}
        local={conflict.local}
        onKeepLocal={() => {
          setDoc(conflict.local);
          setConflict(null);
        }}
        onKeepServer={() => {
          deleteDraft(id);
          setDoc(conflict.server);
          setConflict(null);
        }}
      />
    );
  }
  if (!doc) {
    return (
      <div className="h-screen w-screen grid place-items-center bg-[var(--color-bg)] text-[var(--color-muted)] text-[12px]">
        Loading…
      </div>
    );
  }
  return <EditorMount initial={doc} />;
}

// Full-screen block when the local draft is newer than the server
// copy. The user is the only one who can decide which version is
// canonical, so we surface both timestamps and let them pick.
function ConflictResolver({
  server,
  local,
  onKeepLocal,
  onKeepServer,
}: {
  server: EditorDoc;
  local: EditorDoc;
  onKeepLocal: () => void;
  onKeepServer: () => void;
}) {
  return (
    <div className="h-screen w-screen grid place-items-center bg-[var(--color-bg)] p-6">
      <div className="max-w-md w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-elevated)] shadow-2xl p-5">
        <div className="flex items-center gap-2 mb-3">
          <AlertTriangle className="size-4 text-[var(--color-accent)]" />
          <h2 className="text-[14px] font-semibold tracking-tight">
            Unsaved changes detected
          </h2>
        </div>
        <p className="text-[12px] text-[var(--color-fg-dim)] leading-relaxed mb-4">
          This document has more recent changes in your browser than on
          the server. Probably from editing offline, or from a tab that
          closed before autosave finished.
        </p>
        <div className="space-y-2 text-[11px] text-[var(--color-muted)] mb-5">
          <Row label="On the server" ts={server.updatedAt} />
          <Row label="In this browser" ts={local.updatedAt} accent />
        </div>
        <div className="flex flex-col gap-2">
          <button
            type="button"
            onClick={onKeepLocal}
            className="h-9 rounded-md bg-[var(--color-accent)] text-[var(--color-fg-on-accent)] text-[12px] font-semibold hover:bg-[var(--color-accent-hover)] transition"
          >
            Keep browser version
          </button>
          <button
            type="button"
            onClick={onKeepServer}
            className="h-9 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] hover:bg-[var(--color-surface-hover)] text-[12px] font-medium transition"
          >
            Discard browser changes &amp; use server
          </button>
        </div>
      </div>
    </div>
  );
}

function Row({
  label,
  ts,
  accent,
}: {
  label: string;
  ts: number;
  accent?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span>{label}</span>
      <span
        className={
          accent
            ? "text-[var(--color-accent)] font-mono tabular-nums"
            : "text-[var(--color-fg-dim)] font-mono tabular-nums"
        }
      >
        {new Date(ts).toLocaleString()}
      </span>
    </div>
  );
}
