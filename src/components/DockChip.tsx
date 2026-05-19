"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

// Compact pill-style picker for the floating studio dock. A small button
// shows the current value with an optional icon; clicking opens a small
// popover with the available options. Use for short single-value choices
// (resolution tier, aspect ratio, quality, format). For richer pickers —
// e.g. the model picker with description + price per row — keep using the
// full-width <ModelPicker /> dropdown instead.

export type ChipOption = {
  value: string;
  label: string;
  hint?: string;
};

export function DockChip({
  icon,
  value,
  label,
  options,
  onSelect,
  placement = "above",
  ariaLabel,
  disabled,
  variant = "standalone",
}: {
  icon?: React.ReactNode;
  value: string;
  label: string;
  options: ChipOption[] | readonly ChipOption[];
  onSelect: (value: string) => void;
  placement?: "above" | "below";
  ariaLabel: string;
  disabled?: boolean;
  // "standalone" — has its own border + bg, used outside groups.
  // "segmented" — borderless + transparent bg, designed to sit inside a
  //               parent <SegmentedGroup> that draws the outer border and
  //               internal hairlines on its behalf. Cuts visual noise when
  //               several chips cluster together.
  variant?: "standalone" | "segmented";
}) {
  const [open, setOpen] = useState(false);
  const isSegmented = variant === "segmented";

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => !disabled && setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel}
        disabled={disabled}
        className={cn(
          "h-9 inline-flex items-center gap-1.5 px-3 text-[12px] font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed",
          isSegmented
            ? cn(
                "bg-transparent",
                open
                  ? "text-[var(--color-fg)] bg-[var(--color-surface-hover)]"
                  : "text-[var(--color-fg)] hover:bg-[var(--color-surface-hover)]"
              )
            : cn(
                "rounded-md border",
                open
                  ? "bg-[var(--color-surface-hover)] border-[var(--color-border-strong)] text-[var(--color-fg)]"
                  : "bg-[var(--color-surface)] border-[var(--color-border)] text-[var(--color-fg)] hover:border-[var(--color-border-strong)]"
              )
        )}
      >
        {icon && (
          <span className="text-[var(--color-muted)] inline-flex" aria-hidden>
            {icon}
          </span>
        )}
        <span className="tabular-nums">{label}</span>
      </button>

      {open && (
        <>
          <div
            className="fixed inset-0 z-10"
            onClick={() => setOpen(false)}
            aria-hidden
          />
          <ul
            role="listbox"
            className={cn(
              "absolute z-20 left-0 min-w-[120px] rounded-md border border-[var(--color-border)] shadow-lg overflow-hidden py-1",
              placement === "above" ? "bottom-full mb-1" : "top-full mt-1"
            )}
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
                      "w-full px-3 py-1.5 text-left text-[12px] transition-colors flex items-baseline gap-2 whitespace-nowrap",
                      selected
                        ? "bg-[var(--color-accent-dim)] text-[var(--color-fg)]"
                        : "text-[var(--color-fg-dim)] hover:bg-[var(--color-surface)]"
                    )}
                  >
                    <span className="font-medium">{o.label}</span>
                    {o.hint && (
                      <span className="text-[10px] text-[var(--color-muted)] ml-auto">
                        {o.hint}
                      </span>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </div>
  );
}
