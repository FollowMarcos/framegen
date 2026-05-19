import { NextResponse } from "next/server";
import { promises as fs } from "node:fs";
import path from "node:path";
import { getFal } from "@/lib/falServer";
import {
  downloadAndSave,
  listAssets,
  updateAssetMeta,
  type StoredAsset,
} from "@/lib/storage";
import { getUpscaleModel } from "@/lib/upscaleModels";
import { isAllowedModelId } from "@/lib/modelAllowlist";
import { falErrorMessage } from "@/lib/falError";

export const runtime = "nodejs";
export const maxDuration = 300;

type Body = {
  id: string;
  model: string;
  factor?: number;
};

type FalImage = {
  url: string;
  content_type?: string;
  width?: number;
  height?: number;
};

type UpscaleResponse = {
  data: {
    image: FalImage;
    seed?: number;
  };
};

// Dispatches to the chosen fal upscaler. Different models have different input
// shapes, so we build them per-id rather than a single uniform payload.
export async function POST(request: Request) {
  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }
  if (!body.id) return NextResponse.json({ error: "id required" }, { status: 400 });
  if (!body.model) return NextResponse.json({ error: "model required" }, { status: 400 });

  if (!isAllowedModelId(body.model)) {
    return NextResponse.json(
      {
        error:
          "model not in allowlist. Set ALLOW_CUSTOM_FAL_MODELS=true to permit custom fal model ids.",
      },
      { status: 400 }
    );
  }

  const modelDef = getUpscaleModel(body.model);

  // For built-in models, validate factor; custom models accept whatever
  // the client sends.
  const factor =
    body.factor ?? (modelDef ? modelDef.factor.default : 2);
  if (modelDef && !modelDef.factor.allowed.includes(factor)) {
    return NextResponse.json(
      { error: `factor must be one of: ${modelDef.factor.allowed.join(", ")}` },
      { status: 400 }
    );
  }

  const assets = await listAssets();
  const source = assets.find((a) => a.id === body.id);
  if (!source) return NextResponse.json({ error: "source not found" }, { status: 404 });

  try {
    const fal = await getFal();
    const imagePath = path.join(
      process.cwd(),
      "public",
      "generations",
      "images",
      source.fileName
    );
    const buffer = await fs.readFile(imagePath);
    const file = new File([new Uint8Array(buffer)], source.fileName, {
      type: source.contentType || "image/png",
    });
    const remoteUrl = await fal.storage.upload(file);

    // Per-model input shapes — see each fal docs page for exact names.
    const input: Record<string, unknown> = { image_url: remoteUrl };
    const modelId = modelDef?.id ?? body.model;
    switch (modelId) {
      case "fal-ai/clarity-upscaler":
        input.upscale_factor = factor;
        input.prompt = "masterpiece, best quality, highres";
        break;
      case "fal-ai/aura-sr":
        input.upscale_factor = Math.round(factor);
        input.overlapping_tiles = true;
        input.checkpoint = "v2";
        break;
      case "fal-ai/esrgan":
        input.scale = factor;
        input.model = factor >= 4 ? "RealESRGAN_x4plus" : "RealESRGAN_x2plus";
        input.output_format = "png";
        break;
      case "fal-ai/creative-upscaler":
        input.scale = factor;
        input.model_type = "SDXL";
        input.prompt = source.prompt;
        break;
      default:
        // Custom model: generic shape. Most fal upscalers accept one of
        // upscale_factor / scale — we send both for safety; fal usually
        // ignores unknown fields.
        input.upscale_factor = factor;
        input.scale = factor;
        break;
    }

    const result = (await fal.subscribe(modelId, {
      input: input as never,
    })) as UpscaleResponse;

    const img = result?.data?.image;
    if (!img?.url) {
      return NextResponse.json({ error: "no upscaled image returned" }, { status: 502 });
    }

    const newAsset: StoredAsset = await downloadAndSave({
      remoteUrl: img.url,
      contentType: img.content_type,
      width: img.width,
      height: img.height,
      prompt: source.prompt,
      model: modelId,
      extras: {
        mode: "upscale",
        source_id: source.id,
        factor,
        upscale_model: modelId,
        ...(typeof result.data.seed === "number" ? { seed: result.data.seed } : {}),
      },
    });

    if (source.projectId || (source.tags && source.tags.length > 0)) {
      const patched = await updateAssetMeta(newAsset.id, {
        projectId: source.projectId ?? null,
        tags: source.tags,
      });
      return NextResponse.json({ asset: patched ?? newAsset });
    }

    return NextResponse.json({ asset: newAsset });
  } catch (err) {
    return NextResponse.json(
      { error: falErrorMessage(err, "upscale failed") },
      { status: 500 }
    );
  }
}
