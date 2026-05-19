"use client";

import { cn } from "@/lib/utils";
import type { PickedImage } from "@/components/ImagePicker";

export function MentionPopover({
  refs,
  selectedIndex,
  onSelect,
  onHover,
  placement = "below",
}: {
  refs: PickedImage[];
  selectedIndex: number;
  onSelect: (index: number) => void;
  onHover: (index: number) => void;
  // Flip to "above" in the floating dock layout, where the textarea sits
  // at the bottom of the viewport and a downward popover would clip.
  placement?: "below" | "above";
}) {
  const positionClass =
    placement === "above" ? "bottom-full mb-1" : "top-full mt-1";

  if (refs.length === 0) {
    return (
      <div
        className={cn(
          "absolute left-0 right-0 z-30 rounded-md border border-[var(--color-border,#232329)] px-3 py-2 text-[11px] text-[var(--color-muted)]",
          positionClass
        )}
        style={{ backgroundColor: "var(--color-bg-elevated)" }}
      >
        no reference images yet — add one above
      </div>
    );
  }

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
          insert reference
        </span>
        <span className="text-[10px] text-[var(--color-muted-dim)] font-mono">
          ↑↓ select · ↵ insert · esc cancel
        </span>
      </div>
      <ul className="max-h-56 overflow-y-auto py-1">
        {refs.map((ref, i) => {
          const selected = i === selectedIndex;
          return (
            <li key={i}>
              <button
                type="button"
                role="option"
                aria-selected={selected}
                onMouseDown={(e) => {
                  // Prevent textarea blur before we can run the insert.
                  e.preventDefault();
                  onSelect(i);
                }}
                onMouseEnter={() => onHover(i)}
                className={cn(
                  "w-full flex items-center gap-2.5 px-2.5 py-1.5 text-left text-[12px] transition-colors",
                  selected
                    ? "bg-[var(--color-accent-dim)] text-[var(--color-fg)]"
                    : "text-[var(--color-fg-dim)] hover:bg-[var(--color-surface)]"
                )}
              >
                <div className="size-8 shrink-0 rounded overflow-hidden bg-black border border-[var(--color-border)]">
                  { }
                  <img
                    src={ref.preview}
                    alt=""
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="font-mono text-[11px]">@image{i + 1}</div>
                  <div className="text-[10px] text-[var(--color-muted)] truncate" title={ref.name}>
                    {ref.name}
                  </div>
                </div>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
