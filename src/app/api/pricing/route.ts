import { NextResponse } from "next/server";
import { resolveFalKey } from "@/lib/falKey";

export const runtime = "nodejs";

// Lightweight server-side cache so we don't hit fal on every UI render.
// Keyed by endpoint id; entries expire after CACHE_TTL_MS.
type Entry = { price: PriceEntry; expiresAt: number };
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour
const cache = new Map<string, Entry>();

type PriceEntry = {
  endpoint_id: string;
  unit_price: number;
  unit: string;
  currency: string;
};

type FalPricingResponse = {
  next_cursor: string | null;
  has_more: boolean;
  prices: PriceEntry[];
};

async function key(): Promise<string | null> {
  const fk = await resolveFalKey();
  if (!fk) return null;
  return `Key ${fk}`;
}

// GET /api/pricing?endpoint_id=fal-ai/foo,fal-ai/bar
//
// Proxies to fal's pricing endpoint with simple in-memory caching. Returns
// the same response shape fal does. Missing FAL_KEY -> 500.
export async function GET(request: Request) {
  const auth = await key();
  if (!auth) return NextResponse.json({ error: "FAL_KEY not set" }, { status: 500 });

  const { searchParams } = new URL(request.url);
  const idsParam = searchParams.get("endpoint_id");
  if (!idsParam) {
    return NextResponse.json({ error: "endpoint_id required" }, { status: 400 });
  }
  const ids = idsParam.split(",").map((s) => s.trim()).filter(Boolean);
  if (ids.length === 0 || ids.length > 50) {
    return NextResponse.json({ error: "1–50 endpoint ids required" }, { status: 400 });
  }

  // Partition into cached + needs-fetch.
  const now = Date.now();
  const cached: PriceEntry[] = [];
  const missing: string[] = [];
  for (const id of ids) {
    const hit = cache.get(id);
    if (hit && hit.expiresAt > now) cached.push(hit.price);
    else missing.push(id);
  }

  let fresh: PriceEntry[] = [];
  if (missing.length > 0) {
    try {
      const url = new URL("https://api.fal.ai/v1/models/pricing");
      url.searchParams.set("endpoint_id", missing.join(","));
      const res = await fetch(url.toString(), {
        headers: { Authorization: auth, Accept: "application/json" },
        cache: "no-store",
      });
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        return NextResponse.json(
          { error: text || `fal pricing failed (${res.status})` },
          { status: res.status }
        );
      }
      const data = (await res.json()) as FalPricingResponse;
      fresh = data?.prices ?? [];
      // Write to cache.
      for (const p of fresh) {
        cache.set(p.endpoint_id, { price: p, expiresAt: now + CACHE_TTL_MS });
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "fal pricing failed";
      return NextResponse.json({ error: message }, { status: 502 });
    }
  }

  return NextResponse.json({ prices: [...cached, ...fresh] });
}
