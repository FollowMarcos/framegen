// Client-safe exports for the fal integration: the model registry +
// shared input/output types. Both API routes and client components
// pull from this file, so it intentionally avoids any server-only
// dependency (node:fs / node:path / process.env reads).
//
// The SDK accessor `getFal()` lives in `falServer.ts` so that
// importing it can't accidentally pull node:fs into a client bundle.

export const MODELS = {
  // GPT Image 2 (OpenAI). Default for both modes; tiered (size × quality)
  // pricing in src/lib/pricing.ts is also keyed on this model.
  image: "openai/gpt-image-2",
  imageEdit: "openai/gpt-image-2/edit",

  // Nano Banana 2 — Google Gemini 2.5 Flash Image via fal. Fast + cheap.
  nanoBanana2: "fal-ai/nano-banana-2",
  nanoBanana2Edit: "fal-ai/nano-banana-2/edit",

  // Nano Banana Pro — Pro variant of the same family. Higher quality, more
  // expensive per call; live pricing comes from /v1/models/pricing.
  nanoBananaPro: "fal-ai/nano-banana-pro",
  nanoBananaProEdit: "fal-ai/nano-banana-pro/edit",

  // Seedream — ByteDance's image family hosted on fal. Unlike the other
  // entries above, these paths nest 4 segments deep (vendor/family/version/
  // mode) so the model-allowlist regex has to allow multi-segment paths +
  // dots (for "v4.5").
  seedream4: "fal-ai/bytedance/seedream/v4/text-to-image",
  seedream4Edit: "fal-ai/bytedance/seedream/v4/edit",
  seedream45: "fal-ai/bytedance/seedream/v4.5/text-to-image",
  seedream45Edit: "fal-ai/bytedance/seedream/v4.5/edit",
  seedream5Lite: "fal-ai/bytedance/seedream/v5/lite/text-to-image",
  seedream5LiteEdit: "fal-ai/bytedance/seedream/v5/lite/edit",
} as const;

export type ImageSizeInput = { width: number; height: number };
export type Quality = "auto" | "low" | "medium" | "high";
export type OutputFormat = "png" | "jpeg" | "webp";
