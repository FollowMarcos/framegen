"use client";

import { RotateCw } from "lucide-react";
import type { AdjustmentStack } from "@/lib/editor/types";
import { AdjustmentSlider } from "./AdjustmentSlider";

export function AdjustmentRail({
  adjustments,
  hasBase,
  onChange,
  onReset,
  onRotate,
}: {
  adjustments: AdjustmentStack;
  hasBase: boolean;
  onChange: (key: keyof AdjustmentStack, value: number) => void;
  onReset: () => void;
  onRotate: () => void;
}) {
  return (
    <div className="w-60 shrink-0 border-r border-[var(--color-border)] bg-[var(--color-bg-elevated)] overflow-y-auto">
      <div className="px-4 py-3 flex items-center justify-between border-b border-[var(--color-border)]">
        <h2 className="text-[11px] font-semibold uppercase tracking-wider text-[var(--color-muted)]">
          Adjust
        </h2>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={onRotate}
            disabled={!hasBase}
            title="rotate 90°"
            aria-label="rotate base 90°"
            className="size-6 grid place-items-center rounded text-[var(--color-muted)] hover:text-[var(--color-fg)] hover:bg-[var(--color-surface)] disabled:opacity-30 disabled:cursor-not-allowed transition"
          >
            <RotateCw className="size-3.5" />
          </button>
          <button
            type="button"
            onClick={onReset}
            disabled={!hasBase}
            className="text-[10px] uppercase tracking-wider font-medium text-[var(--color-muted)] hover:text-[var(--color-fg)] disabled:opacity-30 disabled:cursor-not-allowed transition"
          >
            Reset
          </button>
        </div>
      </div>

      {!hasBase ? (
        <p className="px-4 py-6 text-[11px] text-[var(--color-muted)] leading-relaxed">
          Adjustments apply to the base layer. Click{" "}
          <span className="text-[var(--color-fg-dim)] font-medium">Add image</span>{" "}
          in the toolbar to set one — the first image you add becomes the
          base.
        </p>
      ) : (
        <div className="px-4 py-2 space-y-3">
          <Section title="Light">
            <AdjustmentSlider
              label="Exposure"
              value={adjustments.exposure}
              onChange={(v) => onChange("exposure", v)}
            />
            <AdjustmentSlider
              label="Contrast"
              value={adjustments.contrast}
              onChange={(v) => onChange("contrast", v)}
            />
            <AdjustmentSlider
              label="Highlights"
              value={adjustments.highlights}
              onChange={(v) => onChange("highlights", v)}
            />
            <AdjustmentSlider
              label="Shadows"
              value={adjustments.shadows}
              onChange={(v) => onChange("shadows", v)}
            />
          </Section>

          <Section title="Color">
            <AdjustmentSlider
              label="Saturation"
              value={adjustments.saturation}
              onChange={(v) => onChange("saturation", v)}
            />
            <AdjustmentSlider
              label="Vibrance"
              value={adjustments.vibrance}
              onChange={(v) => onChange("vibrance", v)}
            />
            <AdjustmentSlider
              label="Temperature"
              value={adjustments.temperature}
              onChange={(v) => onChange("temperature", v)}
            />
            <AdjustmentSlider
              label="Tint"
              value={adjustments.tint}
              onChange={(v) => onChange("tint", v)}
            />
          </Section>

          <Section title="Detail">
            <AdjustmentSlider
              label="Sharpen"
              value={adjustments.sharpen}
              onChange={(v) => onChange("sharpen", v)}
              min={0}
              max={1}
              defaultValue={0}
            />
          </Section>
        </div>
      )}
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <h3 className="text-[10px] font-semibold uppercase tracking-wider text-[var(--color-muted-dim)] mb-1">
        {title}
      </h3>
      {children}
    </div>
  );
}
