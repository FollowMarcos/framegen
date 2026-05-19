# Porting the GPT Image 2 generator to Vercel + Cloudflare R2 + Supabase

This document captures everything we built in this local project (`te`) and explains exactly what needs to change to drop the same generator into a project hosted on **Vercel**, with **Cloudflare R2** for object storage and **Supabase** for the database / auth.

> **Important difference from the local app:** the ported version is **bring-your-own-API-key (BYOK)**. There is no password gate and no shared `FAL_KEY` on the server. Each end user supplies their own fal.ai API key in the UI; every fal call is authenticated with *that user's* key, not yours. See §7 for how that's wired.

---

## 1. What we built (recap)

A private, password-gated Next.js 16 app that wraps two OpenAI GPT Image 2 endpoints on fal.ai:

| Mode         | Model                       | Input                                       | Output   |
|--------------|-----------------------------|---------------------------------------------|----------|
| Text → image | `openai/gpt-image-2`        | text prompt                                 | image(s) |
| Image edit   | `openai/gpt-image-2/edit`   | text + N image URLs + optional `mask_url`   | image(s) |

### Local architecture

```
Browser
  │  (password cookie set by /api/auth/login)
  ▼
proxy.ts ──► verifies signed HMAC cookie → blocks anonymous traffic
  │
  ▼
Next.js API routes (Node runtime)
  │
  ├─ /api/upload          → fal.storage.upload(file)            (file → fal URL)
  ├─ /api/generate/image  → fal.subscribe(MODELS.image, ...)    (text → image)
  ├─ /api/generate/edit   → fal.subscribe(MODELS.imageEdit, ...) (image+text [+mask] → image)
  └─ /api/generations     → list / delete saved assets
  │
  ▼
Storage layer (lib/storage.ts)
  • downloads fal output to public/generations/images/<id>.<ext>
  • writes a JSON sidecar to public/generations/meta/<id>.json
  • served at /generations/... because it lives under public/
```

### Key design choices worth keeping

1. **Server-side fal calls only.** `FAL_KEY` never leaves the server. The client only ever talks to our own API routes. *(In the ported version this becomes per-request, see §7.)*
2. **Persist the original fal CDN URL** (`fal.media/...`) alongside the local file. Useful if you later add "re-edit this image" without re-uploading; otherwise harmless metadata.
3. **One thin endpoint per generation type**, plus one storage abstraction. The UI never knows where files actually live.
4. **Password gate runs in middleware** (`proxy.ts` in Next 16). Both pages and `/api/*` are denied for unauthenticated traffic — there's no "API is forgotten about" hole. *(Dropped in the ported version — see §7.)*

---

## 2. Mapping local → Vercel + R2 + Supabase

| Concern              | Local app (this project)                                | Target stack                                                                  |
|----------------------|---------------------------------------------------------|-------------------------------------------------------------------------------|
| Compute              | `next dev` on your machine                              | Vercel serverless / fluid compute (Node runtime)                              |
| Generated files      | `public/generations/...` on disk                        | **Cloudflare R2 bucket** (S3-compatible API)                                  |
| Public URL for files | `/generations/...` served by Next from `public/`        | R2 public bucket via **custom domain**, or short-lived **signed GET URLs**     |
| Asset metadata       | One JSON sidecar per asset                              | **Supabase Postgres** table (`generations`)                                   |
| Auth                 | Single shared password, HMAC-signed cookie via `proxy.ts` | None added by this generator. Use whatever the parent project already has (or anonymous + localStorage). |
| fal.ai credentials   | Shared `FAL_KEY` server env var                         | **Bring-your-own-key (BYOK).** User pastes their own fal key in the UI; sent per request. |
| Gallery query        | `fs.readdir(meta/)`                                     | `select * from generations [where user_id = auth.uid()]` (only if you have auth) |
| Secrets              | `.env.local`                                            | Vercel project env vars (encrypted) — no fal key needed                       |

The shape of every API route (input, output JSON, error handling) stays the same. The only files that meaningfully change are:

- `src/lib/storage.ts` — write to R2 instead of disk; record in Supabase
- `src/lib/auth.ts` + `src/proxy.ts` — defer to Supabase session instead of a custom HMAC cookie
- `src/app/page.tsx` — pulls history from Supabase via a server component or `/api/generations`

