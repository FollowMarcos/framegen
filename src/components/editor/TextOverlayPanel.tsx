"use client";

import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  Bold,
  Italic,
  Underline,
} from "lucide-react";
import type { TextOverlay } from "@/lib/editor/types";
import { cn } from "@/lib/utils";
import { CATEGORY_ORDER, FONTS_BY_CATEGORY } from "@/lib/editor/fonts";
import { resolveFontFamily } from "@/lib/editor/fontModules";
import {
  TEXT_EFFECT_PRESETS,
  detectActivePresetId,
} from "@/lib/editor/textEffects";

const WEIGHTS: TextOverlay["fontWeight"][] = [400, 500, 600, 700];

export function TextOverlayPanel({
  overlay,
  onChange,
}: {
  overlay: TextOverlay;
  onChange: (patch: Partial<TextOverlay>) => void;
}) {
  return (
    <div className="border-t border-[var(--color-border)] bg-[var(--color-bg-elevated)] px-4 py-3 space-y-3">
      <h3 className="text-[10px] font-semibold uppercase tracking-wider text-[var(--color-muted-dim)]">
        Text
      </h3>

      <textarea
        value={overlay.text}
        onChange={(e) => onChange({ text: e.target.value })}
        placeholder="Type something…"
        rows={2}
        className="w-full bg-[var(--color-surface)] border border-[var(--color-border)] rounded-md px-2 py-1.5 text-[12px] text-[var(--color-fg)] outline-none focus:border-[var(--color-border-strong)] resize-none"
      />

      <div className="grid grid-cols-2 gap-2">
        <label className="block">
          <span className="block text-[10px] font-medium text-[var(--color-muted)] mb-1">
            Font
          </span>
          <select
            value={overlay.fontFamily}
            onChange={(e) => onChange({ fontFamily: e.target.value })}
            className="w-full h-7 px-1.5 bg-[var(--color-surface)] border border-[var(--color-border)] rounded text-[11px] text-[var(--color-fg)] outline-none"
          >
            {CATEGORY_ORDER.map((cat) => (
              <optgroup key={cat} label={cat}>
                {FONTS_BY_CATEGORY[cat].map((f) => (
                  <option
                    key={f.family}
                    value={f.family}
                    // Inline-style each option so the dropdown previews
                    // the typeface — most modern browsers respect this
                    // for native <select> dropdowns.
                    style={{ fontFamily: resolveFontFamily(f.family) }}
                  >
                    {f.family}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="block text-[10px] font-medium text-[var(--color-muted)] mb-1">
            Size
          </span>
          <input
            type="number"
            min={6}
            max={400}
            value={overlay.fontSize}
            onChange={(e) =>
              onChange({ fontSize: Math.max(6, Number(e.target.value) || 0) })
            }
            className="w-full h-7 px-1.5 bg-[var(--color-surface)] border border-[var(--color-border)] rounded text-[11px] text-[var(--color-fg)] outline-none"
          />
        </label>
      </div>

      <div className="flex items-center gap-1">
        <select
          value={overlay.fontWeight}
          onChange={(e) =>
            onChange({
              fontWeight: Number(e.target.value) as TextOverlay["fontWeight"],
            })
          }
          className="h-7 px-1.5 bg-[var(--color-surface)] border border-[var(--color-border)] rounded text-[11px] text-[var(--color-fg)] outline-none"
          aria-label="font weight"
        >
          {WEIGHTS.map((w) => (
            <option key={w} value={w}>
              {w === 400 ? "Regular" : w === 500 ? "Medium" : w === 600 ? "Semibold" : "Bold"}
            </option>
          ))}
        </select>

        <ToggleBtn
          active={overlay.fontWeight === 700}
          onClick={() => onChange({ fontWeight: overlay.fontWeight === 700 ? 400 : 700 })}
          title="bold"
        >
          <Bold className="size-3.5" />
        </ToggleBtn>
        <ToggleBtn
          active={overlay.italic}
          onClick={() => onChange({ italic: !overlay.italic })}
          title="italic"
        >
          <Italic className="size-3.5" />
        </ToggleBtn>
        <ToggleBtn
          active={overlay.underline}
          onClick={() => onChange({ underline: !overlay.underline })}
          title="underline"
        >
          <Underline className="size-3.5" />
        </ToggleBtn>

        <div className="mx-1 h-4 w-px bg-[var(--color-border)]" aria-hidden />

        <ToggleBtn
          active={overlay.align === "left"}
          onClick={() => onChange({ align: "left" })}
          title="align left"
        >
          <AlignLeft className="size-3.5" />
        </ToggleBtn>
        <ToggleBtn
          active={overlay.align === "center"}
          onClick={() => onChange({ align: "center" })}
          title="align center"
        >
          <AlignCenter className="size-3.5" />
        </ToggleBtn>
        <ToggleBtn
          active={overlay.align === "right"}
          onClick={() => onChange({ align: "right" })}
          title="align right"
        >
          <AlignRight className="size-3.5" />
        </ToggleBtn>
      </div>

      <label className="flex items-center gap-2">
        <span className="text-[10px] font-medium text-[var(--color-muted)] w-16">
          Color
        </span>
        <input
          type="color"
          value={overlay.color}
          onChange={(e) => onChange({ color: e.target.value })}
          className="h-6 w-10 bg-transparent border border-[var(--color-border)] rounded cursor-pointer"
          aria-label="text color"
        />
        <input
          type="text"
          value={overlay.color}
          onChange={(e) => onChange({ color: e.target.value })}
          className="flex-1 h-6 px-1.5 bg-[var(--color-surface)] border border-[var(--color-border)] rounded text-[11px] font-mono text-[var(--color-fg)] outline-none"
        />
      </label>

      <label className="flex items-center gap-2">
        <span className="text-[10px] font-medium text-[var(--color-muted)] w-16">
          Opacity
        </span>
        <input
          type="range"
          min={0}
          max={1}
          step={0.01}
          value={overlay.opacity}
          onChange={(e) => onChange({ opacity: Number(e.target.value) })}
          className="flex-1 h-1 accent-[var(--color-accent)]"
          aria-label="text opacity"
        />
        <span className="text-[10px] font-mono tabular-nums text-[var(--color-muted)] w-8 text-right">
          {Math.round(overlay.opacity * 100)}%
        </span>
      </label>

      <StylePresets overlay={overlay} onChange={onChange} />
    </div>
  );
}

// Effect preset row — each chip is a miniature preview of the same
// text with that effect applied, so the user can see what they're
// picking before they pick it. Click an active preset to clear it.
function StylePresets({
  overlay,
  onChange,
}: {
  overlay: TextOverlay;
  onChange: (patch: Partial<TextOverlay>) => void;
}) {
  const activeId = detectActivePresetId(overlay);
  return (
    <div>
      <div className="text-[10px] font-semibold uppercase tracking-wider text-[var(--color-muted-dim)] mb-1.5">
        Style
      </div>
      <div className="grid grid-cols-4 gap-1">
        {TEXT_EFFECT_PRESETS.map((p) => {
          const isActive = activeId === p.id;
          const preview = p.apply(overlay);
          // Build a CSS-equivalent of the Konva effect props for the
          // preview chip — text-shadow + -webkit-text-stroke cover
          // both of our preset fields cleanly, and they're cheap.
          const previewStyle = buildPreviewStyle(
            overlay.color,
            preview.stroke,
            preview.shadow
          );
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => {
                onChange({
                  stroke: preview.stroke ?? null,
                  shadow: preview.shadow ?? null,
                });
              }}
              aria-pressed={isActive}
              title={p.label}
              className={cn(
                "h-12 rounded-md border transition-colors grid place-items-center text-[18px] font-bold leading-none overflow-hidden bg-[var(--color-surface)]",
                isActive
                  ? "border-[var(--color-accent)]"
                  : "border-[var(--color-border)] hover:border-[var(--color-border-strong)]"
              )}
            >
              <span
                style={previewStyle}
                aria-hidden
                // Inline white background swatch under "shadow" / "long
                // shadow" previews would make sense, but keeping the
                // chips uniform reads more like a unified palette.
              >
                Aa
              </span>
            </button>
          );
        })}
      </div>
      <div className="mt-1 text-[10px] text-[var(--color-muted)]">
        {TEXT_EFFECT_PRESETS.find((p) => p.id === activeId)?.label ??
          "Custom"}
      </div>
    </div>
  );
}

function buildPreviewStyle(
  color: string,
  stroke: TextOverlay["stroke"],
  shadow: TextOverlay["shadow"]
): React.CSSProperties {
  const style: React.CSSProperties = { color };
  if (stroke) {
    // -webkit-text-stroke is widely supported and renders a real
    // outline rather than the multiple text-shadow trick — better
    // visual match to Konva's stroke path.
    (style as React.CSSProperties & { WebkitTextStroke?: string })
      .WebkitTextStroke = `${stroke.width / 6}px ${stroke.color}`;
  }
  if (shadow) {
    const c = hexWithOpacity(shadow.color, shadow.opacity);
    style.textShadow = `${shadow.offsetX / 4}px ${shadow.offsetY / 4}px ${shadow.blur / 4}px ${c}`;
  }
  return style;
}

// Combines a hex colour with an alpha into an 8-digit hex string so
// the preview's text-shadow can match Konva's shadowOpacity. Keeps the
// preview accurate for the Neon / Glow presets that depend on alpha.
function hexWithOpacity(hex: string, opacity: number): string {
  const clean = hex.replace(/^#/, "");
  if (clean.length !== 6) return hex;
  const a = Math.round(Math.max(0, Math.min(1, opacity)) * 255)
    .toString(16)
    .padStart(2, "0");
  return `#${clean}${a}`;
}

function ToggleBtn({
  active,
  onClick,
  title,
  children,
}: {
  active?: boolean;
  onClick: () => void;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      aria-label={title}
      aria-pressed={active}
      className={cn(
        "size-7 grid place-items-center rounded transition-colors",
        active
          ? "bg-[var(--color-accent-dim)] text-[var(--color-fg)]"
          : "text-[var(--color-muted)] hover:text-[var(--color-fg)] hover:bg-[var(--color-surface)]"
      )}
    >
      {children}
    </button>
  );
}
