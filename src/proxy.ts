import { NextResponse, type NextRequest } from "next/server";
import { verifySessionToken, AUTH_COOKIE } from "@/lib/auth";

const PUBLIC_PATHS = new Set(["/login", "/api/auth/login"]);

// In-memory sliding-window rate limiter. Two buckets:
//   - /api/auth/login        : brute-force protection on the password gate.
//   - /api/*  (anything else) : protects the fal-billed endpoints from runaway
//                                clients, scripted abuse, or a bypassed gate.
// The state is per-process; behind a load balancer it should be replaced with
// a shared store (Upstash, KV). For a single-instance self-host this is
// enough and costs nothing.
type Bucket = { limit: number; windowMs: number };
const LOGIN_BUCKET: Bucket = { limit: 10, windowMs: 10 * 60 * 1000 };
const API_BUCKET: Bucket = { limit: 60, windowMs: 60 * 1000 };
// Cap on tracked IPs so a flood of unique sources can't grow the map without
// bound. Oldest entries are dropped when the cap is hit.
const MAX_TRACKED_KEYS = 5000;

const hits = new Map<string, number[]>();

function clientIp(request: NextRequest): string {
  // Vercel + most proxies set x-forwarded-for. Fall back to x-real-ip then
  // a constant — Edge no longer exposes request.ip in Next 16.
  const xff = request.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0]?.trim() || "unknown";
  return request.headers.get("x-real-ip") || "unknown";
}

function rateLimited(key: string, bucket: Bucket): boolean {
  const now = Date.now();
  const cutoff = now - bucket.windowMs;
  const recent = (hits.get(key) ?? []).filter((t) => t > cutoff);
  if (recent.length >= bucket.limit) {
    hits.set(key, recent);
    return true;
  }
  recent.push(now);
  hits.set(key, recent);
  if (hits.size > MAX_TRACKED_KEYS) {
    // Drop the first inserted key (Map iterates in insertion order).
    const first = hits.keys().next().value;
    if (first !== undefined) hits.delete(first);
  }
  return false;
}

function tooManyRequests(): NextResponse {
  return withSecurityHeaders(
    NextResponse.json({ error: "too many requests" }, { status: 429 })
  );
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow static assets and Next internals
  if (
    pathname.startsWith("/_next/") ||
    pathname.startsWith("/favicon")
  ) {
    return withSecurityHeaders(NextResponse.next());
  }

  // Rate limits run before auth so an attacker can't burn unbounded CPU on
  // signature verification by spamming requests with junk cookies.
  if (pathname === "/api/auth/login") {
    if (rateLimited(`login:${clientIp(request)}`, LOGIN_BUCKET)) {
      return tooManyRequests();
    }
  } else if (pathname.startsWith("/api/")) {
    if (rateLimited(`api:${clientIp(request)}`, API_BUCKET)) {
      return tooManyRequests();
    }
  }

  if (pathname.startsWith("/api/auth/")) {
    return withSecurityHeaders(NextResponse.next());
  }

  // Auth is opt-in. If APP_PASSWORD is unset (or empty) the gate is bypassed
  // entirely — the app runs fully open. Useful for personal local-only use.
  // If anyone else can reach this server, set APP_PASSWORD.
  const passwordRequired = Boolean(process.env.APP_PASSWORD);

  if (!passwordRequired) {
    // Redirect /login → / so the login page isn't dangling when there's
    // nothing to log into.
    if (pathname === "/login") {
      return withSecurityHeaders(NextResponse.redirect(new URL("/", request.url)));
    }
    return withSecurityHeaders(NextResponse.next());
  }

  const token = request.cookies.get(AUTH_COOKIE.name)?.value;
  const authed = verifySessionToken(token);

  if (PUBLIC_PATHS.has(pathname)) {
    if (authed && pathname === "/login") {
      return withSecurityHeaders(NextResponse.redirect(new URL("/", request.url)));
    }
    return withSecurityHeaders(NextResponse.next());
  }

  if (!authed) {
    if (pathname.startsWith("/api/")) {
      return withSecurityHeaders(
        NextResponse.json({ error: "unauthorized" }, { status: 401 })
      );
    }
    const url = new URL("/login", request.url);
    url.searchParams.set("next", pathname);
    return withSecurityHeaders(NextResponse.redirect(url));
  }

  return withSecurityHeaders(NextResponse.next());
}

// Sources the editor + post composer reach to:
//   - jsdelivr (Twemoji SVGs — fallback while we're not yet vendoring)
//   - fal.media (generation outputs streamed back from the fal CDN)
// Plus self + data: URIs for things like Konva's toDataURL exports.
const CSP_VALUE = [
  "default-src 'self'",
  // Next + Tailwind ship inline styles; React 19 emits a couple of
  // inline script bootstrap hooks. 'unsafe-inline' here is the cost of
  // not running a nonce pipeline — fine for v1 local-first.
  "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://*.fal.media https://cdn.jsdelivr.net",
  "font-src 'self' data:",
  // /api/upload + /api/generate fetch the fal CDN server-side; the
  // browser never talks to fal directly. Keeping connect-src tight.
  "connect-src 'self'",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join("; ");

// Disable browser features the app doesn't use. Reduces the blast
// radius of an XSS that lands script execution inside the page.
const PERMISSIONS_POLICY = [
  "camera=()",
  "microphone=()",
  "geolocation=()",
  "payment=()",
  "usb=()",
  "interest-cohort=()",
].join(", ");

function withSecurityHeaders(response: NextResponse): NextResponse {
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set("X-XSS-Protection", "1; mode=block");
  response.headers.set("Content-Security-Policy", CSP_VALUE);
  response.headers.set("Permissions-Policy", PERMISSIONS_POLICY);
  // Strict-Transport-Security is the deployer's call — they may run
  // behind a reverse proxy that already sets it, or under plain HTTP
  // on the LAN. We don't force it here.
  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|mp4)$).*)",
  ],
};
