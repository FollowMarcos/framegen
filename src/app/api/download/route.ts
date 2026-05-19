import { NextResponse } from "next/server";
import { promises as fs } from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { listAssets } from "@/lib/storage";

export const runtime = "nodejs";

// Re-encodes the asset through sharp before sending it back so the downloaded
// file has no EXIF / text chunks / color profiles / model-embedded metadata.
// sharp strips metadata by default — to keep it we'd need to call
// .withMetadata(), which we never do.
//
// The on-disk copy under public/generations/ is untouched so the gallery
// preview is unchanged.
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) return new NextResponse("id required", { status: 400 });

  const assets = await listAssets();
  const asset = assets.find((a) => a.id === id);
  if (!asset) return new NextResponse("not found", { status: 404 });

  const imagePath = path.join(
    process.cwd(),
    "public",
    "generations",
    "images",
    asset.fileName
  );

  let raw: Buffer;
  try {
    raw = await fs.readFile(imagePath);
  } catch {
    return new NextResponse("file missing", { status: 404 });
  }

  const ext = path.extname(asset.fileName).toLowerCase().slice(1);
  const wantsAnimated = ext === "gif" || ext === "webp";

  let pipeline = sharp(raw, { animated: wantsAnimated, failOn: "none" });

  // Re-encode in the same format. Use the highest quality settings to make
  // the re-encode visually indistinguishable from the original.
  switch (ext) {
    case "png":
      pipeline = pipeline.png({ compressionLevel: 9 }); // lossless
      break;
    case "jpg":
    case "jpeg":
      pipeline = pipeline.jpeg({ quality: 100, chromaSubsampling: "4:4:4" });
      break;
    case "webp":
      // lossless: true keeps full quality. WebP files are still small.
      pipeline = pipeline.webp({ quality: 100, lossless: true });
      break;
    case "gif":
      pipeline = pipeline.gif();
      break;
    default:
      // Unknown extension: just decode/re-encode as PNG to be safe.
      pipeline = pipeline.png();
  }

  let cleaned: Buffer;
  try {
    cleaned = await pipeline.toBuffer();
  } catch (e) {
    return new NextResponse(
      `re-encode failed: ${e instanceof Error ? e.message : "unknown"}`,
      { status: 500 }
    );
  }

  return new NextResponse(new Uint8Array(cleaned), {
    headers: {
      "Content-Type": asset.contentType || `image/${ext === "jpg" ? "jpeg" : ext}`,
      "Content-Disposition": `attachment; filename="${asset.fileName}"`,
      "Content-Length": String(cleaned.byteLength),
      "Cache-Control": "no-store",
    },
  });
}