---

## 3. Why local-disk writes won't work on Vercel

Vercel serverless functions have a read-only filesystem at runtime, except for `/tmp` which is ephemeral and not shared across invocations. So:

- You **cannot** write to `public/generations/...` after deploy. `public/` is baked into the build at deploy time.
- You **cannot** rely on `/tmp` to persist anything between requests (different invocations, different filesystems).

Therefore: all writes must go to **R2** (the durable store) and the path your UI displays must be either:
- A public R2 URL behind a custom domain (`https://cdn.yourapp.com/images/abc.jpg`), or
- A signed URL fetched on demand from your API.

---

## 4. The Supabase schema you'll need

One table, plus RLS:

```sql
create table public.generations (
  id              text primary key,                 -- `${timestamp}-${rand}` (same format as local app)
  user_id         uuid references auth.users (id) on delete cascade,  -- nullable if you don't have auth
  storage_key     text not null,                    -- R2 object key, e.g. "<user_id>/images/abc.png"
  content_type    text,
  width           int,
  height          int,
  prompt          text not null,
  model           text not null,                    -- e.g. "openai/gpt-image-2" or ".../edit"
  remote_url      text,                             -- the fal.media CDN URL the file came from
  extras          jsonb,                            -- image_size, quality, source_image_count, has_mask, etc
  created_at      timestamptz not null default now()
);

create index generations_user_created_idx on public.generations (user_id, created_at desc);

-- Only enable RLS if you've got Supabase Auth in the parent project.
alter table public.generations enable row level security;

create policy "users see only their own generations"
  on public.generations for select
  using (auth.uid() = user_id);

create policy "users insert their own generations"
  on public.generations for insert
  with check (auth.uid() = user_id);

create policy "users delete their own generations"
  on public.generations for delete
  using (auth.uid() = user_id);
```

Notes:

- We swap the local `fileName + url` fields for a single **R2 `storage_key`**. The public URL is derived (`https://<cdn-domain>/<storage_key>`) or signed at read time.
- Same `id` format keeps log lines and any future migration sane.
- `user_id` is **nullable** so the generator works whether or not the parent project has Supabase Auth. If you do have auth, set it from `auth.uid()`; if you don't, leave it null and consider scoping by an anonymous client id stored in localStorage.
- RLS is what makes "shared Supabase project, separate users" safe by default — only useful if you have auth.

---

## 5. Cloudflare R2 setup

You only need three things:

1. **A bucket.** e.g. `myapp-generations`.
2. **An API token** with read/write on that bucket. R2 exposes an S3-compatible endpoint at `https://<account_id>.r2.cloudflarestorage.com`.
3. **A public hostname** if you want browsers to load files directly without signed URLs. Either:
   - Attach a custom domain to the bucket (`cdn.yourapp.com`), or
   - Enable R2's `*.r2.dev` public URL (fine for dev, not great for prod).

If you'd rather keep the bucket private, skip the public domain and have your API return short-lived signed GET URLs (`@aws-sdk/s3-request-presigner`) — but understand: every gallery render will need a fresh signed URL per asset, which is a tiny extra request.

Env vars to add on Vercel:

```
R2_ACCOUNT_ID=...
R2_ACCESS_KEY_ID=...
R2_SECRET_ACCESS_KEY=...
R2_BUCKET=myapp-generations
R2_PUBLIC_BASE=https://cdn.yourapp.com    # omit if using signed URLs
```

---

## 6. Replacement `storage.ts` (R2 + Supabase)

This is the surgical change. Drop-in replacement for the local file-and-JSON version:

The version below accepts an optional `userId` and writes it through to Supabase. Pass `null` if your parent project doesn't have auth.

