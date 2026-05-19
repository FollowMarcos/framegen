// Server-side guard for fal model ids accepted from the client. The studio
// panel and upscale modal let the operator register custom models in
// localStorage, but the server can't see localStorage — so the only choices
// for the inference routes are (a) trust whatever id the client sends, or
// (b) match against a curated allowlist.
//
// We do both, depending on environment:
//   - Built-in model ids (the ones shipped in code) are always accepted.
//   - Arbitrary fal-ai/* ids are accepted only when ALLOW_CUSTOM_FAL_MODELS=true.
//     This is opt-in so that, if someone bypasses the password gate, they
//     can't invoke arbitrary expensive models on your account by default.
//
// Operators who use the custom-model feature locally should set
// ALLOW_CUSTOM_FAL_MODELS=true in their .env.local.

import { MODELS } from "@/lib/fal";
import { UPSCALE_MODELS } from "@/lib/upscaleModels";

// Match fal model paths only. Vendors live in a small set of namespaces;
// rejecting anything else makes typos and SSRF-style inputs fail loudly.
// Paths can nest several segments deep (e.g. ByteDance Seedream lives at
// `fal-ai/bytedance/seedream/v4.5/text-to-image`) and segments can contain
// dots for version numbers ("v4.5"), so the regex allows multiple
// subpath segments and `.` in addition to letters / digits / hyphens.
const MODEL_PATH_RE = /^(fal-ai|openai|stability-ai|google|meta|black-forest-labs|bytedance)\/[a-z0-9][a-z0-9-]*(\/[a-z0-9.-]+)*$/;

// Enumerate every value of MODELS so new generation-model entries (e.g.
// the Nano Banana variants) are auto-allowlisted without a second edit.
const BUILT_IN_IDS: ReadonlySet<string> = new Set<string>([
  ...Object.values(MODELS),
  ...UPSCALE_MODELS.map((m) => m.id),
]);

export function isAllowedModelId(id: string): boolean {
  if (typeof id !== "string" || id.length === 0 || id.length > 200) return false;
  if (BUILT_IN_IDS.has(id)) return true;
  if (!MODEL_PATH_RE.test(id)) return false;
  return process.env.ALLOW_CUSTOM_FAL_MODELS === "true";
}
