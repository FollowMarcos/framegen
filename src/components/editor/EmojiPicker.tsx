"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Search, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { EMOJI_CATEGORIES, type EmojiCategory } from "@/lib/editor/emoji";

// TikTok/Instagram-style emoji picker. Floats anchored to the toolbar
// button rather than full-screen so the user can keep an eye on the
// canvas while picking. Clicking an emoji immediately adds it as a
// sticker overlay and the picker stays open — the same workflow as
// Instagram stories where you can stack several stickers in a row.
export function EmojiPicker({
  onPick,
  onClose,
  anchor = "bottom",
}: {
  onPick: (emoji: string) => void;
  onClose: () => void;
  // Which side of the trigger to render against. The toolbar button
  // lives at the top of the editor, so we open downward by default.
  anchor?: "top" | "bottom";
}) {
  const [active, setActive] = useState<EmojiCategory["id"]>("smileys");
  const [search, setSearch] = useState("");
  const ref = useRef<HTMLDivElement | null>(null);
  const searchRef = useRef<HTMLInputElement | null>(null);

  // Outside click closes; Escape closes; "/" focuses search (handy keyboard
  // shortcut once the picker is already open).
  useEffect(() => {
    function onDocDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose();
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      } else if (e.key === "/" && document.activeElement !== searchRef.current) {
        e.preventDefault();
        searchRef.current?.focus();
      }
    }
    document.addEventListener("mousedown", onDocDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  // When search is non-empty, the category tabs are bypassed and we show
  // a flat result list filtered across all categories. Naive substring
  // match on the category label — good enough for "heart", "fire",
  // "smile" etc. without bringing in a full emoji-search index.
  const visible: string[] = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (q) {
      const out = new Set<string>();
      for (const cat of EMOJI_CATEGORIES) {
        if (
          cat.label.toLowerCase().includes(q) ||
          cat.id.toLowerCase().includes(q)
        ) {
          cat.emojis.forEach((e) => out.add(e));
        }
      }
      return Array.from(out);
    }
    const cat = EMOJI_CATEGORIES.find((c) => c.id === active);
    return cat ? cat.emojis : [];
  }, [search, active]);

  return (
    <div
      ref={ref}
      role="dialog"
      aria-modal="false"
      aria-label="emoji picker"
      className={cn(
        "absolute z-30 w-[340px] rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-elevated)] shadow-2xl overflow-hidden",
        anchor === "bottom" ? "top-full mt-2" : "bottom-full mb-2"
      )}
      style={{ right: 0 }}
    >
      <header className="flex items-center gap-2 px-3 h-10 border-b border-[var(--color-border)]">
        <div className="relative flex-1">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 size-3.5 text-[var(--color-muted)] pointer-events-none" />
          <input
            ref={searchRef}
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search emoji…"
            className="w-full h-7 pl-7 pr-2 rounded-md bg-[var(--color-surface)] border border-[var(--color-border)] text-[12px] outline-none focus:border-[var(--color-accent)]"
          />
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="close emoji picker"
          className="size-7 grid place-items-center rounded text-[var(--color-muted)] hover:text-[var(--color-fg)] hover:bg-[var(--color-surface)] transition"
        >
          <X className="size-3.5" />
        </button>
      </header>

      {!search.trim() && (
        <div className="flex items-center gap-0.5 px-1.5 py-1 border-b border-[var(--color-border)] overflow-x-auto">
          {EMOJI_CATEGORIES.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => setActive(c.id)}
              title={c.label}
              aria-label={c.label}
              aria-pressed={active === c.id}
              className={cn(
                "size-8 grid place-items-center rounded text-[18px] shrink-0 transition-colors leading-none",
                active === c.id
                  ? "bg-[var(--color-accent-dim)]"
                  : "hover:bg-[var(--color-surface)]"
              )}
            >
              {c.icon}
            </button>
          ))}
        </div>
      )}

      <div className="max-h-[280px] overflow-y-auto p-2 grid grid-cols-8 gap-0.5">
        {visible.map((e, i) => (
          <button
            key={`${e}-${i}`}
            type="button"
            onClick={() => onPick(e)}
            className="size-9 grid place-items-center rounded hover:bg-[var(--color-surface)] text-[22px] leading-none transition-colors"
            // Keep focus on the trigger / search field after each click —
            // the picker stays open so the user can stack several
            // stickers without re-opening it.
            onMouseDown={(ev) => ev.preventDefault()}
          >
            {e}
          </button>
        ))}
        {visible.length === 0 && (
          <div className="col-span-8 text-center py-6 text-[11px] text-[var(--color-muted)]">
            No matches.
          </div>
        )}
      </div>
    </div>
  );
}