```ts
// src/lib/storage.ts
import { S3Client, PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { randomBytes } from "node:crypto";
import { createServerSupabase } from "@/lib/supabase-server"; // standard Supabase server helper

const s3 = new S3Client({
  region: "auto",
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
});

const BUCKET = process.env.R2_BUCKET!;
const PUBLIC_BASE = process.env.R2_PUBLIC_BASE; // optional

export type StoredAsset = {
  id: string;
  storageKey: string;
  url: string;          // public URL or signed URL, depending on setup
  remoteUrl?: string;
  width?: number;
  height?: number;
  contentType?: string;
  prompt: string;
  model: string;
  createdAt: string;
  extras?: Record<string, unknown>;
};

function extFromContentType(ct: string | undefined, fallback: string) {
  if (!ct) return fallback;
  if (ct.includes("png")) return "png";
  if (ct.includes("webp")) return "webp";
  if (ct.includes("jpeg") || ct.includes("jpg")) return "jpg";
  return fallback;
}

function publicUrlFor(key: string) {
  if (PUBLIC_BASE) return `${PUBLIC_BASE}/${key}`;
  // If you keep the bucket private, return a signed URL here instead.
  return `/api/asset?key=${encodeURIComponent(key)}`;
}

export async function downloadAndSave(opts: {
  remoteUrl: string;
  userId?: string | null;             // null if your project doesn't have auth
  contentType?: string;
  prompt: string;
  model: string;
  width?: number;
  height?: number;
  extras?: Record<string, unknown>;
}): Promise<StoredAsset> {
  const supabase = await createServerSupabase();

  // 1. Download the asset from fal.media
  const res = await fetch(opts.remoteUrl);
  if (!res.ok) throw new Error(`fal fetch failed: ${res.status}`);
  const buffer = Buffer.from(await res.arrayBuffer());
  const ct = opts.contentType ?? res.headers.get("content-type") ?? undefined;
  const ext = extFromContentType(ct, "png");

  // 2. Upload to R2
  const id = `${Date.now()}-${randomBytes(4).toString("hex")}`;
  const owner = opts.userId ?? "anonymous";
  const storageKey = `${owner}/images/${id}.${ext}`;

  await s3.send(
    new PutObjectCommand({
      Bucket: BUCKET,
      Key: storageKey,
      Body: buffer,
      ContentType: ct,
      // CacheControl: "public, max-age=31536000, immutable",
    })
  );

  // 3. Insert metadata in Supabase
  const row = {
    id,
    user_id: opts.userId ?? null,
    storage_key: storageKey,
    content_type: ct,
    width: opts.width,
    height: opts.height,
    prompt: opts.prompt,
    model: opts.model,
    remote_url: opts.remoteUrl,
    extras: opts.extras ?? null,
  };
  const { error } = await supabase.from("generations").insert(row);
  if (error) throw error;

  return {
    id,
    storageKey,
    url: publicUrlFor(storageKey),
    remoteUrl: opts.remoteUrl,
    width: opts.width,
    height: opts.height,
    contentType: ct,
    prompt: opts.prompt,
    model: opts.model,
    createdAt: new Date().toISOString(),
    extras: opts.extras,
  };
}

export async function listAssets(): Promise<StoredAsset[]> {
  const supabase = await createServerSupabase();
  const { data, error } = await supabase
    .from("generations")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;

  return (data ?? []).map((r) => ({
    id: r.id,
    storageKey: r.storage_key,
    url: publicUrlFor(r.storage_key),
    remoteUrl: r.remote_url ?? undefined,
    width: r.width ?? undefined,
    height: r.height ?? undefined,
    contentType: r.content_type ?? undefined,
    prompt: r.prompt,
    model: r.model,
    createdAt: r.created_at,
    extras: (r.extras as Record<string, unknown>) ?? undefined,
  }));
}

export async function deleteAsset(id: string): Promise<boolean> {
  const supabase = await createServerSupabase();
  const { data, error } = await supabase
    .from("generations")
    .delete()
    .eq("id", id)
    .select("storage_key")
    .maybeSingle();
  if (error) return false;
  if (!data) return false;
  await s3.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: data.storage_key })).catch(() => {});
  return true;
}

```

The rest of the route handlers (`/api/generate/image`, `/api/generate/edit`, `/api/generations`) are **unchanged** — they only ever go through `downloadAndSave` / `listAssets` / `deleteAsset`. That's the whole point of the abstraction.

