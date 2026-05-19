"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2, Sparkles, X, Zap } from "lucide-react";
import { Kbd } from "@/components/fields";
import { cn } from "@/lib/utils";
import {
  estimateUpscaleCost,
  formatCost,
  getAllUpscaleModels,
  type UpscaleModel,
} from "@/lib/upscaleModels";
import { fetchPrices, type FalPrice } from "@/lib/pricingApi";
import type { StoredAsset } from "@/lib/storage";

const FACTOR_CHOICES = [2, 4] as const;

export function UpscaleModal({
  asset,
  onClose,
  onConfirm,
}: {
  asset: StoredAsset;
  onClose: () => void;
  onConfirm: (modelId: string, factor: number) => void;
}) {
  const [factor, setFactor] = useState<number>(2);
  const allModels = useMemo(() => getAllUpscaleModels(), []);
  const [selectedId, setSelectedId] = useState<string>(allModels[0].id);
  const [submitting, setSubmitting] = useState(false);

  // Live prices from fal, keyed by endpoint id. null while loading; the
  // map's value is null when fal had no price for that id, in which case
  // we fall back to the hardcoded estimate.
  const [livePrices, setLivePrices] = useState<Map<string, FalPrice | null> | null>(null);
  useEffect(() => {
    let cancelled = false;
    fetchPrices(allModels.map((m) => m.id)).then((m) => {
      if (!cancelled) setLivePrices(m);
    });
    return () => {
      cancelled = true;
    };
  }, [allModels]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  // If the selected model doesn't support the current factor, snap factor
  // to that model's default.
  const selected = useMemo(
    () => allModels.find((m) => m.id === selectedId) ?? allModels[0],
    [selectedId, allModels]
  );
  useEffect(() => {
    if (!selected.factor.allowed.includes(factor)) {
      setFactor(selected.factor.default);
    }
  }, [selected, factor]);

  function confirm() {
    if (submitting) return;
    setSubmitting(true);
    onConfirm(selectedId, factor);
  }

  const outW = (asset.width ?? 0) * factor;
  const outH = (asset.height ?? 0) * factor;

  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={onClose}
      className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-6 animate-in"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-[560px] max-h-[calc(100vh-3rem)] rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-elevated)] overflow-hidden flex flex-col"
        style={{ backgroundColor: "var(--color-bg-elevated)" }}
      >
        <header className="flex items-center justify-between h-11 px-4 border-b border-[var(--color-border)] shrink-0">
          <div className="flex items-baseline gap-2">
            <h2 className="text-[13px] font-semibold tracking-tight">upscale</h2>
            <span className="text-[11px] text-[var(--color-muted)]">
              {asset.width}×{asset.height} →{" "}
              <span className="font-[family-name:var(--font-mono)] text-[var(--color-fg-dim)]">
                {outW}×{outH}
              </span>
            </span>
          </div>
          <button
            onClick={onClose}
            className="size-6 rounded-md grid place-items-center text-[var(--color-muted)] hover:text-[var(--color-fg)] hover:bg-[var(--color-surface)] transition"
            aria-label="close"
          >
            <X className="size-3.5" />
          </button>
        </header>

        <div className="p-4 space-y-4 flex-1 overflow-y-auto min-h-0">
          <div>
            <div className="text-[10px] uppercase tracking-[0.08em] text-[var(--color-muted)] font-semibold mb-1.5">
              factor
            </div>
            <div className="inline-flex p-0.5 rounded-md bg-[var(--color-surface)] border border-[var(--color-border)]">
              {FACTOR_CHOICES.map((f) => {
                const supported = selected.factor.allowed.includes(f);
                const active = factor === f;
                return (
                  <button
                    key={f}
                    type="button"
                    onClick={() => setFactor(f)}
                    disabled={!supported}
                    className={cn(
                      "px-3 h-7 rounded text-[12px] font-medium transition-colors",
                      active
                        ? "bg-[var(--color-bg-elevated)] text-[var(--color-fg)] shadow-sm"
                        : "text-[var(--color-muted)] hover:text-[var(--color-fg-dim)]",
                      !supported && "opacity-40 cursor-not-allowed"
                    )}
                    title={supported ? `${f}×` : `not supported by this model`}
                  >
                    {f}×
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <div className="text-[10px] uppercase tracking-[0.08em] text-[var(--color-muted)] font-semibold mb-1.5">
              model
            </div>
            <ul className="space-y-2">
              {allModels.map((m) => (
                <ModelRow
                  key={m.id}
                  model={m}
                  asset={asset}
                  factor={factor}
                  selected={m.id === selectedId}
                  onSelect={() => setSelectedId(m.id)}
                  livePrice={livePrices?.get(m.id) ?? null}
                />
              ))}
            </ul>
          </div>
        </div>

        <footer className="border-t border-[var(--color-border)] p-3 flex items-center justify-between gap-3 shrink-0">
          <span className="text-[11px] text-[var(--color-muted-dim)] flex items-center gap-1.5">
            <Kbd>esc</Kbd>
            <span>to cancel</span>
          </span>
          <button
            type="button"
            onClick={confirm}
            disabled={submitting}
            className="inline-flex items-center justify-center gap-1.5 h-9 px-4 rounded-md text-[13px] font-medium transition disabled:opacity-40 disabled:cursor-not-allowed"
            style={{
              backgroundColor: "var(--color-accent)",
              color: "var(--color-bg)",
            }}
          >
            {submitting ? (
              <>
                <Loader2 className="size-3.5 animate-spin" />
                queuing…
              </>
            ) : (
              <>
                <Sparkles className="size-3.5" />
                upscale with {selected.name}
              </>
            )}
          </button>
        </footer>
      </div>
    </div>
  );
}

function ModelRow({
  model,
  asset,
  factor,
  selected,
  onSelect,
  livePrice,
}: {
  model: UpscaleModel;
  asset: StoredAsset;
  factor: number;
  selected: boolean;
  onSelect: () => void;
  livePrice: FalPrice | null;
}) {
  const usableFactor = model.factor.allowed.includes(factor)
    ? factor
    : model.factor.default;

  // Prefer live pricing from fal when we have it; fall back to the hardcoded
  // registry estimate. For "image" unit we multiply by 1 (a single output);
  // for "megapixel" we multiply by the output megapixels.
  let cost = estimateUpscaleCost(model, usableFactor, asset);
  let priceSource: "live" | "estimate" = "estimate";
  if (livePrice && asset.width && asset.height) {
    const outW = asset.width * usableFactor;
    const outH = asset.height * usableFactor;
    if (livePrice.unit === "image") {
      cost = livePrice.unit_price;
      priceSource = "live";
    } else if (livePrice.unit === "megapixel") {
      const outMP = (outW * outH) / 1_000_000;
      cost = livePrice.unit_price * outMP;
      priceSource = "live";
    }
    // "second" unit can't be predicted client-side; keep the estimate.
  }

  return (
    <li>
      <button
        type="button"
        onClick={onSelect}
        aria-pressed={selected}
        className={cn(
          "w-full text-left rounded-lg border p-3 transition-colors flex items-start gap-3",
          selected
            ? "border-[var(--color-accent)] bg-[var(--color-accent-dim)]"
            : "border-[var(--color-border)] hover:border-[var(--color-border-strong)] bg-[var(--color-surface)]"
        )}
      >
        <span
          className={cn(
            "mt-1 size-3.5 rounded-full grid place-items-center shrink-0",
            selected
              ? "bg-[var(--color-accent)]"
              : "border border-[var(--color-border-strong)]"
          )}
          aria-hidden
        >
          {selected && <span className="size-1.5 rounded-full bg-black" />}
        </span>

        <div className="flex-1 min-w-0">
          <div className="flex items-baseline justify-between gap-2">
            <div className="flex items-baseline gap-2 min-w-0">
              <span className="text-[13px] font-medium text-[var(--color-fg)] truncate">
                {model.name}
              </span>
              <QualityBadge level={model.qualityHint} />
            </div>
            <div className="text-[11px] font-mono text-[var(--color-fg-dim)] whitespace-nowrap">
              {cost === null ? (
                <span className="text-[var(--color-muted)]">price unknown</span>
              ) : (
                <>
                  {priceSource === "live" ? formatCost(cost) : `~${formatCost(cost)}`}
                  {priceSource === "live" && (
                    <span
                      className="ml-1 text-[9px] text-[var(--color-accent)] uppercase tracking-wider"
                      title="live price from fal.ai"
                    >
                      live
                    </span>
                  )}
                </>
              )}
            </div>
          </div>
          <p className="text-[11px] text-[var(--color-muted)] mt-1 leading-snug">
            {model.description}
          </p>
          <p className="text-[10px] text-[var(--color-muted-dim)] mt-1 font-mono">
            {model.pricing.kind === "per_mp"
              ? `$${model.pricing.usdPerMP.toFixed(3)}/megapixel · output`
              : `$${model.pricing.usdPerSecond.toFixed(5)}/sec · ~${model.pricing.estimateSeconds}s typical`}
            {model.pricing.note ? ` · ${model.pricing.note}` : ""}
          </p>
        </div>
      </button>
    </li>
  );
}

function QualityBadge({ level }: { level: "basic" | "balanced" | "premium" }) {
  const map = {
    basic: { label: "fast", color: "text-[var(--color-muted)]" },
    balanced: { label: "balanced", color: "text-[var(--color-fg-dim)]" },
    premium: { label: "premium", color: "text-[var(--color-accent)]" },
  } as const;
  const m = map[level];
  return (
    <span className={cn("text-[10px] uppercase tracking-[0.08em] font-semibold", m.color)}>
      <Zap className="size-2.5 inline-block -mt-0.5 mr-0.5" />
      {m.label}
    </span>
  );
}
