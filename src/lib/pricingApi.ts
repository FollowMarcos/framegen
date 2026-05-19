"use client";

// Client-side helper for /api/pricing and /api/pricing/estimate. Keeps a
// small per-tab cache to avoid redundant fetches when several components
// ask for the same model price within a session.

export type FalPrice = {
  endpoint_id: string;
  unit_price: number;
  unit: string; // "image" | "megapixel" | "second" | etc.
  currency: string; // "USD"
};

type Pending = Promise<FalPrice | null>;

const cache = new Map<string, FalPrice | null>();
const inflight = new Map<string, Pending>();

export async function fetchPrices(endpointIds: string[]): Promise<Map<string, FalPrice | null>> {
  const out = new Map<string, FalPrice | null>();
  const missing: string[] = [];

  for (const id of endpointIds) {
    if (cache.has(id)) {
      out.set(id, cache.get(id) ?? null);
    } else {
      missing.push(id);
    }
  }

  if (missing.length === 0) return out;

  // Coalesce parallel requests for the same ids.
  const promises = missing.map((id) => {
    if (inflight.has(id)) return inflight.get(id)!;
    const p = fetchOne(id);
    inflight.set(id, p);
    return p.finally(() => inflight.delete(id));
  });

  const results = await Promise.all(promises);
  missing.forEach((id, i) => {
    const r = results[i];
    cache.set(id, r);
    out.set(id, r);
  });
  return out;
}

async function fetchOne(endpointId: string): Promise<FalPrice | null> {
  try {
    const res = await fetch(`/api/pricing?endpoint_id=${encodeURIComponent(endpointId)}`);
    if (!res.ok) return null;
    const json = (await res.json()) as { prices?: FalPrice[] };
    return json.prices?.find((p) => p.endpoint_id === endpointId) ?? null;
  } catch {
    return null;
  }
}

// Cost estimate for a planned operation. `endpoints` is a map of fal model id
// to a unit quantity (e.g. number of megapixels for a megapixel-priced model,
// number of seconds for a per-second model, number of calls for the
// "historical_api_price" mode).
export type EstimateRequest =
  | {
      estimate_type: "historical_api_price";
      endpoints: Record<string, { call_quantity: number }>;
    }
  | {
      estimate_type: "unit_price";
      endpoints: Record<string, { unit_quantity: number }>;
    };

export type EstimateResponse = {
  estimate_type: string;
  total_cost: number;
  currency: string;
};

export async function estimateCost(req: EstimateRequest): Promise<EstimateResponse | null> {
  try {
    const res = await fetch("/api/pricing/estimate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(req),
    });
    if (!res.ok) return null;
    return (await res.json()) as EstimateResponse;
  } catch {
    return null;
  }
}

// Convenience: convert a FalPrice + unit-quantity into a USD cost.
export function applyPrice(
  price: FalPrice | null,
  unitQuantity: number
): number | null {
  if (!price) return null;
  return price.unit_price * unitQuantity;
}

// Per-image USD cost for an image-generation endpoint, given the requested
// output dimensions. Returns null for endpoints we can't project locally
// (per-second compute, unfamiliar units). Mirrors the per-row math in the
// ModelPicker so both UIs stay consistent.
export function perImageCostUSD(
  price: FalPrice | null,
  width: number,
  height: number
): number | null {
  if (!price) return null;
  if (price.unit === "image") return price.unit_price;
  if (price.unit === "megapixel") {
    return price.unit_price * ((width * height) / 1_000_000);
  }
  // Per-second and other unit kinds can't be predicted client-side.
  return null;
}

// Formats a USD value with sensible precision for tiny per-image prices.
export function formatUSD(usd: number): string {
  if (usd === 0) return "$0";
  if (usd < 0.01) return `$${usd.toFixed(4)}`;
  if (usd < 1) return `$${usd.toFixed(3)}`;
  return `$${usd.toFixed(2)}`;
}
