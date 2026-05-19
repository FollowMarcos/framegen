// Aspect ratio × resolution matrix for GPT Image 2.
//
// fal/OpenAI accept a custom { width, height } image_size as long as both
// edges are multiples of 16, no edge exceeds 3840, and the aspect ratio is
// ≤ 3:1. We compute a uniform matrix of 7 aspect ratios × 3 resolution tiers
// with long-edge sized 1024 / 2048 / 3840 px (1k / 2k / 4k).

export type ResolutionTier = "1k" | "2k" | "4k";

export type AspectId =
  | "square"
  | "land_4_3"
  | "port_3_4"
  | "land_16_9"
  | "port_9_16"
  | "land_3_2"
  | "port_2_3";

type Aspect = {
  id: AspectId;
  label: string;
  ratioW: number;
  ratioH: number;
};

const ASPECTS: Aspect[] = [
  { id: "square",    label: "square · 1:1",     ratioW: 1,  ratioH: 1  },
  { id: "land_4_3",  label: "landscape · 4:3",  ratioW: 4,  ratioH: 3  },
  { id: "port_3_4",  label: "portrait · 3:4",   ratioW: 3,  ratioH: 4  },
  { id: "land_16_9", label: "landscape · 16:9", ratioW: 16, ratioH: 9  },
  { id: "port_9_16", label: "portrait · 9:16",  ratioW: 9,  ratioH: 16 },
  { id: "land_3_2",  label: "landscape · 3:2",  ratioW: 3,  ratioH: 2  },
  { id: "port_2_3",  label: "portrait · 2:3",   ratioW: 2,  ratioH: 3  },
];

const TIER_LONG_EDGE: Record<ResolutionTier, number> = {
  "1k": 1024,
  "2k": 2048,
  "4k": 3840,
};

const TIER_ORDER: ResolutionTier[] = ["1k", "2k", "4k"];

function roundTo16(n: number): number {
  return Math.max(16, Math.round(n / 16) * 16);
}

function computeWH(aspect: Aspect, longEdge: number): { width: number; height: number } {
  if (aspect.ratioW >= aspect.ratioH) {
    // landscape or square — width carries the long edge
    return {
      width: longEdge,
      height: roundTo16((longEdge * aspect.ratioH) / aspect.ratioW),
    };
  }
  // portrait — height carries the long edge
  return {
    width: roundTo16((longEdge * aspect.ratioW) / aspect.ratioH),
    height: longEdge,
  };
}

export type SizeOption = {
  id: string; // "1024x1024"
  aspectId: AspectId;
  tier: ResolutionTier;
  label: string;
  width: number;
  height: number;
};

function buildMatrix(): Record<ResolutionTier, SizeOption[]> {
  const out = { "1k": [], "2k": [], "4k": [] } as Record<ResolutionTier, SizeOption[]>;
  for (const tier of TIER_ORDER) {
    const longEdge = TIER_LONG_EDGE[tier];
    for (const a of ASPECTS) {
      const { width, height } = computeWH(a, longEdge);
      out[tier].push({
        id: `${width}x${height}`,
        aspectId: a.id,
        tier,
        label: a.label,
        width,
        height,
      });
    }
  }
  return out;
}

export const SIZE_PRESETS = buildMatrix();

// Lookup a SizeOption by its exact pixel dimensions. Used by the "reuse"
// flow to map a saved asset back into the matrix. Returns null when the
// dimensions don't match any preset (e.g. the asset was generated with a
// custom size or via "auto" mode).
export function findSize(width: number, height: number): SizeOption | null {
  for (const tier of TIER_ORDER) {
    const hit = SIZE_PRESETS[tier].find((o) => o.width === width && o.height === height);
    if (hit) return hit;
  }
  return null;
}

export function tierFor(sizeId: string): ResolutionTier | null {
  for (const tier of TIER_ORDER) {
    if (SIZE_PRESETS[tier].some((o) => o.id === sizeId)) return tier;
  }
  return null;
}

export function defaultSizeFor(tier: ResolutionTier): SizeOption {
  return SIZE_PRESETS[tier][0];
}

export const DEFAULT_SIZE: SizeOption = SIZE_PRESETS["1k"][0];
