"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Wallet } from "lucide-react";
import { cn } from "@/lib/utils";
import { useBilling } from "@/lib/accountApi";

// Small chip showing the account's remaining credits. Hidden silently when
// the billing endpoint is unavailable (e.g. a non-admin key) so users with
// scoped keys don't see a broken UI.
//
// Stickiness: once we've shown a real balance, we keep showing it across
// any subsequent failed refresh — the hook can return a momentarily-empty
// state without making the chip disappear and reappear.
export function CreditBalance() {
  const { billing, loading } = useBilling();
  const stickyRef = useRef<NonNullable<typeof billing> | null>(null);
  const [, force] = useState(0);

  // Promote any new "with credits" billing to the sticky slot.
  useEffect(() => {
    if (billing?.credits) {
      stickyRef.current = billing;
      force((n) => n + 1);
    }
  }, [billing]);

  const display = billing?.credits ? billing : stickyRef.current;
  const credits = display?.credits;

  const formatted = useMemo(() => {
    if (!credits) return null;
    const v = credits.current_balance;
    const sign = credits.currency === "USD" ? "$" : "";
    if (v < 0.01) return `${sign}${v.toFixed(4)}`;
    return `${sign}${v.toFixed(2)}`;
  }, [credits]);

  if (!credits && !loading) return null;

  const low = credits ? credits.current_balance < 1 : false;
  const tone = low ? "text-yellow-400" : "text-[var(--color-fg-dim)]";

  return (
    <div
      className="inline-flex items-center gap-1.5 h-7 px-2 rounded-md bg-[var(--color-surface)] border border-[var(--color-border)] text-[11px]"
      title={
        loading
          ? "loading credits…"
          : credits
            ? `Account credits: ${formatted}${low ? " (low)" : ""}`
            : ""
      }
    >
      <Wallet className={cn("size-3", low ? "text-yellow-400" : "text-[var(--color-muted)]")} />
      {loading ? (
        <span className="text-[var(--color-muted-dim)] font-mono">…</span>
      ) : (
        <span className={cn("font-[family-name:var(--font-mono)] tabular-nums", tone)}>
          {formatted}
        </span>
      )}
    </div>
  );
}
