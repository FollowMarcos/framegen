// Prompt snippets are stored in localStorage so they're per-browser and
// instantly available without any server roundtrip. Names are unique;
// re-saving the same name overwrites.

export type Snippet = {
  id: string;
  name: string;
  body: string;
  createdAt: string;
};

const KEY = "frame.snippets.v1";

function read(): Snippet[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Snippet[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function write(list: Snippet[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(KEY, JSON.stringify(list));
}

export function listSnippets(): Snippet[] {
  return read().sort((a, b) => a.name.localeCompare(b.name));
}

export function saveSnippet(name: string, body: string): Snippet {
  const trimmed = name.trim();
  if (!trimmed) throw new Error("name required");
  const list = read();
  const existing = list.find((s) => s.name.toLowerCase() === trimmed.toLowerCase());
  if (existing) {
    existing.body = body;
    write(list);
    return existing;
  }
  const snippet: Snippet = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name: trimmed,
    body,
    createdAt: new Date().toISOString(),
  };
  list.push(snippet);
  write(list);
  return snippet;
}

export function deleteSnippet(id: string) {
  write(read().filter((s) => s.id !== id));
}

// Slash trigger — analogous to mentionAtCaret. Returns the partial query
// after "/" when the caret is at the end of a slash-token, or null otherwise.
export function slashAtCaret(
  text: string,
  caret: number
): { startIndex: number; query: string } | null {
  if (caret <= 0) return null;
  const before = text.slice(0, caret);
  const slashIdx = before.lastIndexOf("/");
  if (slashIdx === -1) return null;
  if (slashIdx > 0 && !/\s/.test(text[slashIdx - 1])) return null;
  const segment = before.slice(slashIdx + 1);
  if (/\s/.test(segment)) return null;
  return { startIndex: slashIdx, query: segment };
}
