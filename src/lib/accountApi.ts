"use client";

import { useEffect, useState } from "react";

export type Billing = {
  username?: string;
  credits?: { current_balance: number; currency: string };
};

export type BillingError =
  | { kind: "forbidden" } // scope/permission issue (most common)
  | { kind: "other"; status: number; message: string };

// Module-scoped cache + inflight tracker so the chip and the dashboard
// don't both trigger a fetch at the same time.
let cached: Billing | null = null;
let cachedExpires = 0;
let cachedError: BillingError | null = null;
let inflight: Promise<{
  data: Billing | null;
  error: BillingError | null;
}> | null = null;

async function fetchBilling(
  force = false
): Promise<{ data: Billing | null; error: BillingError | null }> {
  const now = Date.now();
  if (!force && cached && cachedExpires > now) {
    return { data: cached, error: cachedError };
  }
  if (inflight) return inflight;

  inflight = (async () => {
    try {
      const res = await fetch("/api/account/billing", { cache: "no-store" });
      if (!res.ok) {
        if (res.status === 403) {
          cachedError = { kind: "forbidden" };
          cachedExpires = Date.now() + 5 * 60_000; // remember the 403 for 5 min
          return { data: cached, error: cachedError };
        }
        // Other transient errors (rate limit, network blip, 5xx). Keep
        // the last known good value if we have one; surface a message
        // otherwise.
        return {
          data: cached,
          error: { kind: "other", status: res.status, message: `fal billing ${res.status}` },
        };
      }
      const json = (await res.json()) as Billing;
      if (json?.credits && typeof json.credits.current_balance === "number") {
        cached = json;
        cachedError = null;
        cachedExpires = Date.now() + 60_000;
        return { data: json, error: null };
      }
      // 200 OK but no credits field — keep showing the last known value.
      return { data: cached, error: cachedError };
    } catch (e) {
      return {
        data: cached,
        error: { kind: "other", status: 0, message: e instanceof Error ? e.message : "network error" },
      };
    } finally {
      inflight = null;
    }
  })();

  return inflight;
}

export type BillingState = {
  billing: Billing | null;
  error: BillingError | null;
  loading: boolean;
  refresh: () => Promise<void>;
};

export function useBilling(): BillingState {
  // Deterministic initial state — never read the module-scoped cache
  // from useState initializers. In a Node dev server the cache
  // persists across SSR renders, so a populated `cached` would make
  // the server render different markup than the client's first paint
  // and trip React's hydration diff. We seed from cache inside the
  // effect instead.
  const [billing, setBilling] = useState<Billing | null>(null);
  const [error, setError] = useState<BillingError | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  const load = async (force: boolean) => {
    setLoading(true);
    const { data, error: err } = await fetchBilling(force);
    if (data) setBilling(data);
    setError(err);
    setLoading(false);
  };

  useEffect(() => {
    // Hydrate from the module cache on mount so a second component
    // that mounts later doesn't refetch unnecessarily.
    if (cached) setBilling(cached);
    if (cachedError) setError(cachedError);
    if (cached || cachedError) setLoading(false);

    load(false);
    function onFocus() {
      load(true);
    }
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, []);

  return {
    billing,
    error,
    loading,
    refresh: () => load(true),
  };
}
