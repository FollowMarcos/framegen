"use client";

import { History } from "lucide-react";
import { cn } from "@/lib/utils";
import type { PromptHistoryEntry } from "@/lib/promptHistory";

// Autocomplete popover for the prompt textarea. Fires when the user has
// typed at least two characters AND there are prefix-matching entries in
// their localStorage history. Layout mirrors SnippetPopover so the muscle
// memory carries: ↑↓ select, ↵ insert, Esc dismiss.

export function PromptHistoryPopover({
  matches,
  selectedIndex,
  onSelect,
  onHover,
  placement = "below",
}: {
  matches: PromptHistoryEntry[];
  selectedIndex: number;
  onSelect: (entry: PromptHistoryEntry) => void;
  onHover: (index: number) => void;
  placement?: "below" | "above";
}) {
  if (matches.length === 0) return null;
  const positionClass =
    placement === "above" ? "bottom-full mb-1" : "top-full mt-1";

  return (
    <div
      role="listbox"
      className={cn(
        "absolute left-0 right-0 z-30 rounded-md border border-[var(--color-border)] shadow-lg overflow-hidden",
        positionClass
      )}
      style={{ backgroundColor: "var(--color-bg-elevated)" }}
    >
      <div className="px-2.5 py-1.5 border-b border-[var(--color-border)] flex items-center justify-between">
        <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-[0.08em] font-semibold text-[var(--color-muted)]">
          <History className="size-3" />
          recent prompts
        </span>
        <span className="text-[10px] text-[var(--color-muted-dim)] font-mono">
          ↑↓ select · ↵ insert · esc cancel
        </span>
      </div>
      <ul className="max-h-64 overflow-y-auto py-1">
        {matches.map((entry, i) => {
          const selected = i === selectedIndex;
          return (
            <li key={entry.prompt}>
              <button
                type="button"
                role="option"
                aria-selected={selected}
                onMouseDown={(e) => {
                  // Prevent textarea blur before we can run the insert.
                  e.preventDefault();
                  onSelect(entry);
                }}
                onMouseEnter={() => onHover(i)}
                className={cn(
                  "w-full px-2.5 py-1.5 text-left transition-colors",
                  selected
                    ? "bg-[var(--color-accent-dim)] text-[var(--color-fg)]"
                    : "text-[var(--color-fg-dim)] hover:bg-[var(--color-surface)]"
                )}
              >
                <div
                  className="text-[12px] line-clamp-2 leading-snug break-words"
                  title={entry.prompt}
                >
                  {entry.prompt}
                </div>
                <div className="text-[9.5px] text-[var(--color-muted)] font-mono tabular-nums mt-0.5">
                  used {entry.uses}× · {relativeTime(entry.lastUsedAt)}
                </div>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function relativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  const diff = Math.max(0, (Date.now() - then) / 1000);
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  const days = Math.floor(diff / 86400);
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}
