"use client";

import { useMemo } from "react";
import { cn } from "@/lib/utils";
import { Select, Field } from "@/components/fields";
import {
  SIZE_PRESETS,
  type ResolutionTier,
  type SizeOption,
  tierFor,
  defaultSizeFor,
} from "@/lib/sizes";

const TIERS: { id: ResolutionTier; label: string; hint: string }[] = [
  { id: "1k", label: "1k", hint: "fast" },
  { id: "2k", label: "2k", hint: "balanced" },
  { id: "4k", label: "4k", hint: "max" },
];

export function SizePicker({
  value,
  onChange,
  disabled,
}: {
  value: SizeOption;
  onChange: (size: SizeOption) => void;
  disabled?: boolean;
}) {
  const activeTier = (tierFor(value.id) ?? "1k") as ResolutionTier;
  const aspects = useMemo(() => SIZE_PRESETS[activeTier], [activeTier]);

  function pickTier(t: ResolutionTier) {
    if (t === activeTier) return;
    const sameAspect = SIZE_PRESETS[t].find((s) => s.aspectId === value.aspectId);
    onChange(sameAspect ?? defaultSizeFor(t));
  }

  function pickAspect(id: string) {
    const next = SIZE_PRESETS[activeTier].find((s) => s.id === id);
    if (next) onChange(next);
  }

  return (
    <div
      className={cn(
        "space-y-3 transition-opacity",
        disabled && "opacity-40 pointer-events-none select-none"
      )}
      aria-disabled={disabled}
    >
      <div>
        <div className="text-[11px] font-medium text-[var(--color-fg-dim)] mb-1.5">resolution</div>
        <div
          role="radiogroup"
          aria-label="resolution"
          className="grid grid-cols-3 gap-1 p-0.5 rounded-md bg-[var(--color-surface)] border border-[var(--color-border)]"
        >
          {TIERS.map((t) => {
            const selected = t.id === activeTier;
            return (
              <button
                key={t.id}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => pickTier(t.id)}
                tabIndex={disabled ? -1 : 0}
                className={cn(
                  "h-8 rounded text-[12px] font-medium transition-colors flex flex-col items-center justify-center leading-none gap-0.5",
                  selected
                    ? "bg-[var(--color-bg-elevated)] text-[var(--color-fg)] shadow-sm"
                    : "text-[var(--color-muted)] hover:text-[var(--color-fg-dim)]"
                )}
              >
                <span className="font-[family-name:var(--font-mono)] tracking-tight">{t.label}</span>
                <span className="text-[9px] text-[var(--color-muted-dim)]">{t.hint}</span>
              </button>
            );
          })}
        </div>
      </div>

      <Field label="aspect" hint={`${value.width} × ${value.height}`}>
        <Select
          value={value.id}
          onChange={(e) => pickAspect(e.target.value)}
          options={aspects.map((a) => ({ value: a.id, label: a.label }))}
          tabIndex={disabled ? -1 : 0}
        />
      </Field>
    </div>
  );
}
