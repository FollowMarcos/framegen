import { NextResponse } from "next/server";
import { getFal } from "@/lib/falServer";

export const runtime = "nodejs";
export const maxDuration = 120;

const SAM3_MODEL = "fal-ai/sam-3/image";

type Body = {
  image_url: string;
  x: number; // pixel coords in the *original* image
  y: number;
};

type Sam3Mask = {
  url: string;
  content_type?: string;
  width?: number;
  height?: number;
};

type Sam3Metadata = {
  index: number;
  score?: number;
  box?: [number, number, number, number]; // normalized [cx, cy, w, h]
};

type Sam3Response = {
  data: {
    masks: Sam3Mask[];
    metadata?: Sam3Metadata[];
    scores?: number[];
  };
};

// Returns the single best mask for a point click on the source image.
// We request multiple candidate masks and pick the highest-scoring one.
export async function POST(request: Request) {
  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }

  if (!body.image_url) {
    return NextResponse.json({ error: "image_url required" }, { status: 400 });
  }
  if (typeof body.x !== "number" || typeof body.y !== "number") {
    return NextResponse.json({ error: "x and y required (pixel coords)" }, { status: 400 });
  }

  try {
    const fal = await getFal();
    const result = (await fal.subscribe(SAM3_MODEL, {
      input: {
        image_url: body.image_url,
        // We pass an empty text prompt and rely on the point to drive selection.
        prompt: "",
        point_prompts: [{ x: Math.round(body.x), y: Math.round(body.y), label: 1 }],
        apply_mask: false, // we want the bare mask, not the image with mask burned in
        include_scores: true,
        max_masks: 3,
        output_format: "png",
      } as never,
    })) as Sam3Response;

    const masks = result?.data?.masks ?? [];
    const scores = result?.data?.scores ?? [];
    const meta = result?.data?.metadata ?? [];

    if (masks.length === 0) {
      return NextResponse.json({ error: "no mask returned" }, { status: 502 });
    }

    // Pick the highest-confidence mask. Fall back to first if no scores.
    let bestIdx = 0;
    if (scores.length === masks.length) {
      let bestScore = -Infinity;
      for (let i = 0; i < scores.length; i++) {
        if (scores[i] > bestScore) {
          bestScore = scores[i];
          bestIdx = i;
        }
      }
    }

    const mask = masks[bestIdx];
    const score = scores[bestIdx];
    const box = meta[bestIdx]?.box ?? null;

    return NextResponse.json({
      mask: {
        url: mask.url,
        width: mask.width,
        height: mask.height,
      },
      score: typeof score === "number" ? score : null,
      box, // normalized [cx, cy, w, h] for optional UI use
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "segmentation failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
