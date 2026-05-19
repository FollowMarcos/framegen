import "server-only";
import { fal } from "@fal-ai/client";
import { resolveFalKey } from "./falKey";

let configured = false;
// Track the credential we configured the client with so we can detect
// when the user has rotated their key via the dashboard and reconfigure
// the SDK on the next call instead of holding onto a stale value.
let configuredCredential: string | null = null;

// Returns an SDK instance configured with the active fal credential.
//
// Lookup chain: `process.env.FAL_ADMIN_KEY` → `process.env.FAL_KEY`
// (legacy) → `.te-config.json` set via the dashboard. Throws a humane
// error pointing at both knobs if nothing resolves.
//
// Server-only by import barrier: `server-only` makes Next throw at
// build time if any client module reaches this file, so node:fs can't
// follow it into the browser bundle.
export async function getFal() {
  const credentials = await resolveFalKey();
  if (!credentials) {
    throw new Error(
      "FAL_ADMIN_KEY is not set. Add it to .env.local or paste it from the dashboard's API key card."
    );
  }
  if (!configured || configuredCredential !== credentials) {
    fal.config({ credentials });
    configured = true;
    configuredCredential = credentials;
  }
  return fal;
}
