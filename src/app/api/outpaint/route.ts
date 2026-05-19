import { NextResponse } from "next/server";
import { promises as fs } from "node:fs";
import path from "node:path";
import { randomBytes } from "node:crypto";
import sharp from "sharp";
import { MODELS } from "@/lib/fal";
import { getFal } from "@/lib/falServer";
import { falErrorMessage } from "@/lib/falError";
import {
  downloadAndSave,
  listAssets,
  saveSourcesForBatch,
  updateAssetMeta,
  type StoredAsset,
  type StoredSource,
} from "@/lib/storage";

export const runtime = "nodejs";
export const maxDuration = 300;

type Direction = "left" | "right" | "top" | "bottom";

type Body = {
  id: string;
  prompt?: string;
  directions: Direction[]; // which sides to extend
  amount?: number; // fraction of original dimension, default 0.5
  quality?: "low" | "medium" | "high";
};

const ALL_DIRECTIONS: Direction[] = ["left", "right", "top", "bottom"];

// Builds an outpaint composite + mask by placing the source into a larger
// canvas, then asks the edit endpoint to fill in the new area. The output is
// saved as a new asset, inheriting the source's project + tags.
export async function POST(request: Request) {
  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }
  if (!body.id) return NextResponse.json({ error: "id required" }, { status: 400 });
  if (!Array.isArray(body.directions) || body.directions.length === 0) {
    return NextResponse.json({ error: "directions required" }, { status: 400 });
  }
  const directions = body.directions.filter((d): d is Direction =>
    ALL_DIRECTIONS.includes(d as Direction)
  );
  if (directions.length === 0) {
    return NextResponse.json({ error: "no valid directions" }, { status: 400 });
  }

  const amount = Math.min(2, Math.max(0.1, body.amount ?? 0.5));

  const assets = await listAssets();
  const source = assets.find((a) => a.id === body.id);
  if (!source) return NextResponse.json({ error: "source not found" }, { status: 404 });
  if (!source.width || !source.height) {
    return NextResponse.json({ error: "source dimensions missing" }, { status: 422 });
  }

  // Compute extra pixels per side. Multiples of 16 for fal compatibility.
  const padX = Math.round((source.width * amount) / 16) * 16;
  const padY = Math.round((source.height * amount) / 16) * 16;
  const left = directions.includes("left") ? padX : 0;
  const right = directions.includes("right") ? padX : 0;
  const top = directions.includes("top") ? padY : 0;
  const bottom = directions.includes("bottom") ? padY : 0;

  let outW = source.width + left + right;
  let outH = source.height + top + bottom;

  // Respect fal's max edge constraint (3840) — scale down if necessary.
  const MAX_EDGE = 3840;
  if (outW > MAX_EDGE || outH > MAX_EDGE) {
    const scale = Math.min(MAX_EDGE / outW, MAX_EDGE / outH);
    outW = Math.floor((outW * scale) / 16) * 16;
    outH = Math.floor((outH * scale) / 16) * 16;
  }

  try {
    const sourcePath = path.join(
      process.cwd(),
      "public",
      "generations",
      "images",
      source.fileName
    );
    const sourceBytes = await fs.readFile(sourcePath);

    // Resize the source if we scaled the output.
    const targetInnerW = source.width;
    const targetInnerH = source.height;
    const innerScale = Math.min(
      (outW - left - right) / targetInnerW,
      (outH - top - bottom) / targetInnerH
    );
    const innerW = Math.round((targetInnerW * innerScale) / 2) * 2;
    const innerH = Math.round((targetInnerH * innerScale) / 2) * 2;

    const innerBytes = await sharp(sourceBytes)
      .resize(innerW, innerH, { fit: "fill" })
      .png()
      .toBuffer();

    // Composite source onto a black canvas at the correct offset.
    const offsetLeft = Math.round((outW - innerW) / 2);
    const offsetTop = Math.round((outH - innerH) / 2);

    const composite = await sharp({
      create: {
        width: outW,
        height: outH,
        channels: 4,
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      },
    })
      .composite([{ input: innerBytes, left: offsetLeft, top: offsetTop }])
      .png()
      .toBuffer();

    // Build the mask: white where the new area is, black where the source is.
    // (Convention: white = "model can edit", black = "keep". sharp can do this
    // with a black background + white rect, then a black rect over the source
    // area.)
    const whiteCanvas = await sharp({
      create: {
        width: outW,
        height: outH,
        channels: 3,
        background: { r: 255, g: 255, b: 255 },
      },
    }).png().toBuffer();

    const blackPatch = await sharp({
      create: {
        width: innerW,
        height: innerH,
        channels: 3,
        background: { r: 0, g: 0, b: 0 },
      },
    }).png().toBuffer();

    const mask = await sharp(whiteCanvas)
      .composite([{ input: blackPatch, left: offsetLeft, top: offsetTop }])
      .png()
      .toBuffer();

    // Push composite + mask to fal storage.
    const fal = await getFal();
    const compositeFile = new File([new Uint8Array(composite)], "outpaint-source.png", {
      type: "image/png",
    });
    const maskFile = new File([new Uint8Array(mask)], "outpaint-mask.png", {
      type: "image/png",
    });
    const [compositeUrl, maskUrl] = await Promise.all([
      fal.storage.upload(compositeFile),
      fal.storage.upload(maskFile),
    ]);

    const prompt =
      body.prompt?.trim() ||
      "Extend the scene naturally to fill the empty area. Keep the existing content untouched and match the lighting, style, perspective, and detail level.";

    const result = (await fal.subscribe(MODELS.imageEdit, {
      input: {
        prompt,
        image_urls: [compositeUrl],
        mask_url: maskUrl,
        image_size: { width: outW, height: outH },
        quality: body.quality ?? "high",
        num_images: 1,
        output_format: "png",
      } as never,
    })) as { data: { images: { url: string; content_type?: string; width?: number; height?: number }[] } };

    const out = result?.data?.images?.[0];
    if (!out?.url) {
      return NextResponse.json({ error: "no output returned" }, { status: 502 });
    }

    // Persist a copy of the composite + mask alongside the new asset, the same
    // way the regular generate route does for references.
    const batchId = `${Date.now()}-${randomBytes(4).toString("hex")}`;
    let sources: StoredSource[] = [];
    let storedMask: StoredSource | undefined;
    const saved = await saveSourcesForBatch(batchId, [compositeUrl], maskUrl);
    sources = saved.sources;
    storedMask = saved.mask;

    const newAsset = await downloadAndSave({
      remoteUrl: out.url,
      contentType: out.content_type,
      width: out.width,
      height: out.height,
      prompt,
      model: MODELS.imageEdit,
      extras: {
        mode: "outpaint",
        source_id: source.id,
        directions,
        amount,
        original_size: { width: source.width, height: source.height },
        output_size: { width: outW, height: outH },
        ...(sources.length > 0 ? { sources } : {}),
        ...(storedMask ? { mask: storedMask } : {}),
      },
    });

    // Inherit project + tags from the source.
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
      { error: falErrorMessage(err, "outpaint failed") },
      { status: 500 }
    );
  }
}
