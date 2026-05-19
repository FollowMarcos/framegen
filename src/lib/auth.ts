import { createHmac, timingSafeEqual } from "node:crypto";

const COOKIE_NAME = "te_auth";
const MAX_AGE = 60 * 60 * 24 * 30; // 30 days

function getSecret(): string {
  const secret = process.env.AUTH_SECRET;
  if (!secret) {
    throw new Error("AUTH_SECRET is not set. Add it to .env.local");
  }
  return secret;
}

function sign(payload: string): string {
  return createHmac("sha256", getSecret()).update(payload).digest("hex");
}

export function createSessionToken(): string {
  const payload = String(Date.now());
  const signature = sign(payload);
  return `${payload}.${signature}`;
}

export function verifySessionToken(token: string | undefined | null): boolean {
  if (!token) return false;
  const [payload, signature] = token.split(".");
  if (!payload || !signature) return false;

  // Reject tokens whose timestamp is older than MAX_AGE. Without this a leaked
  // cookie stayed valid server-side forever — the browser's maxAge only stops
  // it from being *sent* by an honest client.
  const issuedAt = Number(payload);
  if (!Number.isFinite(issuedAt)) return false;
  const ageSeconds = (Date.now() - issuedAt) / 1000;
  if (ageSeconds < 0 || ageSeconds > MAX_AGE) return false;

  const expected = sign(payload);
  try {
    const a = Buffer.from(signature, "hex");
    const b = Buffer.from(expected, "hex");
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

export const AUTH_COOKIE = {
  name: COOKIE_NAME,
  maxAge: MAX_AGE,
};
