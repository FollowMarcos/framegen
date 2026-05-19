import { NextResponse } from "next/server";
import { isValidEditorId, saveEditorThumb } from "@/lib/editor/storage";

export const runtime = "nodejs";

// 5 MiB. Thumbnails for the dashboard are tiny (≤ 200 KB at our 0.5×
// pixelRatio); the cap is here to stop a malicious client from filling
// disk or stalling the request handler by streaming a huge body.
const MAX_THUMB_BYTES = 5 * 1024 * 1024;

// PNG magic bytes — first 8 bytes of every well-formed PNG file. We
// reject anything that doesn't start with this, both to fail fast
// before writing junk to disk and to keep the .png extension we save
// under from being a lie.
const PNG_MAGIC = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
]);

type RouteContext = { params: Promise<{ id: string }> };

// POST /api/editor/<id>/thumb
// Accepts a PNG body (raw bytes) from the client and writes it to
// public/editor/thumbs/<id>.png. Sent on every save so the dashboard
// listing always shows a current preview.
export async function POST(req: Request, { params }: RouteContext) {
  const { id } = await params;
  if (!isValidEditorId(id)) {
    return NextResponse.json({ error: "invalid id" }, { status: 400 });
  }
  const buf = Buffer.from(await req.arrayBuffer());
  if (buf.byteLength === 0) {
    return NextResponse.json({ error: "empty body" }, { status: 400 });
  }
  if (buf.byteLength > MAX_THUMB_BYTES) {
    return NextResponse.json(
      { error: `thumb too large (max ${MAX_THUMB_BYTES / 1024 / 1024} MiB)` },
      { status: 413 }
    );
  }
  if (buf.byteLength < 8 || !buf.subarray(0, 8).equals(PNG_MAGIC)) {
    return NextResponse.json(
      { error: "body must be a PNG" },
      { status: 415 }
    );
  }
  const url = await saveEditorThumb(id, buf);
  return NextResponse.json({ url });
}
