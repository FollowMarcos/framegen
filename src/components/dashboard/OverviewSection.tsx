"use client";

import { useEffect, useMemo, useState } from "react";
import { Info, RefreshCw, Wallet } from "lucide-react";
import { useBilling } from "@/lib/accountApi";
import { FalKeyCard } from "./FalKeyCard";
import { fetchPrices, type FalPrice } from "@/lib/pricingApi";
import { priceForImage, formatUSD } from "@/lib/pricing";
import { cn } from "@/lib/utils";
import type { StoredAsset } from "@/lib/storage";
import type { Project } from "@/lib/projects";

type StatRow = { label: string; count: number; cost?: number; costPartial?: boolean };

type DailyBucket = { dayKey: string; date: Date; count: number; cost: number };

type Stats = {
  totalCount: number;
  totalCostKnown: number;
  totalCostUnknownCount: number;
  byModel: StatRow[];
  byProject: StatRow[];
  byTag: StatRow[];
  // Activity windows for the headline cards: counts split into the current
  // 7/30-day window vs the prior matching window for delta arrows.
  last7Count: number;
  prev7Count: number;
  last30Count: number;
  prev30Count: number;
  // 14 daily buckets, oldest first — fuel for the chart.
  daily: DailyBucket[];
};

// Cost computed for one asset using whichever data source has it covered:
//   1) Live fal price (per-image or per-megapixel) — preferred when present.
//   2) Hardcoded GPT Image 2 pricing table — covers the 6 published sizes.
// Returns null when neither source can price the asset.
function costForAsset(
  asset: StoredAsset,
  livePrices: Map<string, FalPrice | null>
): number | null {
  const live = livePrices.get(asset.model);
  if (live && asset.width && asset.height) {
    if (live.unit === "image") return live.unit_price;
    if (live.unit === "megapixel") {
      const mp = (asset.width * asset.height) / 1_000_000;
      return live.unit_price * mp;
    }
  }
  const q = (asset.extras as Record<string, unknown> | undefined)?.quality;
  return priceForImage(asset.width, asset.height, typeof q === "string" ? q : undefined);
}

function dayKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function startOfDay(d: Date): Date {
  const out = new Date(d);
  out.setHours(0, 0, 0, 0);
  return out;
}

function computeStats(
  assets: StoredAsset[],
  projects: Project[],
  livePrices: Map<string, FalPrice | null>
): Stats {
  const totalCount = assets.length;
  let totalCostKnown = 0;
  let totalCostUnknownCount = 0;

  const modelCounts = new Map<string, number>();
  const modelCosts = new Map<string, number>();
  const modelMissing = new Map<string, number>();
  const projectCounts = new Map<string, number>();
  const tagCounts = new Map<string, number>();
  let unsortedCount = 0;

  // Sliding-window date math. We compare last-7 vs the 7 days before that,
  // and same for last-30, so the headline cards can show a delta arrow.
  const now = new Date();
  const sevenAgo = startOfDay(new Date(now.getTime() - 7 * 86400000));
  const fourteenAgo = startOfDay(new Date(now.getTime() - 14 * 86400000));
  const thirtyAgo = startOfDay(new Date(now.getTime() - 30 * 86400000));
  const sixtyAgo = startOfDay(new Date(now.getTime() - 60 * 86400000));

  let last7Count = 0;
  let prev7Count = 0;
  let last30Count = 0;
  let prev30Count = 0;

  // Pre-seed 14 daily buckets so days without any generations still render
  // (an empty bar is more honest than a phantom-shifted axis).
  const daily: DailyBucket[] = [];
  for (let i = 13; i >= 0; i--) {
    const d = startOfDay(new Date(now.getTime() - i * 86400000));
    daily.push({ dayKey: dayKey(d), date: d, count: 0, cost: 0 });
  }
  const dailyIndex = new Map(daily.map((b, i) => [b.dayKey, i]));

  for (const a of assets) {
    const c = costForAsset(a, livePrices);
    if (c === null) {
      totalCostUnknownCount += 1;
      modelMissing.set(a.model, (modelMissing.get(a.model) ?? 0) + 1);
    } else {
      totalCostKnown += c;
      modelCosts.set(a.model, (modelCosts.get(a.model) ?? 0) + c);
    }

    modelCounts.set(a.model, (modelCounts.get(a.model) ?? 0) + 1);

    if (a.projectId) {
      projectCounts.set(a.projectId, (projectCounts.get(a.projectId) ?? 0) + 1);
    } else {
      unsortedCount += 1;
    }

    for (const t of a.tags ?? []) {
      tagCounts.set(t, (tagCounts.get(t) ?? 0) + 1);
    }

    const created = new Date(a.createdAt);
    if (Number.isFinite(created.getTime())) {
      if (created >= sevenAgo) last7Count += 1;
      else if (created >= fourteenAgo) prev7Count += 1;
      if (created >= thirtyAgo) last30Count += 1;
      else if (created >= sixtyAgo) prev30Count += 1;
      const bIdx = dailyIndex.get(dayKey(startOfDay(created)));
      if (bIdx !== undefined) {
        daily[bIdx].count += 1;
        if (c !== null) daily[bIdx].cost += c;
      }
    }
  }

  const byModel: StatRow[] = [...modelCounts.entries()]
    .map(([model, count]) => ({
      label: model,
      count,
      cost: modelCosts.get(model) ?? 0,
      costPartial: (modelMissing.get(model) ?? 0) > 0,
    }))
    .sort((a, b) => b.count - a.count);

  const byProject: StatRow[] = [
    ...(unsortedCount > 0
      ? [{ label: "(unsorted)", count: unsortedCount } as StatRow]
      : []),
    ...projects
      .map((p) => ({
        label: p.name,
        count: projectCounts.get(p.id) ?? 0,
      }))
      .filter((r) => r.count > 0)
      .sort((a, b) => b.count - a.count),
  ];

  const byTag: StatRow[] = [...tagCounts.entries()]
    .map(([tag, count]) => ({ label: `#${tag}`, count }))
    .sort((a, b) => b.count - a.count);

  return {
    totalCount,
    totalCostKnown,
    totalCostUnknownCount,
    byModel,
    byProject,
    byTag,
    last7Count,
    prev7Count,
    last30Count,
    prev30Count,
    daily,
  };
}

