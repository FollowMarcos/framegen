"use client";

import { cn } from "@/lib/utils";
import type { Snippet } from "@/lib/snippets";

export function SnippetPopover({
  matches,
  selectedIndex,
  onSelect,
  onHover,
  onManage,
  placement = "below",
}: {
  matches: Snippet[];
  selectedIndex: number;
  onSelect: (snippet: Snippet) => void;
  onHover: (index: number) => void;
  onManage: () => void;
  // Flip to "above" in the floating dock layout (textarea sits low).
  placement?: "below" | "above";
}) {
  const positionClass =
    placement === "above" ? "bottom-full mb-1" : "top-full mt-1";
  return (
    <div
      role="listbox"
      className={cn(
        "absolute left-0 right-0 z-30 rounded-md border border-[var(--color-border,#232329)] shadow-lg overflow-hidden",
        positionClass
      )}
      style={{ backgroundColor: "var(--color-bg-elevated)" }}
    >
      <div className="px-2.5 py-1.5 border-b border-[var(--color-border)] flex items-center justify-between">
        <span className="text-[10px] uppercase tracking-[0.08em] font-semibold text-[var(--color-muted)]">
          insert snippet
        </span>
        <button
          type="button"
          onMouseDown={(e) => {
            e.preventDefault();
            onManage();
          }}
          className="text-[10px] text-[var(--color-muted)] hover:text-[var(--color-fg)] font-mono"
        >
          manage
        </button>
      </div>
      {matches.length === 0 ? (
        <div className="px-2.5 py-3 text-[11px] text-[var(--color-muted)]">
          no snippets saved yet — use{" "}
          <span className="font-mono text-[var(--color-fg-dim)]">manage</span> to add one
        </div>
      ) : (
        <ul className="max-h-56 overflow-y-auto py-1">
          {matches.map((snip, i) => {
            const selected = i === selectedIndex;
            return (
              <li key={snip.id}>
                <button
                  type="button"
                  role="option"
                  aria-selected={selected}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    onSelect(snip);
                  }}
                  onMouseEnter={() => onHover(i)}
                  className={cn(
                    "w-full px-2.5 py-1.5 text-left transition-colors",
                    selected
                      ? "bg-[var(--color-accent-dim)] text-[var(--color-fg)]"
                      : "text-[var(--color-fg-dim)] hover:bg-[var(--color-surface)]"
                  )}
                >
                  <div className="font-mono text-[11px] text-[var(--color-fg)]">
                    /{snip.name}
                  </div>
                  <div className="text-[10px] text-[var(--color-muted)] truncate" title={snip.body}>
                    {snip.body}
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
