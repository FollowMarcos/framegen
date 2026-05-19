"use client";

import { cn } from "@/lib/utils";

// Lightroom-style slider: label on the left, value on the right, range
// underneath. Double-click resets to the default (caller-supplied). All
// values are floats; rounding is the caller's responsibility.

export function AdjustmentSlider({
  label,
  value,
  onChange,
  min = -1,
  max = 1,
  step = 0.01,
  defaultValue = 0,
  format = (v) => v.toFixed(2),
  disabled,
}: {
  label: string;
  value: number;
  onChange: (next: number) => void;
  min?: number;
  max?: number;
  step?: number;
  defaultValue?: number;
  format?: (v: number) => string;
  disabled?: boolean;
}) {
  const dirty = Math.abs(value - defaultValue) > 1e-6;
  return (
    <div className={cn("py-1", disabled && "opacity-40 pointer-events-none")}>
      <div className="flex items-baseline justify-between gap-2 mb-0.5">
        <span className="text-[11px] font-medium text-[var(--color-fg-dim)]">
          {label}
        </span>
        <button
          type="button"
          onDoubleClick={() => onChange(defaultValue)}
          onClick={(e) => {
            // Single-click on the value just selects it for keyboard
            // editing later — no-op for now, but reserves the gesture.
            e.stopPropagation();
          }}
          title="double-click to reset"
          className={cn(
            "text-[10px] font-mono tabular-nums px-1 rounded transition-colors",
            dirty
              ? "text-[var(--color-fg)] hover:bg-[var(--color-surface)]"
              : "text-[var(--color-muted-dim)]"
          )}
        >
          {format(value)}
        </button>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        onDoubleClick={() => onChange(defaultValue)}
        className="w-full h-1 accent-[var(--color-accent)] cursor-pointer"
        aria-label={label}
      />
    </div>
  );
}
