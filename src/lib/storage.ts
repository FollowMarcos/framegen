import { promises as fs } from "node:fs";
import path from "node:path";
import { randomBytes } from "node:crypto";

// Stored under public/ so Next.js serves them directly at /generations/...
const ROOT = path.join(process.cwd(), "public", "generations");
const IMAGES_DIR = path.join(ROOT, "images");
const META_DIR = path.join(ROOT, "meta");
const SOURCES_DIR = path.join(ROOT, "sources");
const UPLOADS_DIR = path.join(ROOT, "uploads");
const UPLOADS_META_DIR = path.join(UPLOADS_DIR, "meta");
const TRASH_DIR = path.join(ROOT, "trash");
const TRASH_IMAGES_DIR = path.join(TRASH_DIR, "images");
const TRASH_META_DIR = path.join(TRASH_DIR, "meta");

// How long deleted assets sit in the trash before being purged on the next
// listTrash() call. 30 days mirrors what Apple Photos / Google Photos do
// for recently-deleted; long enough to recover from "oh no" without leaving
// the trash unbounded forever.
export const TRASH_TTL_DAYS = 30;

export type StoredAsset = {
  id: string;
  fileName: string;
  url: string; // /generations/images/<file>
  remoteUrl?: string; // original fal CDN URL
  width?: number;
  height?: number;
  contentType?: string;
  prompt: string;
  model: string;
  createdAt: string;
  tags?: string[];
  projectId?: string | null;
  // Soft "starred" flag toggled from the library — used by the Favorites
  // filter in the toolbar and surfaced as a heart icon on each card.
  // Undefined means never-favorited (treated as false everywhere).
  favorited?: boolean;
  extras?: Record<string, unknown>;
};

export type StoredSource = {
  url: string; // /generations/sources/<batchId>/<file>
  fileName: string;
};

// User-uploaded reference image, persisted so it can be re-picked across
// sessions instead of re-uploaded every time. Each upload exists in two
// places: a local copy under public/generations/uploads/<file> (so the app
// can show the thumbnail without depending on fal's CDN) and on fal storage
// (so the URL can be passed back to /api/generate as a reference). The
// localUrl is what we show in the picker; remoteUrl is what we pass to fal.
export type UploadedAsset = {
  id: string;
  fileName: string;
  localUrl: string;   // /generations/uploads/<file>
  remoteUrl: string;  // https://...fal.media/...
  originalName: string;
  contentType: string;
  width?: number;
  height?: number;
  size: number;       // bytes
  uploadedAt: string;
};

export async function ensureDirs() {
  await fs.mkdir(IMAGES_DIR, { recursive: true });
  await fs.mkdir(META_DIR, { recursive: true });
  await fs.mkdir(SOURCES_DIR, { recursive: true });
  await fs.mkdir(UPLOADS_DIR, { recursive: true });
  await fs.mkdir(UPLOADS_META_DIR, { recursive: true });
  await fs.mkdir(TRASH_IMAGES_DIR, { recursive: true });
  await fs.mkdir(TRASH_META_DIR, { recursive: true });
}

// A StoredAsset that's been soft-deleted. The `deletedAt` timestamp gates
// the 30-day auto-purge; the `url` is rewritten to the trash path so the
// dashboard can still render the thumbnail.
export type TrashedAsset = StoredAsset & { deletedAt: string };

function extFromContentType(contentType: string | undefined, fallback: string): string {
  if (!contentType) return fallback;
  if (contentType.includes("png")) return "png";
  if (contentType.includes("webp")) return "webp";
  if (contentType.includes("jpeg") || contentType.includes("jpg")) return "jpg";
  if (contentType.includes("gif")) return "gif";
  return fallback;
}

function extFromUrl(url: string): string {
  try {
    const u = new URL(url);
    const m = u.pathname.match(/\.([a-z0-9]{2,4})$/i);
    if (m) return m[1].toLowerCase();
  } catch {
    // ignore
  }
  return "png";
}

