import { NextResponse } from "next/server";
import {
  clearFalKey,
  getFalKeyStatus,
  isPlausibleFalKey,
  setFalKey,
} from "@/lib/falKey";

export const runtime = "nodejs";

// GET /api/account/fal-key
//
// Returns whether a key is active and *where it came from* (env vs the
// dashboard file vs nothing). Never returns the full key — only a
// last-4 hint so the user can verify which key they pasted. There is
// no API path that surfaces the secret, by design.
export async function GET() {
  const status = await getFalKeyStatus();
  return NextResponse.json(status);
}

// POST /api/account/fal-key  { key: string, test?: boolean }
//
// Writes the supplied key to ./.te-config.json (never to public/).
// When `test: true` (the dashboard's "Test & save" path) we hit fal's
// /v1/account/billing first so the user gets a tight error loop on a
// typo instead of saving garbage and discovering it later.
//
// Note: the env var still wins on read — POSTing while FAL_ADMIN_KEY
// is set in the environment is allowed (it writes the file) but the
// active key won't change until the env var is removed. The response
// includes the resolved status so the UI can show that warning.
export async function POST(request: Request) {
  let body: { key?: unknown; test?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }

  const key = typeof body.key === "string" ? body.key.trim() : "";
  if (!key) {
    return NextResponse.json({ error: "key required" }, { status: 400 });
  }
  if (!isPlausibleFalKey(key)) {
    return NextResponse.json(
      {
        error:
          "key doesn't match the expected fal Admin format (<key-id>:<secret>)",
      },
      { status: 400 }
    );
  }

  // Optional live verification. We use the billing endpoint because it
  // requires Admin scope — passing the test guarantees the key works
  // for both inference and billing calls.
  if (body.test) {
    try {
      const res = await fetch(
        "https://api.fal.ai/v1/account/billing?expand=credits",
        {
          headers: { Authorization: `Key ${key}`, Accept: "application/json" },
          cache: "no-store",
        }
      );
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        return NextResponse.json(
          {
            error:
              res.status === 403
                ? "key works but lacks Admin scope (needed for billing endpoints)"
                : text || `fal rejected the key (${res.status})`,
          },
          { status: res.status === 403 ? 400 : 502 }
        );
      }
    } catch (err) {
      return NextResponse.json(
        {
          error:
            err instanceof Error
              ? `couldn't reach fal: ${err.message}`
              : "couldn't reach fal",
        },
        { status: 502 }
      );
    }
  }

  await setFalKey(key);
  const status = await getFalKeyStatus();
  return NextResponse.json({ ok: true, status });
}

// DELETE /api/account/fal-key
//
// Removes the UI-stored key. If FAL_ADMIN_KEY is set in the
// environment the app keeps working off that; otherwise the next
// request will fail with the usual "not set" error.
export async function DELETE() {
  await clearFalKey();
  const status = await getFalKeyStatus();
  return NextResponse.json({ ok: true, status });
}
