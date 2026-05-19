import { NextResponse } from "next/server";
import sharp from "sharp";
import { getFal } from "@/lib/falServer";
import { saveUpload } from "@/lib/storage";

export const runtime = "nodejs";
export const maxDuration = 120;

// 25 MiB. fal models won't accept larger refs in practice; the cap is here so
// a misbehaving (or malicious) client can't fill our fal storage account.
const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;

// Only the formats the editor + generator actually consume. Rejecting other
// MIME types here stops the route being used as a generic file dump pointed
// at fal storage.
const ALLOWED_MIME = new Set<string>([
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
]);

// Uploads a file to fal.ai storage and returns a public URL we can pass back
// into image edit / image-to-video models.
export async function POST(request: Request) {
  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  if (!file || !(file instanceof File)) {
    return NextResponse.json({ error: "file required" }, { status: 400 });
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return NextResponse.json(
      { error: `file too large (max ${MAX_UPLOAD_BYTES / 1024 / 1024} MiB)` },
      { status: 413 }
    );
  }
  if (file.type && !ALLOWED_MIME.has(file.type)) {
    return NextResponse.json(
      { error: `unsupported type "${file.type}" (allowed: png, jpeg, webp, gif)` },
      { status: 415 }
    );
  }
  try {
    const fal = await getFal();
    const url = await fal.storage.upload(file);

    // Persist a local copy + sidecar so the user can pick this same image
    // again from the uploads library without re-uploading. We read the file
    // bytes once and reuse the buffer for both sharp metadata + disk write.
    const buffer = Buffer.from(await file.arrayBuffer());
    let width: number | undefined;
    let height: number | undefined;
    try {
      const meta = await sharp(buffer).metadata();
      width = meta.width;
      height = meta.height;
    } catch {
      // sharp can't read the image (e.g. corrupted) — still save the file
      // so the user has something to manage; just skip the dimensions.
    }

    const upload = await saveUpload({
      buffer,
      originalName: file.name || "upload",
      contentType: file.type || "application/octet-stream",
      remoteUrl: url,
      width,
      height,
    });

    // Return both shapes so existing callers (ImagePicker) that read `url`
    // keep working, while the new uploads-library flow can grab the full
    // `upload` record.
    return NextResponse.json({ url, upload });
  } catch (err) {
    const message = err instanceof Error ? err.message : "upload failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