export async function downloadAndSave(opts: {
  remoteUrl: string;
  contentType?: string;
  prompt: string;
  model: string;
  width?: number;
  height?: number;
  extras?: Record<string, unknown>;
}): Promise<StoredAsset> {
  await ensureDirs();
  const res = await fetch(opts.remoteUrl);
  if (!res.ok) throw new Error(`Failed to fetch generated asset: ${res.status}`);
  const buffer = Buffer.from(await res.arrayBuffer());

  const ct = opts.contentType ?? res.headers.get("content-type") ?? undefined;
  const ext = extFromContentType(ct, "png");
  const id = `${Date.now()}-${randomBytes(4).toString("hex")}`;
  const fileName = `${id}.${ext}`;
  await fs.writeFile(path.join(IMAGES_DIR, fileName), buffer);

  const asset: StoredAsset = {
    id,
    fileName,
    url: `/generations/images/${fileName}`,
    remoteUrl: opts.remoteUrl,
    width: opts.width,
    height: opts.height,
    contentType: ct,
    prompt: opts.prompt,
    model: opts.model,
    createdAt: new Date().toISOString(),
    extras: opts.extras,
  };

  await fs.writeFile(
    path.join(META_DIR, `${id}.json`),
    JSON.stringify(asset, null, 2),
    "utf-8"
  );

  return asset;
}

// Downloads each reference URL (and optional mask) and saves them under
// public/generations/sources/<batchId>/. Returns the public paths so they
// can be stamped onto asset metadata. Failures are silent — a missing
// reference just means it won't appear in the modal later.
export async function saveSourcesForBatch(
  batchId: string,
  urls: string[],
  maskUrl?: string
): Promise<{ sources: StoredSource[]; mask?: StoredSource }> {
  await ensureDirs();
  const dir = path.join(SOURCES_DIR, batchId);
  await fs.mkdir(dir, { recursive: true });

  const sources: StoredSource[] = [];
  for (let i = 0; i < urls.length; i++) {
    const url = urls[i];
    try {
      const res = await fetch(url);
      if (!res.ok) continue;
      const buffer = Buffer.from(await res.arrayBuffer());
      const ct = res.headers.get("content-type") ?? undefined;
      const ext = extFromContentType(ct, extFromUrl(url));
      const fileName = `source-${i}.${ext}`;
      await fs.writeFile(path.join(dir, fileName), buffer);
      sources.push({
        url: `/generations/sources/${batchId}/${fileName}`,
        fileName,
      });
    } catch {
      // skip this source
    }
  }

  let mask: StoredSource | undefined;
  if (maskUrl) {
    try {
      const res = await fetch(maskUrl);
      if (res.ok) {
        const buffer = Buffer.from(await res.arrayBuffer());
        const ct = res.headers.get("content-type") ?? undefined;
        const ext = extFromContentType(ct, extFromUrl(maskUrl));
        const fileName = `mask.${ext}`;
        await fs.writeFile(path.join(dir, fileName), buffer);
        mask = {
          url: `/generations/sources/${batchId}/${fileName}`,
          fileName,
        };
      }
    } catch {
      // ignore
    }
  }

  return { sources, mask };
}

export async function listAssets(): Promise<StoredAsset[]> {
  await ensureDirs();
  const files = await fs.readdir(META_DIR).catch(() => [] as string[]);
  const items: StoredAsset[] = [];
  for (const f of files) {
    if (!f.endsWith(".json")) continue;
    try {
      const raw = await fs.readFile(path.join(META_DIR, f), "utf-8");
      items.push(JSON.parse(raw) as StoredAsset);
    } catch {
      // skip
    }
  }
  items.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return items;
}

// Updates mutable metadata fields (tags, projectId, prompt) in place on the
// sidecar JSON. The image file is never touched.
export async function updateAssetMeta(
  id: string,
  patch: Partial<Pick<StoredAsset, "tags" | "projectId" | "prompt" | "favorited">>
): Promise<StoredAsset | null> {
  const metaPath = path.join(META_DIR, `${id}.json`);
  let asset: StoredAsset;
  try {
    asset = JSON.parse(await fs.readFile(metaPath, "utf-8")) as StoredAsset;
  } catch {
    return null;
  }
  const next: StoredAsset = { ...asset };
  if (patch.tags !== undefined) {
    next.tags = Array.from(new Set(patch.tags.map((t) => t.trim()).filter(Boolean)));
  }
  if (patch.projectId !== undefined) {
    next.projectId = patch.projectId || null;
  }
  if (patch.prompt !== undefined && typeof patch.prompt === "string") {
    next.prompt = patch.prompt;
  }
  if (patch.favorited !== undefined) {
    next.favorited = Boolean(patch.favorited);
  }
  await fs.writeFile(metaPath, JSON.stringify(next, null, 2), "utf-8");
  return next;
}

