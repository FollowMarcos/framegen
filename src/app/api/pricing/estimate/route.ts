import { NextResponse } from "next/server";
import { resolveFalKey } from "@/lib/falKey";

export const runtime = "nodejs";

type Body =
  | {
      estimate_type: "historical_api_price";
      endpoints: Record<string, { call_quantity: number }>;
    }
  | {
      estimate_type: "unit_price";
      endpoints: Record<string, { unit_quantity: number }>;
    };

// POST /api/pricing/estimate
//
// Thin proxy over fal's estimate endpoint. Body shapes match fal's docs:
//   { estimate_type: "historical_api_price", endpoints: { "fal-ai/x": { call_quantity: 100 } } }
//   { estimate_type: "unit_price",          endpoints: { "fal-ai/x": { unit_quantity: 1 } } }
export async function POST(request: Request) {
  const fk = await resolveFalKey();
  if (!fk) return NextResponse.json({ error: "FAL_ADMIN_KEY not set" }, { status: 500 });

  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }

  if (
    body.estimate_type !== "historical_api_price" &&
    body.estimate_type !== "unit_price"
  ) {
    return NextResponse.json({ error: "invalid estimate_type" }, { status: 400 });
  }
  if (!body.endpoints || typeof body.endpoints !== "object") {
    return NextResponse.json({ error: "endpoints required" }, { status: 400 });
  }

  try {
    const res = await fetch("https://api.fal.ai/v1/models/pricing/estimate", {
      method: "POST",
      headers: {
        Authorization: `Key ${fk}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(body),
      cache: "no-store",
    });
    const text = await res.text();
    if (!res.ok) {
      return NextResponse.json({ error: text || `fal estimate failed (${res.status})` }, { status: res.status });
    }
    return new NextResponse(text, {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "fal estimate failed";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
