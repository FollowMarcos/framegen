import { NextResponse } from "next/server";
import { listAssets, deleteAsset, updateAssetMeta } from "@/lib/storage";

export const runtime = "nodejs";

export async function GET() {
  const assets = await listAssets();
  return NextResponse.json({ assets });
}

export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  const ok = await deleteAsset(id);
  if (!ok) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}

type PatchBody = {
  id: string;
  tags?: string[];
  projectId?: string | null;
  prompt?: string;
  favorited?: boolean;
};

export async function PATCH(request: Request) {
  let body: PatchBody;
  try {
    body = (await request.json()) as PatchBody;
  } catch {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }
  if (!body.id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const updated = await updateAssetMeta(body.id, {
    tags: body.tags,
    projectId: body.projectId,
    prompt: body.prompt,
    favorited: body.favorited,
  });
  if (!updated) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json({ asset: updated });
}
