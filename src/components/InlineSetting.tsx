"use client";

import { useState } from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ChipOption } from "@/components/DockChip";

// Text-as-control. Renders the active value as inline text styled like
// regular copy; on hover the text underlines and brightens; on click it
// opens a popover of options anchored above. Used in the dock's status
// line so the current settings read as a sentence rather than as a row
// of bordered chips.

export function InlineSetting({
  value,
  label,
  options,
  onSelect,
  ariaLabel,
  disabled,
}: {
  value: string;
  label: string;
  options: ChipOption[] | readonly ChipOption[];
  onSelect: (value: string) => void;
  ariaLabel: string;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);

  return (
    <span className="relative inline-flex">
      <button
        type="button"
        onClick={() => !disabled && setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel}
        disabled={disabled}
        className={cn(
          "text-[12px] font-medium underline-offset-[3px] decoration-from-font transition-colors",
          "disabled:cursor-not-allowed disabled:opacity-50",
          open
            ? "text-[var(--color-fg)] underline decoration-[var(--color-accent)]"
            : "text-[var(--color-fg-dim)] hover:text-[var(--color-fg)] hover:underline"
        )}
      >
        {label}
      </button>

      {open && (
        <>
          <span
            className="fixed inset-0 z-10"
            onClick={() => setOpen(false)}
            aria-hidden
          />
          <ul
            role="listbox"
            className="absolute z-20 left-0 bottom-full mb-1.5 min-w-[140px] rounded-md border border-[var(--color-border)] shadow-lg overflow-hidden py-1"
            style={{ backgroundColor: "var(--color-bg-elevated)" }}
          >
            {options.map((o) => {
              const selected = o.value === value;
              return (
                <li key={o.value}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={selected}
                    onClick={() => {
                      onSelect(o.value);
                      setOpen(false);
                    }}
                    className={cn(
                      "w-full px-3 py-1.5 text-left text-[12px] transition-colors flex items-center justify-between gap-3 whitespace-nowrap",
                      selected
                        ? "bg-[var(--color-accent-dim)] text-[var(--color-fg)]"
                        : "text-[var(--color-fg-dim)] hover:bg-[var(--color-surface)]"
                    )}
                  >
                    <span className="font-medium">{o.label}</span>
                    {o.hint && !selected && (
                      <span className="text-[10px] text-[var(--color-muted)]">
                        {o.hint}
                      </span>
                    )}
                    {selected && (
                      <Check className="size-3 text-[var(--color-accent)]" />
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </span>
  );
}
