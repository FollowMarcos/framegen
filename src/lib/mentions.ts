// Replaces @image1 / @img1 / @ref1 (case-insensitive) in the prompt with
// natural-language references the model will understand. Out-of-range
// mentions are left as-is so the user sees the typo in the surfaced
// "parameters" view if needed.

const ORDINALS = ["first", "second", "third", "fourth", "fifth", "sixth"];

export const MENTION_REGEX = /@(img|image|ref)(\d+)/gi;

export function ordinal(n: number): string {
  return ORDINALS[n - 1] ?? `${n}th`;
}

export function expandMentions(text: string, refCount: number): string {
  return text.replace(MENTION_REGEX, (full, _label, numStr) => {
    const n = parseInt(numStr, 10);
    if (n >= 1 && n <= refCount) {
      return `the ${ordinal(n)} reference image`;
    }
    return full;
  });
}

// Returns the currently-being-typed @mention prefix at the caret, or null
// if the caret isn't inside one. e.g. text "hi @im|" with caret at | → "im".
export function mentionAtCaret(
  text: string,
  caret: number
): { startIndex: number; query: string } | null {
  if (caret <= 0) return null;
  const before = text.slice(0, caret);
  const atIdx = before.lastIndexOf("@");
  if (atIdx === -1) return null;

  // Must be at the very start of the prompt OR preceded by whitespace.
  if (atIdx > 0 && !/\s/.test(text[atIdx - 1])) return null;

  // Everything between @ and caret must be word chars (no whitespace).
  const segment = before.slice(atIdx + 1);
  if (/\s/.test(segment)) return null;

  return { startIndex: atIdx, query: segment };
}
