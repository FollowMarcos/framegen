import { NextResponse } from "next/server";
import {
  deleteEditorDoc,
  isValidEditorId,
  loadEditorDoc,
} from "@/lib/editor/storage";

export const runtime = "nodejs";

// Next.js 16 hands params as a Promise — must be awaited inside the
// handler before the values are usable.
type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: RouteContext) {
  const { id } = await params;
  if (!isValidEditorId(id)) {
    return NextResponse.json({ error: "invalid id" }, { status: 400 });
  }
  const doc = await loadEditorDoc(id);
  if (!doc) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json({ doc });
}

export async function DELETE(_req: Request, { params }: RouteContext) {
  const { id } = await params;
  if (!isValidEditorId(id)) {
    return NextResponse.json({ error: "invalid id" }, { status: 400 });
  }
  const ok = await deleteEditorDoc(id);
  if (!ok) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
