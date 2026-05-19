"use client";

import { useEffect, useState } from "react";
import {
  fetchPrices,
  perImageCostUSD,
  formatUSD,
  type FalPrice,
} from "@/lib/pricingApi";
import { priceForImage } from "@/lib/pricing";
import { MODELS, type Quality } from "@/lib/fal";

// Live pre-generation cost estimate. Two sources of truth, in order:
//
//   1. Local table in src/lib/pricing.ts — authoritative for GPT Image 2's
//      tiered (size × quality) pricing. fal's /v1/models/pricing returns a
//      single representative `unit_price` that ignores quality, which would
//      under- or over-state the cost by ~30× for low vs. high. We prefer the
//      local table whenever it covers the exact (width × height × quality).
//
//   2. fal's /v1/models/pricing — fallback for sizes outside the local table
//      and for any other model the user registers under Dashboard → Models.
//      Quality-blind, so the number is a ballpark for gpt-image-2 but the
//      best we have without official non-canonical rates.
//
// Only "image" and "megapixel" units can be projected client-side; everything
// else (per-second, etc.) shows a labelled "—" with a tooltip explaining why.

const GPT_IMAGE_MODELS = new Set<string>([MODELS.image, MODELS.imageEdit]);

export function CostEstimate({
  modelId,
  numImages,
  width,
  height,
  quality,
  className,
}: {
  modelId: string;
  numImages: number;
  width: number;
  height: number;
  quality: Quality;
  className?: string;
}) {
  const [price, setPrice] = useState<FalPrice | null | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    setPrice(undefined);
    fetchPrices([modelId]).then((m) => {
      if (!cancelled) setPrice(m.get(modelId) ?? null);
    });
    return () => {
      cancelled = true;
    };
  }, [modelId]);

  const localPerImage = GPT_IMAGE_MODELS.has(modelId)
    ? priceForImage(width, height, quality)
    : null;
  const remotePerImage =
    price === undefined || price === null
      ? null
      : perImageCostUSD(price, width, height);
  const perImage = localPerImage ?? remotePerImage;
  const total = perImage === null ? null : perImage * numImages;

  // Loading only blocks the display when local couldn't answer.
  const loading = localPerImage === null && price === undefined;
  const approximate = localPerImage === null && remotePerImage !== null;

  let tip: string;
  if (total !== null && perImage !== null) {
    const source = localPerImage !== null
      ? "gpt-image-2 published rates"
      : "live fal price (quality-blind ballpark)";
    tip = `~${formatUSD(perImage)} × ${numImages} image${
      numImages === 1 ? "" : "s"
    } · ${source}`;
  } else if (loading) {
    tip = "fetching live fal price…";
  } else if (price && price.unit !== "image" && price.unit !== "megapixel") {
    tip = `this model is priced per ${price.unit} — actual cost depends on runtime`;
  } else {
    tip = "no published price for this model — check Dashboard → Models";
  }

  return (
    <div
      className={
        "inline-flex items-baseline gap-1.5 text-[11px] font-mono tabular-nums " +
        (className ?? "")
      }
      title={tip}
    >
      <span className="text-[9px] uppercase tracking-wider text-[var(--color-muted-dim)] not-italic">
        est.
      </span>
      {loading ? (
        <span className="text-[var(--color-muted-dim)]">…</span>
      ) : total !== null ? (
        <span className="text-[var(--color-fg-dim)]">
          {approximate && "~"}
          {formatUSD(total)}
        </span>
      ) : (
        <span className="text-[var(--color-muted-dim)]">—</span>
      )}
    </div>
  );
}
