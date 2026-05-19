import { NextResponse } from "next/server";
import {
  emptyTrash,
  listTrash,
  permanentlyDeleteFromTrash,
  restoreFromTrash,
} from "@/lib/storage";

export const runtime = "nodejs";

// GET /api/trash
// Lists soft-deleted assets, newest-first. Auto-purges entries older than
// 30 days as a side effect (handled in listTrash) so the trash never grows
// unbounded.
export async function GET() {
  try {
    const items = await listTrash();
    return NextResponse.json({ items });
  } catch (err) {
    const message = err instanceof Error ? err.message : "list failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// POST /api/trash/restore?id=<id>   →  moves the asset back into the active
//   library and returns the restored StoredAsset.
// DELETE /api/trash?id=<id>          →  permanent removal of one entry.
// DELETE /api/trash                  →  empties the trash entirely.
//
// Both verbs use the query string so the body is reserved for future
// bulk-action shapes.

export async function POST(request: Request) {
  const url = new URL(request.url);
  const action = url.searchParams.get("action") ?? "restore";
  const id = url.searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "id required" }, { status: 400 });
  }
  if (action !== "restore") {
    return NextResponse.json({ error: "unknown action" }, { status: 400 });
  }
  const asset = await restoreFromTrash(id);
  if (!asset) {
    return NextResponse.json({ error: "not in trash" }, { status: 404 });
  }
  return NextResponse.json({ asset });
}

export async function DELETE(request: Request) {
  const id = new URL(request.url).searchParams.get("id");
  if (!id) {
    // No id → "empty trash" semantics.
    const purged = await emptyTrash();
    return NextResponse.json({ purged });
  }
  const ok = await permanentlyDeleteFromTrash(id);
  if (!ok) {
    return NextResponse.json({ error: "not in trash" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