Install deps:
```
npm install @aws-sdk/client-s3
```
(Optional, only if you want signed URLs:)
```
npm install @aws-sdk/s3-request-presigner
```

---

## 7. Bring-your-own fal.ai key (BYOK)

**No password gate. No shared server-side `FAL_KEY`.** Each user supplies their own fal.ai API key in the UI. Everything else flows the same.

### Where the key lives

Recommended: **client-side only, in `localStorage`, sent as a request header on every API call.** Never persisted in Supabase, never reaches your DB.

```
[Settings page]
   ├─ <input> "fal.ai API key" → saved to localStorage["fal_key"]
   └─ "Test" button → calls a cheap fal endpoint to verify
        │
[Any generate call from the UI]
   └─ fetch("/api/generate/image", {
        headers: {
          "Content-Type": "application/json",
          "X-Fal-Key": localStorage.getItem("fal_key") ?? "",
        },
        body: JSON.stringify({ prompt, ... }),
      })
```

### Server-side: read the key per request

Drop `FAL_KEY` from `lib/fal.ts`. Replace the module-level `fal.config({ credentials: process.env.FAL_KEY })` with a per-request configuration helper:

```ts
// src/lib/fal.ts
import { fal } from "@fal-ai/client";

export const MODELS = {
  image: "openai/gpt-image-2",
  imageEdit: "openai/gpt-image-2/edit",
} as const;

export function getFalForRequest(request: Request) {
  const key = request.headers.get("x-fal-key");
  if (!key) {
    const err = new Error("missing fal.ai API key — open settings and paste your key");
    (err as Error & { status?: number }).status = 401;
    throw err;
  }
  // fal.config is module-global; reconfigure per call. Safe under serverless
  // because each function invocation is isolated.
  fal.config({ credentials: key });
  return fal;
}
```

Then every generate route changes its single fal-getter line:

```ts
// before:  const fal = getFal();
// after:   const fal = getFalForRequest(request);
```

…and catches the 401 case explicitly so the UI can prompt the user to set a key:

```ts
} catch (err) {
  const status = (err as { status?: number }).status ?? 500;
  const message = err instanceof Error ? err.message : "generation failed";
  return NextResponse.json({ error: message }, { status });
}
```

### Frontend: a tiny settings store

```ts
// src/lib/falKey.ts
const KEY = "fal_key";
export const getFalKey = () => (typeof window === "undefined" ? "" : localStorage.getItem(KEY) ?? "");
export const setFalKey = (v: string) => localStorage.setItem(KEY, v.trim());
export const clearFalKey = () => localStorage.removeItem(KEY);

export function falHeaders(extra?: Record<string, string>): HeadersInit {
  return { "Content-Type": "application/json", "X-Fal-Key": getFalKey(), ...extra };
}
```

Use `falHeaders()` everywhere a generate call is made. Add a small settings drawer or modal where the user pastes their key.

### Why not persist the key in Supabase?

You can, but you take on real custody risk: you need a KMS-managed encryption key on the server, and a credible compromise story. Pushing the key into `localStorage` keeps you out of that loop — *the user* owns the key, your code only forwards it. If your parent project already has a credentialed secrets store, by all means use it; otherwise, BYOK + localStorage is the lowest-blast-radius option.

### Anonymous use vs. logged-in use

- **If the parent project has Supabase Auth**, pass the logged-in user's id into `downloadAndSave({ userId: user.id })` so each user only sees their own gallery (`generations.user_id = auth.uid()` via RLS).
- **If it doesn't**, omit `userId`. The gallery shows all generations to anyone who knows the URL. For a personal/internal tool that's fine; for anything public, gate it however the parent project already gates its own pages.

No middleware (`proxy.ts`) needed from this generator. Inherit whatever the parent project does.

---

## 8. Vercel function configuration

Two things to watch out for:

### a) Function timeout
GPT Image 2 generation runs from ~10 s on `quality: "low"` up to ~60 s on `"high"` with `num_images > 1`. Vercel's default function timeout is short. Set per-route:

```ts
// src/app/api/generate/image/route.ts and /api/generate/edit/route.ts
export const runtime = "nodejs";
export const maxDuration = 300; // seconds — bumps to fluid-compute limit
```

