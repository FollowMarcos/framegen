import { NextResponse } from "next/server";
import { resolveFalKey } from "@/lib/falKey";

export const runtime = "nodejs";

// Short server-side cache so a tab that polls every focus event doesn't
// hammer fal. Billing changes infrequently; 60s feels live enough.
const CACHE_TTL_MS = 60 * 1000;
let cached: { data: BillingResponse; expiresAt: number } | null = null;

type BillingResponse = {
  username?: string;
  credits?: { current_balance: number; currency: string };
};

// GET /api/account/billing
//
// Returns fal's billing payload (with credits expanded). The key must
// have Admin scope — API-scope keys 403 on this endpoint. We try
// FAL_ADMIN_KEY first (the canonical var), then FAL_KEY as a legacy
// fallback. Either can hold the Admin key.
export async function GET() {
  const fk = await resolveFalKey();
  if (!fk) return NextResponse.json({ error: "FAL_ADMIN_KEY not set" }, { status: 500 });

  const now = Date.now();
  if (cached && cached.expiresAt > now) {
    return NextResponse.json(cached.data);
  }

  try {
    const res = await fetch("https://api.fal.ai/v1/account/billing?expand=credits", {
      headers: { Authorization: `Key ${fk}`, Accept: "application/json" },
      cache: "no-store",
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      return NextResponse.json(
        { error: text || `fal billing failed (${res.status})` },
        { status: res.status }
      );
    }
    const data = (await res.json()) as BillingResponse;
    cached = { data, expiresAt: now + CACHE_TTL_MS };
    return NextResponse.json(data);
  } catch (err) {
    const message = err instanceof Error ? err.message : "fal billing failed";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
