"use client";

import { useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { ModelLogo } from "@/components/ModelLogo";
import { type GenerationModel } from "@/lib/generationModels";

// Minimal model picker — vendor logo + name in both the trigger button and
// each dropdown row. Descriptions, model ids, and per-model price hints
// were moved out to keep this pure: the cost line lives in the studio
// panel's CostEstimate just below, the model id appears as a tooltip on
// the row, and richer per-model docs live in Dashboard → Models.

export function ModelPicker({
  models,
  selectedId,
  onSelect,
  placement = "below",
}: {
  models: GenerationModel[];
  selectedId: string;
  onSelect: (id: string) => void;
  // Flip to "above" in the floating dock layout (button sits low).
  placement?: "below" | "above";
}) {
  const [open, setOpen] = useState(false);

  const selected = models.find((m) => m.id === selectedId) ?? models[0];

  if (!selected) return null;

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full inline-flex items-center justify-between gap-2 h-9 px-3 rounded-md bg-[var(--color-surface)] border border-[var(--color-border)] hover:border-[var(--color-border-strong)] text-[12px] transition"
      >
        <span className="flex items-center gap-2 min-w-0">
          <ModelLogo
            modelId={selected.id}
            className="size-3.5 text-[var(--color-fg-dim)] shrink-0"
          />
          <span className="truncate text-[var(--color-fg)] font-medium">{selected.name}</span>
          {!selected.isBuiltIn && (
            <span className="text-[9px] text-[var(--color-accent)] uppercase tracking-wider shrink-0">
              custom
            </span>
          )}
        </span>
        <ChevronDown className="size-3.5 text-[var(--color-muted)] shrink-0" />
      </button>

      {open && (
        <>
          <div
            className="fixed inset-0 z-10"
            onClick={() => setOpen(false)}
            aria-hidden
          />
          <div
            role="listbox"
            className={cn(
              "absolute left-0 right-0 z-20 rounded-md border border-[var(--color-border)] shadow-lg overflow-hidden",
              placement === "above" ? "bottom-full mb-1" : "top-full mt-1"
            )}
            style={{ backgroundColor: "var(--color-bg-elevated)" }}
          >
            <ul className="max-h-80 overflow-y-auto py-1">
              {models.map((m) => (
                <ModelRow
                  key={m.id}
                  model={m}
                  isSelected={m.id === selectedId}
                  onPick={() => {
                    onSelect(m.id);
                    setOpen(false);
                  }}
                />
              ))}
            </ul>
          </div>
        </>
      )}
    </div>
  );
}

function ModelRow({
  model,
  isSelected,
  onPick,
}: {
  model: GenerationModel;
  isSelected: boolean;
  onPick: () => void;
}) {
  return (
    <li>
      <button
        type="button"
        role="option"
        aria-selected={isSelected}
        onClick={onPick}
        title={model.id}
        className={cn(
          "w-full h-9 px-3 text-left transition-colors flex items-center gap-2.5",
          isSelected
            ? "bg-[var(--color-accent-dim)] text-[var(--color-fg)]"
            : "text-[var(--color-fg-dim)] hover:bg-[var(--color-surface)]"
        )}
      >
        <ModelLogo
          modelId={model.id}
          className={cn(
            "size-3.5 shrink-0",
            isSelected ? "text-[var(--color-fg)]" : "text-[var(--color-fg-dim)]"
          )}
        />
        <span className="flex-1 min-w-0 truncate text-[12px] font-medium">
          {model.name}
        </span>
        {!model.isBuiltIn && (
          <span className="text-[9px] text-[var(--color-accent)] uppercase tracking-wider shrink-0">
            custom
          </span>
        )}
        {isSelected && (
          <Check
            className="size-3.5 text-[var(--color-accent)] shrink-0"
            strokeWidth={2.5}
          />
        )}
      </button>
    </li>
  );
}
