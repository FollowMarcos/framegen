"use client";

import { Coins } from "lucide-react";
import { formatUSD } from "@/lib/pricing";

// Header chip summarizing this session's spend. Three render states:
//
//   - Empty session (nothing generated yet) — null (no chip).
//   - All priced — "$X.XX · N"    (the clean common case).
//   - Mixed     — "$X.XX+ · N"    (some priced, some at custom sizes we
//                                  can't price; total is a lower bound).
//   - All unpriced — "— · N"      (literally cannot price any of them).
//
// The "+" marker replaces the old "+?" — same meaning, less noise, and the
// tooltip spells out the math so users don't have to guess.

export function SessionCost({
  totalUSD,
  knownCount,
  unknownCount,
}: {
  totalUSD: number;
  knownCount: number;
  unknownCount: number;
}) {
  const total = knownCount + unknownCount;
  if (total === 0) return null;

  const hasPriced = knownCount > 0;
  const hasUnpriced = unknownCount > 0;

  // The visible amount: real dollars when we have any priced image, em-dash
  // otherwise. The "+" suffix flags that the true total is *at least* this
  // value (some images haven't been priced).
  const amountLabel = hasPriced
    ? `${formatUSD(totalUSD)}${hasUnpriced ? "+" : ""}`
    : "—";

  const title = !hasPriced
    ? `Session: ${unknownCount} image${unknownCount === 1 ? "" : "s"} generated at a size not in the published pricing table — cost unknown. Add the size to src/lib/pricing.ts to track it.`
    : hasUnpriced
      ? `Session: at least ${formatUSD(totalUSD)} across ${total} image${total === 1 ? "" : "s"} (${knownCount} priced, ${unknownCount} at a custom size with no published rate).`
      : `Session: ${formatUSD(totalUSD)} across ${total} image${total === 1 ? "" : "s"}.`;

  return (
    <div
      className="inline-flex items-center gap-1.5 h-7 px-2 rounded-md bg-[var(--color-surface)] border border-[var(--color-border)] text-[11px]"
      title={title}
      aria-label={title}
    >
      <Coins className="size-3 text-[var(--color-muted)]" />
      <span
        className={
          "font-[family-name:var(--font-mono)] tabular-nums " +
          (hasPriced ? "text-[var(--color-fg-dim)]" : "text-[var(--color-muted)]")
        }
      >
        {amountLabel}
      </span>
      <span className="text-[var(--color-muted-dim)] tabular-nums">· {total}</span>
    </div>
  );
}