// Soft-delete: moves the asset file + meta into the trash dir with a
// `deletedAt` stamp. Replaces the previous hard delete; users who want a
// permanent removal call permanentlyDeleteFromTrash after restoring the
// item or use the Trash dashboard's "delete forever" action.
export async function deleteAsset(id: string): Promise<boolean> {
  await ensureDirs();
  const metaPath = path.join(META_DIR, `${id}.json`);
  let asset: StoredAsset | null = null;
  try {
    asset = JSON.parse(await fs.readFile(metaPath, "utf-8")) as StoredAsset;
  } catch {
    return false;
  }

  // Move the image file. If it's already missing (e.g. partial state from
  // a previous failure) we still proceed so the meta gets cleaned up.
  const srcImage = path.join(IMAGES_DIR, asset.fileName);
  const dstImage = path.join(TRASH_IMAGES_DIR, asset.fileName);
  await fs.rename(srcImage, dstImage).catch(() => {});

  const trashed: TrashedAsset = {
    ...asset,
    url: `/generations/trash/images/${asset.fileName}`,
    deletedAt: new Date().toISOString(),
  };
  await fs.writeFile(
    path.join(TRASH_META_DIR, `${id}.json`),
    JSON.stringify(trashed, null, 2),
    "utf-8"
  );
  await fs.unlink(metaPath).catch(() => {});
  return true;
}

// --- Trash ----------------------------------------------------------------

// Auto-purges entries older than TRASH_TTL_DAYS and returns the live ones.
// Newest-first so the dashboard leads with the most recent regrets.
export async function listTrash(): Promise<TrashedAsset[]> {
  await ensureDirs();
  await purgeOldTrash(TRASH_TTL_DAYS);
  const files = await fs.readdir(TRASH_META_DIR).catch(() => [] as string[]);
  const out: TrashedAsset[] = [];
  for (const f of files) {
    if (!f.endsWith(".json")) continue;
    try {
      out.push(
        JSON.parse(
          await fs.readFile(path.join(TRASH_META_DIR, f), "utf-8")
        ) as TrashedAsset
      );
    } catch {
      // Skip corrupt entries silently.
    }
  }
  return out.sort((a, b) => b.deletedAt.localeCompare(a.deletedAt));
}

// Returns the restored StoredAsset (sans deletedAt, with images/ url
// rewritten) so the caller can splice it back into the active list.
export async function restoreFromTrash(id: string): Promise<StoredAsset | null> {
  await ensureDirs();
  const trashMetaPath = path.join(TRASH_META_DIR, `${id}.json`);
  let trashed: TrashedAsset;
  try {
    trashed = JSON.parse(
      await fs.readFile(trashMetaPath, "utf-8")
    ) as TrashedAsset;
  } catch {
    return null;
  }
  await fs
    .rename(
      path.join(TRASH_IMAGES_DIR, trashed.fileName),
      path.join(IMAGES_DIR, trashed.fileName)
    )
    .catch(() => {});

  // Spread the trashed shape and strip `deletedAt` with rest destructuring
  // — TS treats deletedAt as a required field on TrashedAsset, so a
  // `delete` operator wouldn't compile under strictNullChecks.
  const { deletedAt: _deletedAt, ...stripped } = trashed;
  void _deletedAt;
  const restored: StoredAsset = {
    ...stripped,
    url: `/generations/images/${trashed.fileName}`,
  };

  await fs.writeFile(
    path.join(META_DIR, `${id}.json`),
    JSON.stringify(restored, null, 2),
    "utf-8"
  );
  await fs.unlink(trashMetaPath).catch(() => {});
  return restored;
}

// Permanent delete from trash. The caller is expected to confirm — there is
// no second-chance recovery after this.
export async function permanentlyDeleteFromTrash(id: string): Promise<boolean> {
  await ensureDirs();
  const metaPath = path.join(TRASH_META_DIR, `${id}.json`);
  let trashed: TrashedAsset | null = null;
  try {
    trashed = JSON.parse(
      await fs.readFile(metaPath, "utf-8")
    ) as TrashedAsset;
  } catch {
    return false;
  }
  await fs.unlink(metaPath).catch(() => {});
  if (trashed?.fileName) {
    await fs.unlink(path.join(TRASH_IMAGES_DIR, trashed.fileName)).catch(() => {});
  }
  return true;
}