function greetingForHour(hour: number): string {
  if (hour < 5) return "Up late";
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

export function OverviewSection({
  assets,
  projects,
}: {
  assets: StoredAsset[];
  projects: Project[];
}) {
  // Fetch live fal pricing for every distinct model in the library so the
  // per-model breakdown shows real cost when fal has published it.
  const distinctModels = useMemo(
    () => Array.from(new Set(assets.map((a) => a.model))),
    [assets]
  );
  const [livePrices, setLivePrices] = useState<Map<string, FalPrice | null>>(new Map());
  useEffect(() => {
    if (distinctModels.length === 0) return;
    let cancelled = false;
    fetchPrices(distinctModels).then((m) => {
      if (!cancelled) setLivePrices(m);
    });
    return () => {
      cancelled = true;
    };
  }, [distinctModels]);

  const stats = useMemo(
    () => computeStats(assets, projects, livePrices),
    [assets, projects, livePrices]
  );

  // Render-time greeting; recomputed on each render so navigating away and
  // back picks up the new period without a manual refresh.
  const greeting = greetingForHour(new Date().getHours());

  // Cost split into the last 30 days for the headline "this month" card —
  // a more useful number than all-time spend for ongoing decisions.
  const last30Cost = useMemo(() => {
    const cutoff = Date.now() - 30 * 86400000;
    let total = 0;
    for (const a of assets) {
      if (new Date(a.createdAt).getTime() < cutoff) continue;
      const c = costForAsset(a, livePrices);
      if (c !== null) total += c;
    }
    return total;
  }, [assets, livePrices]);

  return (
    <div className="space-y-8">
      <Greeting greeting={greeting} totalCount={stats.totalCount} />

      <FalKeyCard />

      <AccountCredits />

      <section>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <StatCard
            label="Generations · all time"
            value={String(stats.totalCount)}
            delta={diff(stats.last7Count, stats.prev7Count)}
            deltaSuffix="vs prev week"
          />
          <StatCard
            label="Last 7 days"
            value={String(stats.last7Count)}
            delta={diff(stats.last7Count, stats.prev7Count)}
            deltaSuffix="vs prev week"
          />
          <StatCard
            label="Spend · last 30 days"
            value={formatUSD(last30Cost)}
            hint={stats.totalCostUnknownCount > 0 ? `${stats.totalCostUnknownCount} unpriced` : "priced sizes only"}
          />
          <StatCard
            label="Distinct models"
            value={String(stats.byModel.length)}
            hint={`${stats.byTag.length} tag${stats.byTag.length === 1 ? "" : "s"}`}
          />
        </div>
      </section>

      <ActivityChart daily={stats.daily} />

      <BreakdownSection title="By model" rows={stats.byModel} />
      <BreakdownSection title="By project" rows={stats.byProject} />
      <BreakdownSection title="By tag" rows={stats.byTag} emptyHint="No tags used yet." />
    </div>
  );
}

function diff(curr: number, prev: number): number {
  return curr - prev;
}

function Greeting({
  greeting,
  totalCount,
}: {
  greeting: string;
  totalCount: number;
}) {
  return (
    <header className="space-y-2">
      <div className="flex items-center gap-2 text-[11px] text-[var(--color-muted)] font-mono uppercase tracking-[0.08em]">
        <span className="size-1.5 rounded-full bg-[var(--color-accent)]" aria-hidden />
        Dashboard
        <span className="text-[var(--color-muted-dim)]">·</span>
        <span className="tabular-nums">
          {totalCount} generation{totalCount === 1 ? "" : "s"}
        </span>
      </div>
      <h1 className="text-[34px] sm:text-[40px] font-semibold tracking-[-0.02em] text-[var(--color-fg)] leading-none">
        {greeting}
      </h1>
    </header>
  );
}

function AccountCredits() {
  const { billing, error, loading, refresh } = useBilling();
  const credits = billing?.credits;

  // Surface a friendly explanation for the most common cause (403 = no
  // ADMIN-scope key set) so users don't think the feature is broken.
  if (!loading && !credits && error?.kind === "forbidden") {
    return <AccountCreditsForbidden />;
  }

  // Other failure modes or pre-fetch: render nothing (the chip elsewhere
  // handles the loading state).
  if (!loading && !credits) return null;

  const balance = credits?.current_balance ?? 0;
  const currency = credits?.currency ?? "USD";
  const sign = currency === "USD" ? "$" : "";
  const formatted = balance < 0.01 ? balance.toFixed(4) : balance.toFixed(2);
  const low = balance < 1;

  return (
    <section
      className={cn(
        "rounded-xl border p-4 flex items-start gap-4",
        low
          ? "border-yellow-500/30 bg-yellow-500/5"
          : "border-[var(--color-border)] bg-gradient-to-br from-[var(--color-surface)] to-[var(--color-bg-elevated)]"
      )}
    >
      <div
        className={cn(
          "size-10 rounded-md grid place-items-center shrink-0",
          low
            ? "bg-yellow-500/15 text-yellow-400"
            : "bg-[var(--color-accent-dim)] text-[var(--color-accent)]"
        )}
      >
        <Wallet className="size-4" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2 flex-wrap">
          <div className="text-[10px] uppercase tracking-[0.08em] font-semibold text-[var(--color-muted)]">
            fal account credits
          </div>
          {billing?.username && (
            <div className="text-[10px] font-mono text-[var(--color-muted-dim)]">
              {billing.username}
            </div>
          )}
        </div>
        <div className="mt-1 text-[24px] font-semibold tabular-nums tracking-tight text-[var(--color-fg)]">
          {loading ? "…" : `${sign}${formatted}`}
        </div>
        {low && !loading && (
          <p className="mt-1 text-[11px] text-yellow-400">
            Low balance — top up to keep generating.
          </p>
        )}
      </div>
      <button
        type="button"
        onClick={refresh}
        disabled={loading}
        className="size-7 rounded-md grid place-items-center text-[var(--color-muted)] hover:text-[var(--color-fg)] hover:bg-[var(--color-surface-hover)] disabled:opacity-40 transition"
        title="refresh"
        aria-label="refresh"
      >
        <RefreshCw className={cn("size-3.5", loading && "animate-spin")} />
      </button>
    </section>
  );
}

function AccountCreditsForbidden() {
  return (
    <section className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 flex items-start gap-4">
      <div className="size-9 rounded-md grid place-items-center shrink-0 bg-[var(--color-bg-elevated)] text-[var(--color-muted)]">
        <Info className="size-4" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-[10px] uppercase tracking-[0.08em] font-semibold text-[var(--color-muted)]">
          fal account credits
        </div>
        <p className="mt-1 text-[12.5px] text-[var(--color-fg-dim)] leading-relaxed">
          Your key doesn&apos;t have the <strong>Admin</strong> scope required to read the
          billing endpoint. Fix:
        </p>
        <ol className="mt-2 text-[12.5px] text-[var(--color-fg-dim)] leading-relaxed list-decimal pl-5 space-y-1">
          <li>
            Create an <strong>Admin</strong>-scope key at{" "}
            <a
              href="https://fal.ai/dashboard/keys"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[var(--color-accent)] hover:text-[var(--color-accent-hover)] transition"
            >
              fal.ai/dashboard/keys
            </a>
            .
          </li>
          <li>
            Set it as <code className="font-mono text-[11.5px]">FAL_ADMIN_KEY</code> in{" "}
            <code className="font-mono text-[11.5px]">.env.local</code> and restart{" "}
            <code className="font-mono text-[11.5px]">npm run dev</code>.
          </li>
        </ol>
      </div>
    </section>
  );
}

function StatCard({
  label,
  value,
  hint,
  delta,
  deltaSuffix,
}: {
  label: string;
  value: string;
  hint?: string;
  delta?: number;
  deltaSuffix?: string;
}) {
  // Subtle radial gradient inside the card mimics the screenshot's depth —
  // a hint of lift in the top-left, dimming toward the bottom-right. Pure
  // CSS; no images.
  return (
    <div className="relative rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 overflow-hidden">
      <div
        aria-hidden
        className="absolute inset-0 pointer-events-none opacity-60"
        style={{
          background:
            "radial-gradient(120% 90% at 0% 0%, rgba(255,255,255,0.04), transparent 60%)",
        }}
      />
      <div className="relative">
        <div className="text-[11px] font-mono uppercase tracking-[0.06em] text-[var(--color-muted)]">
          {label}
        </div>
        <div className="mt-2 text-[34px] font-semibold tracking-tight text-[var(--color-fg)] tabular-nums leading-none">
          {value}
        </div>
        {(delta !== undefined || hint) && (
          <div className="mt-3 flex items-baseline gap-1.5 text-[11px] font-mono tabular-nums">
            {delta !== undefined && (
              <span
                className={cn(
                  delta > 0
                    ? "text-[var(--color-success)]"
                    : delta < 0
                      ? "text-[var(--color-danger)]"
                      : "text-[var(--color-muted)]"
                )}
              >
                {delta > 0 ? "+" : ""}
                {delta}
              </span>
            )}
            {(delta !== undefined ? deltaSuffix : hint) && (
              <span className="text-[var(--color-muted)]">
                {delta !== undefined ? deltaSuffix : hint}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function ActivityChart({ daily }: { daily: DailyBucket[] }) {
  const max = Math.max(1, ...daily.map((b) => b.count));
  const total = daily.reduce((acc, b) => acc + b.count, 0);
  const todayKey = daily[daily.length - 1]?.dayKey;
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);

  if (total === 0) {
    return (
      <section className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6 text-center">
        <div className="text-[11px] font-mono uppercase tracking-[0.06em] text-[var(--color-muted)] mb-1">
          Activity
        </div>
        <p className="text-[13px] text-[var(--color-fg-dim)]">
          No generations in the last 14 days yet.
        </p>
      </section>
    );
  }

  return (
    <section className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 sm:p-5">
      <div className="flex items-baseline justify-between mb-4">
        <div>
          <div className="text-[11px] font-mono uppercase tracking-[0.06em] text-[var(--color-muted)]">
            Activity · last 14 days
          </div>
          <div className="mt-1 text-[24px] font-semibold tracking-tight text-[var(--color-fg)] tabular-nums leading-none">
            {total} generation{total === 1 ? "" : "s"}
          </div>
        </div>
        {hoverIdx !== null && (
          <HoverTooltip
            bucket={daily[hoverIdx]!}
            isToday={daily[hoverIdx]!.dayKey === todayKey}
          />
        )}
      </div>

      <div className="relative h-44 flex items-end gap-1.5 sm:gap-2">
        {daily.map((b, i) => {
          const isToday = b.dayKey === todayKey;
          const isHover = hoverIdx === i;
          const heightPct = (b.count / max) * 100;
          return (
            <button
              type="button"
              key={b.dayKey}
              onMouseEnter={() => setHoverIdx(i)}
              onMouseLeave={() =>
                setHoverIdx((curr) => (curr === i ? null : curr))
              }
              onFocus={() => setHoverIdx(i)}
              onBlur={() => setHoverIdx(null)}
              className="group relative flex-1 min-w-0 h-full flex flex-col justify-end items-stretch"
              aria-label={`${b.date.toLocaleDateString()} · ${b.count} generation${b.count === 1 ? "" : "s"}`}
            >
              <div
                className={cn(
                  "w-full rounded-t-md transition-all min-h-[2px]",
                  isToday
                    ? "bg-gradient-to-t from-[var(--color-accent)]/70 to-[var(--color-accent)] shadow-[0_0_24px_-4px_var(--color-accent)]"
                    : isHover
                      ? "bg-[var(--color-border-strong)]"
                      : "bg-[var(--color-bg-elevated)] border border-[var(--color-border)]"
                )}
                style={{ height: `${Math.max(heightPct, b.count > 0 ? 4 : 0)}%` }}
              />
            </button>
          );
        })}
      </div>

      <div className="mt-2 flex justify-between text-[10px] font-mono text-[var(--color-muted)] tabular-nums">
        {daily.map((b, i) => (
          <span
            key={b.dayKey}
            className={cn(
              "flex-1 text-center",
              b.dayKey === todayKey && "text-[var(--color-accent)]",
              // Drop most labels on narrow widths — keep first, middle,
              // last — so the axis doesn't fight the bar widths.
              i !== 0 && i !== Math.floor(daily.length / 2) && i !== daily.length - 1
                ? "hidden sm:inline"
                : ""
            )}
          >
            {b.date.toLocaleDateString(undefined, { month: "short", day: "numeric" })}
          </span>
        ))}
      </div>
    </section>
  );
}

function HoverTooltip({
  bucket,
  isToday,
}: {
  bucket: DailyBucket;
  isToday: boolean;
}) {
  return (
    <div className="text-right">
      <div className="text-[10px] font-mono uppercase tracking-[0.06em] text-[var(--color-muted)]">
        {isToday ? "Today" : bucket.date.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}
      </div>
      <div className="text-[15px] font-semibold tabular-nums text-[var(--color-fg)]">
        {bucket.count} <span className="text-[11px] font-normal text-[var(--color-muted)]">image{bucket.count === 1 ? "" : "s"}</span>
      </div>
      {bucket.cost > 0 && (
        <div className="text-[10px] font-mono text-[var(--color-muted)] tabular-nums">
          {formatUSD(bucket.cost)}
        </div>
      )}
    </div>
  );
}

function BreakdownSection({
  title,
  rows,
  emptyHint,
}: {
  title: string;
  rows: StatRow[];
  emptyHint?: string;
}) {
  if (rows.length === 0) {
    if (!emptyHint) return null;
    return (
      <section>
        <h2 className="text-[10px] uppercase tracking-[0.08em] font-semibold text-[var(--color-muted)] mb-2">
          {title}
        </h2>
        <p className="text-[11px] text-[var(--color-muted)]">{emptyHint}</p>
      </section>
    );
  }
  const hasCosts = rows.some((r) => r.cost !== undefined);
  const max = Math.max(...rows.map((r) => r.count));
  return (
    <section>
      <h2 className="text-[10px] uppercase tracking-[0.08em] font-semibold text-[var(--color-muted)] mb-2">
        {title}
      </h2>
      <ul className="space-y-1">
        {rows.map((r) => (
          <li key={r.label} className="flex items-center gap-2 text-[12px]">
            <div className="w-40 truncate text-[var(--color-fg-dim)] font-mono text-[11px]" title={r.label}>
              {r.label}
            </div>
            <div className="flex-1 h-1.5 rounded-full bg-[var(--color-bg-elevated)] overflow-hidden">
              <div
                className="h-full bg-[var(--color-accent)]"
                style={{ width: `${(r.count / max) * 100}%` }}
              />
            </div>
            <div className="w-10 text-right font-mono tabular-nums text-[var(--color-muted)]">
              {r.count}
            </div>
            {hasCosts && (
              <div
                className="w-20 text-right font-mono tabular-nums text-[var(--color-fg-dim)] text-[11px]"
                title={r.costPartial ? "some assets at unpriced sizes — total is a lower bound" : undefined}
              >
                {r.cost !== undefined ? formatUSD(r.cost) : "—"}
                {r.costPartial && <span className="text-[var(--color-accent)] ml-0.5">+</span>}
              </div>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
