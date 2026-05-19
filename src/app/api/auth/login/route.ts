import { createHash, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { createSessionToken, AUTH_COOKIE } from "@/lib/auth";

export const runtime = "nodejs";

// Constant-time string compare. Hashing both sides first lets us call
// timingSafeEqual on equal-length buffers regardless of the inputs, so
// neither the password length nor a per-character mismatch leaks via timing.
function constantTimeEqual(a: string, b: string): boolean {
  const ha = createHash("sha256").update(a).digest();
  const hb = createHash("sha256").update(b).digest();
  return timingSafeEqual(ha, hb);
}

export async function POST(request: Request) {
  const { password } = (await request.json().catch(() => ({}))) as { password?: string };
  const expected = process.env.APP_PASSWORD;

  if (!expected) {
    // Auth is disabled entirely — the login page redirects to / via proxy.ts
    // but a stale tab might still POST here. Tell the client gracefully.
    return NextResponse.json({ error: "auth is disabled" }, { status: 400 });
  }

  if (typeof password !== "string" || !constantTimeEqual(password, expected)) {
    return NextResponse.json({ error: "invalid password" }, { status: 401 });
  }

  const token = createSessionToken();
  const response = NextResponse.json({ ok: true });
  response.cookies.set(AUTH_COOKIE.name, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: AUTH_COOKIE.maxAge,
  });
  return response;
}
