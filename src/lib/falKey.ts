import { promises as fs } from "node:fs";
import path from "node:path";

// Server-side persistence for the fal Admin key when set via the
// dashboard rather than .env.local.
//
// Location is deliberate: a plain JSON file at the project root, *outside*
// `public/` and behind the auth gate. The Next.js static handler can't
// reach files at the project root, so the key cannot accidentally leak
// to the browser via a wrongly-typed asset URL.
//
// Stays single-key by design — the app is single-user local-first. If
// future-you ever introduces real multi-tenant accounts, this file gets
// replaced with a per-user table, not extended.

const CONFIG_PATH = path.join(process.cwd(), ".te-config.json");

type ConfigShape = {
  falAdminKey?: string;
};

async function readConfig(): Promise<ConfigShape> {
  try {
    const raw = await fs.readFile(CONFIG_PATH, "utf-8");
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? (parsed as ConfigShape) : {};
  } catch (err) {
    // ENOENT (no config yet) is the common case — silent. Anything else
    // we also swallow because callers fall back to env vars; treating a
    // corrupt file as "no key set" is the right failure mode rather
    // than crashing the whole app.
    if (
      err &&
      typeof err === "object" &&
      "code" in err &&
      (err as NodeJS.ErrnoException).code !== "ENOENT"
    ) {
      // Swallow other read errors too — same reasoning.
    }
    return {};
  }
}

async function writeConfig(next: ConfigShape): Promise<void> {
  // Write with mode 0o600 (owner-only) so the secret isn't readable by
  // other users on a shared machine. node's fs.writeFile honours this
  // on POSIX; on Windows it's a soft hint but doesn't hurt.
  await fs.writeFile(CONFIG_PATH, JSON.stringify(next, null, 2), {
    encoding: "utf-8",
    mode: 0o600,
  });
}

// Where the active key is coming from, surfaced in the dashboard so the
// user can tell whether their UI-pasted value is in effect.
export type FalKeySource = "env" | "file" | "none";

export type FalKeyStatus = {
  source: FalKeySource;
  // Last 4 chars of the active key, prefixed with "…". Null when no
  // key is set. Deliberately not the full key — there is no API path
  // that returns the full value once it's been stored.
  maskedHint: string | null;
};

function mask(key: string): string {
  const tail = key.length >= 4 ? key.slice(-4) : key;
  return `…${tail}`;
}

// Resolves the active key with the same precedence the rest of the app
// expects: env wins (Docker / CI determinism), file is the UI fallback.
export async function resolveFalKey(): Promise<string | null> {
  const fromEnv = process.env.FAL_ADMIN_KEY || process.env.FAL_KEY;
  if (fromEnv && fromEnv.trim()) return fromEnv.trim();
  const cfg = await readConfig();
  if (cfg.falAdminKey && cfg.falAdminKey.trim()) {
    return cfg.falAdminKey.trim();
  }
  return null;
}

export async function getFalKeyStatus(): Promise<FalKeyStatus> {
  const fromEnv = process.env.FAL_ADMIN_KEY || process.env.FAL_KEY;
  if (fromEnv && fromEnv.trim()) {
    return { source: "env", maskedHint: mask(fromEnv.trim()) };
  }
  const cfg = await readConfig();
  if (cfg.falAdminKey && cfg.falAdminKey.trim()) {
    return { source: "file", maskedHint: mask(cfg.falAdminKey.trim()) };
  }
  return { source: "none", maskedHint: null };
}

export async function setFalKey(key: string): Promise<void> {
  const trimmed = key.trim();
  if (!isPlausibleFalKey(trimmed)) {
    throw new Error("invalid key format");
  }
  const cfg = await readConfig();
  cfg.falAdminKey = trimmed;
  await writeConfig(cfg);
}

export async function clearFalKey(): Promise<void> {
  const cfg = await readConfig();
  delete cfg.falAdminKey;
  await writeConfig(cfg);
}

// Cheap structural sanity check before we hit the network. fal Admin
// keys look like `<uuid>:<hex>` (a key id, a colon, a long secret).
// Rejecting obviously-wrong input here gives the user a tighter error
// loop than a 401 from the upstream test call.
export function isPlausibleFalKey(key: string): boolean {
  return /^[A-Za-z0-9-]{6,}:[A-Za-z0-9]{16,}$/.test(key);
}