The Hobby plan caps at 60 s — which is *probably* enough but cutting it close. Pro / Fluid Compute gives you the full headroom.

If you're stuck on Hobby and start hitting the cap: switch to fal's queue API (`fal.queue.submit` + `fal.queue.status` + `fal.queue.result`) instead of `fal.subscribe`. The route returns immediately with a queue id; the UI polls a `/api/generations/:id/status` endpoint until it's `COMPLETED`.

### b) Body size
The `/api/upload` route accepts image files via `FormData`. Vercel's default body limit is 4.5 MB on Hobby, 100 MB on Pro+. If users will upload phone photos, prefer a **direct-to-R2 upload from the browser** using a pre-signed PUT URL:

```
Browser ──(1)──► /api/upload-url  → returns presigned PUT URL + final key
Browser ──(2)──► PUT directly to R2 (bypasses Vercel)
Browser ──(3)──► /api/generate/edit with the public R2 URL in image_urls
```

If the R2 bucket is public, you can skip fal storage entirely on the server side — pass the R2 public URL straight into the edit endpoint's `image_urls`.

---

## 9. "Re-edit this image" without re-upload (optional)

GPT Image 2's edit endpoint takes `image_urls` — URLs fal's servers can fetch. If you let users edit a previously generated image from the library, you want the fal call to be a single request, not "download from R2 → re-upload to fal storage → call edit."

Two clean paths, in order of preference:

1. **R2 public bucket.** If `R2_PUBLIC_BASE` is set, the asset's public URL is already a stable, fal-reachable URL. Just pass `publicUrlFor(asset.storage_key)` directly into `image_urls` on the edit call. No re-upload, ever, and R2 URLs don't expire the way `fal.media` URLs do.
2. **Cached `remote_url` with fallback.** If R2 is private, try the stored `remote_url` first; verify with a `HEAD`; on miss, read the bytes from R2 (`@aws-sdk/client-s3` GetObject) and upload them to fal storage:

```ts
// inside /api/generate/edit, when the user picked a library asset by id rather than uploading
async function resolveSourceUrl(asset: { storage_key: string; remote_url?: string }): Promise<string> {
  if (PUBLIC_BASE) return `${PUBLIC_BASE}/${asset.storage_key}`;
  if (asset.remote_url) {
    const head = await fetch(asset.remote_url, { method: "HEAD" });
    if (head.ok) return asset.remote_url;
  }
  const { GetObjectCommand } = await import("@aws-sdk/client-s3");
  const res = await s3.send(new GetObjectCommand({ Bucket: BUCKET, Key: asset.storage_key }));
  const chunks: Buffer[] = [];
  for await (const c of res.Body as AsyncIterable<Buffer>) chunks.push(c);
  const file = new File([Buffer.concat(chunks)], `${asset.storage_key}`, { type: res.ContentType || "image/png" });
  return await getFalForRequest(/* request */).storage.upload(file);
}
```

Skip this whole section if your UI only ever edits freshly-uploaded files.

---

## 10. Env vars summary (Vercel project settings)

```
# Cloudflare R2
R2_ACCOUNT_ID=...
R2_ACCESS_KEY_ID=...
R2_SECRET_ACCESS_KEY=...
R2_BUCKET=...
R2_PUBLIC_BASE=https://cdn.yourapp.com    # optional, if bucket is public

# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://<project>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
# Only needed if you do admin-style operations server-side. Never expose.
SUPABASE_SERVICE_ROLE_KEY=...
```

**No fal.ai key, no password.** The fal key is per-user, stored in the browser, sent on each request (see §7). Don't set `FAL_KEY` server-side — if you do, you're paying for everyone's generations.

---

## 11. Files to copy as-is from this project

The following files are stack-agnostic and port cleanly with zero changes:

- `src/app/api/generate/image/route.ts` *(one-line change to use `getFalForRequest(request)`)*
- `src/app/api/generate/edit/route.ts` *(same)*
- `src/app/api/upload/route.ts` — keep, but it now needs `getFalForRequest` too; or replace with direct-to-R2 uploads (see §8b)
- `src/components/Shell.tsx`, `AssetCard.tsx`, `ImagePicker.tsx`, `fields.tsx`
- `src/components/panels/GeneratePanel.tsx`, `EditPanel.tsx` *(update each `fetch(...)` to use `falHeaders()` from §7)*

