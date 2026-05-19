// Registry of upscale models available on fal.ai. Pricing values come from
// each model's published fal page and may drift — they're shown to the user
// as estimates, not invoices.

export type UpscalePricing =
  | { kind: "per_mp"; usdPerMP: number; note?: string }
  | { kind: "per_second"; usdPerSecond: number; estimateSeconds: number; note?: string };

export type UpscaleModel = {
  id: string; // e.g. "fal-ai/clarity-upscaler"
  name: string;
  description: string;
  qualityHint: "basic" | "balanced" | "premium";
  factor: { allowed: number[]; default: number };
  pricing: UpscalePricing;
};

export const UPSCALE_MODELS: UpscaleModel[] = [
  {
    id: "fal-ai/esrgan",
    name: "Real-ESRGAN",
    description: "Classic GAN upscaler. Fast and cheap.",
    qualityHint: "basic",
    factor: { allowed: [2, 4], default: 4 },
    pricing: { kind: "per_second", usdPerSecond: 0.00111, estimateSeconds: 5 },
  },
  {
    id: "fal-ai/aura-sr",
    name: "AuraSR",
    description: "GAN-based super-resolution. Balanced speed and detail.",
    qualityHint: "balanced",
    factor: { allowed: [4], default: 4 },
    pricing: { kind: "per_second", usdPerSecond: 0.001, estimateSeconds: 10 },
  },
  {
    id: "fal-ai/clarity-upscaler",
    name: "Clarity",
    description: "Diffusion-based. High fidelity, preserves detail well.",
    qualityHint: "premium",
    factor: { allowed: [2, 4], default: 2 },
    pricing: { kind: "per_mp", usdPerMP: 0.03 },
  },
  {
    id: "fal-ai/creative-upscaler",
    name: "Creative",
    description: "Adds detail creatively. Best for stylized output.",
    qualityHint: "premium",
    factor: { allowed: [2, 4], default: 2 },
    pricing: { kind: "per_second", usdPerSecond: 0, estimateSeconds: 30, note: "promo pricing" },
  },
];

export function getUpscaleModel(id: string): UpscaleModel | null {
  return UPSCALE_MODELS.find((m) => m.id === id) ?? null;
}

// Client-only: union of built-in + localStorage-stored custom upscale models.
// The /api/upscale route only sees built-ins server-side; custom models
// are passed by id, and the route falls through to a generic input shape.
export function getAllUpscaleModels(): UpscaleModel[] {
  if (typeof window === "undefined") return UPSCALE_MODELS;
  try {
    // Prefer the new unified store; fall back to the legacy key for the
    // first read after upgrade (lib/customModels.ts handles the actual
    // migration when it loads).
    const raw =
      localStorage.getItem("frame.customModels.v1") ??
      localStorage.getItem("frame.customUpscaleModels.v1");
    if (!raw) return UPSCALE_MODELS;
    const parsed = JSON.parse(raw) as Array<UpscaleModel & { kind?: string }>;
    if (!Array.isArray(parsed)) return UPSCALE_MODELS;
    const custom = parsed.filter((m) => !m.kind || m.kind === "upscale");
    return [...UPSCALE_MODELS, ...custom];
  } catch {
    return UPSCALE_MODELS;
  }
}

// Best-effort cost estimate for the chosen (model, factor, sourceWxH).
// Returns null when we genuinely don't have enough info.
export function estimateUpscaleCost(
  model: UpscaleModel,
  factor: number,
  source: { width?: number; height?: number }
): number | null {
  if (model.pricing.kind === "per_mp") {
    if (!source.width || !source.height) return null;
    const outMP = (source.width * factor * source.height * factor) / 1_000_000;
    return outMP * model.pricing.usdPerMP;
  }
  // per_second: very rough estimate; scale with factor² since work scales
  // with output pixel count.
  const factorScale = (factor / 2) ** 2;
  return model.pricing.estimateSeconds * factorScale * model.pricing.usdPerSecond;
}

export function formatCost(usd: number): string {
  if (usd === 0) return "$0";
  if (usd < 0.01) return `$${usd.toFixed(4)}`;
  return `$${usd.toFixed(3)}`;
}
