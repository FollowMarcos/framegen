"use client";

import type { EditorDoc } from "./types";

// Per-doc localStorage key. We namespace under "frame.editor.draft" so
// the shell can list / clean up its own drafts without scanning
// unrelated keys, and so a future migration can bump the prefix
// without touching other app data.
const DRAFT_PREFIX = "frame.editor.draft.v1.";
const INDEX_KEY = "frame.editor.draft.index.v1";

// Max draft age before the index purge nukes it. 30 days mirrors how
// the trash works — long enough that a user who came back from
// vacation still finds their unsaved work, short enough that we don't
// fill localStorage with abandoned canvases forever.
const TTL_MS = 30 * 24 * 60 * 60 * 1000;

type IndexEntry = {
  id: string;
  updatedAt: number;
};

function readIndex(): IndexEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(INDEX_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as IndexEntry[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeIndex(entries: IndexEntry[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(INDEX_KEY, JSON.stringify(entries));
  } catch {
    // Quota or disabled storage — silently no-op. The server-side
    // autosave is the real persistence layer; localStorage is just a
    // crash-recovery cache.
  }
}

// Writes a doc snapshot to localStorage. Called on every mutation by
// the editor shell so a refresh / crash / lost connection can never
// destroy more than the last keystroke.
export function saveDraft(doc: EditorDoc): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      DRAFT_PREFIX + doc.id,
      JSON.stringify(doc)
    );
    const index = readIndex().filter((e) => e.id !== doc.id);
    index.push({ id: doc.id, updatedAt: doc.updatedAt });
    writeIndex(index);
  } catch {
    // Storage quota exceeded is the realistic failure mode here. We
    // tolerate it because the server save will still happen.
  }
}

export function loadDraft(id: string): EditorDoc | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(DRAFT_PREFIX + id);
    if (!raw) return null;
    return JSON.parse(raw) as EditorDoc;
  } catch {
    return null;
  }
}

export function deleteDraft(id: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(DRAFT_PREFIX + id);
    writeIndex(readIndex().filter((e) => e.id !== id));
  } catch {
    // ignore
  }
}

// Returns drafts ordered most-recent-first, purging anything older than
// TTL_MS in the process. The picker on `/editor` calls this on mount
// so abandoned canvases age out automatically.
export function listDrafts(): IndexEntry[] {
  if (typeof window === "undefined") return [];
  const cutoff = Date.now() - TTL_MS;
  const fresh: IndexEntry[] = [];
  for (const entry of readIndex()) {
    if (entry.updatedAt < cutoff) {
      try {
        window.localStorage.removeItem(DRAFT_PREFIX + entry.id);
      } catch {
        // ignore
      }
      continue;
    }
    fresh.push(entry);
  }
  if (fresh.length !== readIndex().length) writeIndex(fresh);
  fresh.sort((a, b) => b.updatedAt - a.updatedAt);
  return fresh;
}

// Returns the single most-recent unsaved draft, or null if none. Used
// by /editor (entry route) when the user lands without any explicit
// id, so we can ask "want to keep going on your last canvas?" instead
// of spawning a fresh untitled doc and silently losing the previous
// session's work.
export function mostRecentDraft(): EditorDoc | null {
  const entries = listDrafts();
  if (entries.length === 0) return null;
  return loadDraft(entries[0].id);
}