The files that **change meaningfully**:

- `src/lib/fal.ts` — drop module-global config; export `getFalForRequest(request)` (§7)
- `src/lib/storage.ts` — R2 + Supabase replacement; `userId` is an explicit param (§6)
- `src/app/api/generations/route.ts` — internally identical (now backed by Supabase via `listAssets`)

The files to **delete** (no longer needed):

- `src/proxy.ts` — no password gate
- `src/lib/auth.ts` — no HMAC cookie
- `src/app/login/page.tsx` — no login screen
- `src/app/api/auth/login/route.ts`
- `src/app/api/auth/logout/route.ts`

New files to add:

- `src/lib/falKey.ts` — tiny `localStorage` helper (§7)
- `src/lib/supabase-server.ts` — standard `@supabase/ssr` server client
- A settings UI (drawer / modal / page) where the user pastes & saves their fal.ai key

---

## 12. Order of work, when you're ready

1. **Provision** the R2 bucket, then run the SQL from §4 in your Supabase project.
2. **Copy** the unchanged files from §11.
3. **Replace** `src/lib/fal.ts` with the BYOK version (§7) and `src/lib/storage.ts` with the R2 + Supabase version (§6).
4. **Add** `src/lib/falKey.ts` and a settings UI where the user pastes their fal key.
5. **Delete** the password / auth / login files listed in §11.
6. **Wire** every fetch from the panels through `falHeaders()` so `X-Fal-Key` rides along.
7. **Set** R2 + Supabase env vars in Vercel (§10). Do **not** set `FAL_KEY`.
8. **Bump** `maxDuration` on `/api/generate/image` and `/api/generate/edit` — GPT Image 2 at `quality: "high"` can take 30–60s.
9. **Deploy.** Verify: paste key in settings → generate image → edit it (with and without a mask) → reload to confirm the gallery hydrates from Supabase. Then clear localStorage and confirm calls 401 with a helpful message.
10. **Decide** later whether to switch `/api/upload` to direct-to-R2 (§8b) — only matters once people are uploading big inputs.

---

## 13. Risks and gotchas, ranked

1. **Function timeouts** are the single biggest porting risk. GPT Image 2 at `quality: "high"` is the slow path; budget for ~60s and set `maxDuration` accordingly. Vercel's Hobby cap is 60s — Fluid Compute on Pro buys you more.
2. **BYOK key handling.** Sending `X-Fal-Key` over HTTPS is fine in transit, but the key sits in `localStorage` and in browser memory. That's accessible to any XSS that lands in the parent project. Mitigations: strict CSP, no third-party scripts on the page that shows / uses the key, mark the input `autocomplete="off"`, and never log the header. The key never reaches your Supabase or your logs.
3. **fal CDN URL expiry** — assume hours, not days. The `remote_url` column is a hint; always have the R2 copy to fall back on. Don't store fal URLs as the primary path.
4. **RLS** — easy to forget when you bypass Supabase auth with the service-role key on the server. If you ever query with the service role, *manually filter by `user_id`*; RLS doesn't apply.
5. **No accidental shared `FAL_KEY`.** If anyone on the team sets `FAL_KEY` server-side "just for testing", the server will silently fall back to it and you'll be paying every user's bill. Either don't read `process.env.FAL_KEY` at all (recommended), or guard it behind `if (process.env.NODE_ENV !== "production")`.
6. **OpenAI content filters** are applied upstream by GPT Image 2 itself; fal passes the rejection through. You can't toggle them. Surface fal's error message directly to the user so they understand why.
7. **R2 public bucket leakage.** If your bucket is public and `storage_key` follows a predictable pattern (`<user_id>/...`), one user could guess another user's keys. Either keep the bucket private + signed URLs, or use a random component in the key.
8. **Cost is no longer your problem (mostly).** With BYOK each user pays fal directly. But R2 egress / Supabase rows / Vercel function time *are* still on you, so a per-IP or per-session rate limit is still worth adding.
