"use client";

// Tracks the user's recently-used prompts so the StudioPanel can offer
// autocomplete suggestions as they type. Stored per-browser in
// localStorage; capped so it doesn't grow unbounded over months of use.

const KEY = "frame.promptHistory.v1";
const MAX_ENTRIES = 100;
const MIN_LENGTH = 4;

export type PromptHistoryEntry = {
  prompt: string;
  lastUsedAt: string; // ISO
  uses: number;
};

function read(): PromptHistoryEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (e): e is PromptHistoryEntry =>
        Boolean(e) &&
        typeof e.prompt === "string" &&
        typeof e.lastUsedAt === "string" &&
        typeof e.uses === "number"
    );
  } catch {
    return [];
  }
}

function write(entries: PromptHistoryEntry[]) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(KEY, JSON.stringify(entries));
  } catch {
    // localStorage full or unavailable — ignore.
  }
}

export function listPromptHistory(): PromptHistoryEntry[] {
  return read();
}

// Records a new prompt usage, merging with an existing entry when one
// exists. Skips very short prompts (likely garbage) and trims whitespace.
// Newest entries float to the top via lastUsedAt sort at read time.
export function recordPromptUse(rawPrompt: string): void {
  const prompt = rawPrompt.trim();
  if (prompt.length < MIN_LENGTH) return;
  const entries = read();
  const now = new Date().toISOString();
  const existing = entries.findIndex((e) => e.prompt === prompt);
  if (existing >= 0) {
    entries[existing] = {
      ...entries[existing],
      lastUsedAt: now,
      uses: entries[existing].uses + 1,
    };
  } else {
    entries.push({ prompt, lastUsedAt: now, uses: 1 });
  }
  // Cap the list — drop the least-recently-used when oversized so the
  // dropdown stays useful instead of becoming a wall of stale text.
  entries.sort((a, b) => b.lastUsedAt.localeCompare(a.lastUsedAt));
  if (entries.length > MAX_ENTRIES) {
    entries.length = MAX_ENTRIES;
  }
  write(entries);
}

// Returns prompts whose start matches `query` (case-insensitive), excluding
// the query itself when it's already a perfect match. Limited to a small
// number so the popover doesn't dominate the screen.
export function suggestFromHistory(
  query: string,
  limit = 6
): PromptHistoryEntry[] {
  const q = query.trim().toLowerCase();
  if (q.length < 2) return [];
  const entries = read();
  const out: PromptHistoryEntry[] = [];
  for (const e of entries) {
    if (out.length >= limit) break;
    const p = e.prompt.toLowerCase();
    if (p === q) continue;
    if (!p.startsWith(q)) continue;
    out.push(e);
  }
  // Already sorted by lastUsedAt in read().
  return out;
}

export function clearPromptHistory(): void {
  write([]);
}
