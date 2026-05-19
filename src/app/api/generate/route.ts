import { NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { MODELS, type Quality, type OutputFormat } from "@/lib/fal";
import { getFal } from "@/lib/falServer";
import { expandMentions } from "@/lib/mentions";
import {
  downloadAndSave,
  saveSourcesForBatch,
  updateAssetMeta,
  type StoredAsset,
  type StoredSource,
} from "@/lib/storage";
import { isAllowedModelId } from "@/lib/modelAllowlist";
import { falErrorMessage } from "@/lib/falError";

export const runtime = "nodejs";
export const maxDuration = 300;

type ImageSize = string | { width: number; height: number };

type Body = {
  prompt: string;
  // Optional second prompt for "what to avoid". Forwarded to fal verbatim;
  // models that don't support negative prompting (gpt-image-2, nano banana,
  // etc.) just ignore the field. Set on a per-call basis from the studio
  // panel when the user has the negativePrompt feature flag enabled.
  negative_prompt?: string;
  image_urls?: string[];
  mask_url?: string;
  image_size?: ImageSize;
  quality?: Quality;
  num_images?: number;
  output_format?: OutputFormat;
  project_id?: string | null;
  // Optional fal model path override. When present, the route uses it
  // instead of the built-in MODELS.image / MODELS.imageEdit defaults.
  // Custom (user-added) models flow through here.
  model?: string;
};

type FalImage = {
  url: string;
  content_type?: string;
  width?: number;
  height?: number;
};

type FalImageResponse = { data: { images: FalImage[] } };

// One endpoint, two dispatch paths. If image_urls is present we use the edit
// model (which also accepts an optional mask_url); otherwise we use the
// text-to-image model. Parameters are otherwise identical.
export async function POST(request: Request) {
  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }

  if (!body.prompt || typeof body.prompt !== "string") {
    return NextResponse.json({ error: "prompt required" }, { status: 400 });
  }

  const hasImages = Array.isArray(body.image_urls) && body.image_urls.length > 0;
  // Honor an explicit model override if the client sent one (used by the
  // StudioPanel's ModelPicker for custom user-added models). Otherwise fall
  // back to the built-in default for the current mode.
  const model = body.model || (hasImages ? MODELS.imageEdit : MODELS.image);
  if (!isAllowedModelId(model)) {
    return NextResponse.json(
      {
        error:
          "model not in allowlist. Set ALLOW_CUSTOM_FAL_MODELS=true to permit custom fal model ids.",
      },
      { status: 400 }
    );
  }
  const imageSize: ImageSize =
    body.image_size ?? (hasImages ? "auto" : { width: 1024, height: 1024 });

  // Expand @image1 / @img1 / @ref1 tokens to "the first reference image" etc.
  // Storage keeps the original prompt so the user sees their @-syntax in
  // the Lightbox; only fal sees the expanded version.
  const refCount = hasImages ? body.image_urls!.length : 0;
  const expandedPrompt = expandMentions(body.prompt, refCount);

  try {
    const fal = await getFal();
    const input: Record<string, unknown> = {
      prompt: expandedPrompt,
      image_size: imageSize,
      quality: body.quality ?? "high",
      num_images: body.num_images ?? 1,
      output_format: body.output_format ?? "png",
    };
    if (hasImages) {
      input.image_urls = body.image_urls;
      if (body.mask_url) input.mask_url = body.mask_url;
    }
    // Forward the negative prompt only when present + non-empty. Skipped
    // entirely otherwise so models that reject the field (gpt-image-2 et al)
    // don't see an extra unknown key.
    const negativePrompt = body.negative_prompt?.trim();
    if (negativePrompt) {
      input.negative_prompt = negativePrompt;
    }

    const result = (await fal.subscribe(model, {
      input: input as never,
    })) as FalImageResponse;

    const images = result?.data?.images ?? [];
    if (images.length === 0) {
      return NextResponse.json({ error: "no images returned" }, { status: 502 });
    }

    // Persist a local copy of each reference image (and the mask) so they
    // remain viewable in the asset details forever, even after the fal CDN
    // URLs expire. All output assets in this batch share one sources/<id>
    // directory.
    let storedSources: StoredSource[] = [];
    let storedMask: StoredSource | undefined;
    if (hasImages) {
      const batchId = `${Date.now()}-${randomBytes(4).toString("hex")}`;
      const result = await saveSourcesForBatch(batchId, body.image_urls!, body.mask_url);
      storedSources = result.sources;
      storedMask = result.mask;
    }

    const saved: StoredAsset[] = [];
    for (const img of images) {
      const extras: Record<string, unknown> = {
        mode: hasImages ? "edit" : "generate",
        image_size: imageSize,
        quality: body.quality ?? "high",
      };
      if (storedSources.length > 0) extras.sources = storedSources;
      if (storedMask) extras.mask = storedMask;

      const asset = await downloadAndSave({
        remoteUrl: img.url,
        contentType: img.content_type,
        width: img.width,
        height: img.height,
        prompt: body.prompt,
        model,
        extras,
      });
      // Stamp the active project onto the new asset so it lands in the
      // user's current view automatically.
      if (body.project_id) {
        const updated = await updateAssetMeta(asset.id, { projectId: body.project_id });
        saved.push(updated ?? asset);
      } else {
        saved.push(asset);
      }
    }

    return NextResponse.json({ assets: saved });
  } catch (err) {
    return NextResponse.json(
      { error: falErrorMessage(err, "generation failed") },
      { status: 500 }
    );
  }
}
