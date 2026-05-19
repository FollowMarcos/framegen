// Canonical build version surfaced in the studio header + dashboard. The
// version comes from package.json so we have a single source of truth
// (bump there, it's reflected everywhere). The build SHA is opt-in via a
// public env var so a CI step can pin a specific commit without changing
// any tracked files.
//
// Set NEXT_PUBLIC_BUILD_SHA at build time, e.g. in CI:
//   NEXT_PUBLIC_BUILD_SHA=$(git rev-parse --short HEAD) npm run build

import pkg from "../../package.json";

export const APP_NAME: string = pkg.name;
export const APP_VERSION: string = pkg.version;

// Truncated to short-SHA length so it's UI-friendly. Returns null in dev
// (where no one's pinning a build); the UI hides the SHA chip when null.
export const BUILD_SHA: string | null = (() => {
  const raw = process.env.NEXT_PUBLIC_BUILD_SHA;
  if (!raw) return null;
  const trimmed = raw.trim();
  return trimmed.length === 0 ? null : trimmed.slice(0, 12);
})();

// Convenience: a single display string like "v1.0.0" or "v1.0.0 · abc1234"
// for tooltips and copy-to-clipboard.
export function formatVersion(): string {
  return BUILD_SHA ? `v${APP_VERSION} · ${BUILD_SHA}` : `v${APP_VERSION}`;
}
