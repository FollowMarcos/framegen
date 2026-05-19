import { NextResponse } from "next/server";
import {
  isValidEditorId,
  listEditorDocs,
  saveEditorDoc,
} from "@/lib/editor/storage";
import type { EditorDoc } from "@/lib/editor/types";

export const runtime = "nodejs";

// Hard cap on the JSON body. A doc with a few dozen overlays sits at
// well under 100 KB; 2 MiB is a comfortable ceiling that still allows
// for long-form text overlays + dense canvases without risking a
// runaway memory grow on a malicious POST.
const MAX_DOC_BYTES = 2 * 1024 * 1024;

// GET /api/editor — list all editor documents (summaries only, no overlay
// data) for the dashboard listing.
export async function GET() {
  const docs = await listEditorDocs();
  return NextResponse.json({ docs });
}

// POST /api/editor — create or replace an editor document. The client
// sends the full doc; the server just persists it. No partial-update
// merging here on purpose: the editor is a single-user local-first
// surface, so last-write-wins is correct.
export async function POST(request: Request) {
  // Read the body as text first so we can enforce a byte cap before
  // paying for JSON.parse on a multi-megabyte blob.
  const raw = await request.text();
  if (raw.length > MAX_DOC_BYTES) {
    return NextResponse.json(
      { error: `doc too large (max ${MAX_DOC_BYTES / 1024 / 1024} MiB)` },
      { status: 413 }
    );
  }
  let body: EditorDoc;
  try {
    body = JSON.parse(raw) as EditorDoc;
  } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 });
  }
  if (!body || !isValidEditorId(body.id)) {
    return NextResponse.json({ error: "invalid id" }, { status: 400 });
  }
  await saveEditorDoc({ ...body, updatedAt: Date.now() });
  return NextResponse.json({ ok: true });
}