// Hard-deletes any trashed asset whose deletedAt is older than `maxDays`.
// Called automatically at the start of listTrash() so the operator never
// has to think about cleanup, and exported so the dashboard "empty trash"
// action can also use it.
export async function purgeOldTrash(maxDays: number): Promise<number> {
  await ensureDirs();
  const cutoff = Date.now() - maxDays * 24 * 60 * 60 * 1000;
  const files = await fs.readdir(TRASH_META_DIR).catch(() => [] as string[]);
  let purged = 0;
  for (const f of files) {
    if (!f.endsWith(".json")) continue;
    try {
      const trashed = JSON.parse(
        await fs.readFile(path.join(TRASH_META_DIR, f), "utf-8")
      ) as TrashedAsset;
      const t = new Date(trashed.deletedAt).getTime();
      if (Number.isFinite(t) && t < cutoff) {
        await fs.unlink(path.join(TRASH_META_DIR, f)).catch(() => {});
        await fs
          .unlink(path.join(TRASH_IMAGES_DIR, trashed.fileName))
          .catch(() => {});
        purged += 1;
      }
    } catch {
      // Skip unreadable entries.
    }
  }
  return purged;
}

export async function emptyTrash(): Promise<number> {
  // Pass 0 days to nuke everything regardless of age.
  return purgeOldTrash(0);
}

// --- Uploads (user reference library) ------------------------------------

// Persists a user-uploaded reference image: copies the bytes into
// public/generations/uploads/ (so it can be served as a thumbnail) AND
// records its fal storage URL (so it can be passed directly to /api/generate
// later without re-uploading). The two-URL model lets the picker stay fast
// (local serving) while keeping fal as the source of truth for inference.
export async function saveUpload(opts: {
  buffer: Buffer;
  originalName: string;
  contentType: string;
  remoteUrl: string;
  width?: number;
  height?: number;
}): Promise<UploadedAsset> {
  await ensureDirs();
  const id = randomBytes(8).toString("hex");
  const ext = extFromContentType(
    opts.contentType,
    extFromUrl(opts.originalName)
  );
  const fileName = `${id}.${ext}`;
  await fs.writeFile(path.join(UPLOADS_DIR, fileName), opts.buffer);

  const meta: UploadedAsset = {
    id,
    fileName,
    localUrl: `/generations/uploads/${fileName}`,
    remoteUrl: opts.remoteUrl,
    originalName: opts.originalName,
    contentType: opts.contentType,
    width: opts.width,
    height: opts.height,
    size: opts.buffer.length,
    uploadedAt: new Date().toISOString(),
  };
  await fs.writeFile(
    path.join(UPLOADS_META_DIR, `${id}.json`),
    JSON.stringify(meta, null, 2),
    "utf-8"
  );
  return meta;
}

export async function listUploads(): Promise<UploadedAsset[]> {
  await ensureDirs();
  const files = await fs.readdir(UPLOADS_META_DIR).catch(() => [] as string[]);
  const out: UploadedAsset[] = [];
  for (const f of files) {
    if (!f.endsWith(".json")) continue;
    try {
      const raw = await fs.readFile(path.join(UPLOADS_META_DIR, f), "utf-8");
      out.push(JSON.parse(raw) as UploadedAsset);
    } catch {
      // Skip unreadable / corrupted entries silently — same convention as
      // listAssets. The user can clean these up in the dashboard.
    }
  }
  // Newest first so the picker leads with the user's most recent uploads.
  return out.sort((a, b) => b.uploadedAt.localeCompare(a.uploadedAt));
}

export async function deleteUpload(id: string): Promise<boolean> {
  await ensureDirs();
  const metaPath = path.join(UPLOADS_META_DIR, `${id}.json`);
  let meta: UploadedAsset | null = null;
  try {
    meta = JSON.parse(await fs.readFile(metaPath, "utf-8")) as UploadedAsset;
  } catch {
    return false;
  }
  await fs.unlink(metaPath).catch(() => {});
  if (meta?.fileName) {
    await fs.unlink(path.join(UPLOADS_DIR, meta.fileName)).catch(() => {});
  }
  return true;
}
