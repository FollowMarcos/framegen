import { NextResponse } from "next/server";
import { deleteUpload, listUploads } from "@/lib/storage";

export const runtime = "nodejs";

// GET /api/uploads
// Lists every user-uploaded reference image the studio has persisted. Used
// by the "browse uploads" picker in ImagePicker and the Uploads section of
// the dashboard. Newest-first.
export async function GET() {
  try {
    const uploads = await listUploads();
    return NextResponse.json({ uploads });
  } catch (err) {
    const message = err instanceof Error ? err.message : "list failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// DELETE /api/uploads?id=<id>
// Removes the local copy + sidecar. The fal CDN copy is not touched — fal's
// storage doesn't expose a delete from the client SDK, and a stale fal URL
// is harmless once it falls out of the user's library.
export async function DELETE(request: Request) {
  const id = new URL(request.url).searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "id required" }, { status: 400 });
  }
  const ok = await deleteUpload(id);
  if (!ok) {
    return NextResponse.json({ error: "upload not found" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
