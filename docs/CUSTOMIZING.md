# Customizing te · studio

This doc walks through the kinds of changes a fork is most likely to make. Each section names the exact file(s) to edit, what to change, and what to watch out for.

---

## Swap the generation model

`te` uses `openai/gpt-image-2` by default. Any fal model that follows the "prompt + image_urls + mask_url" shape works as a drop-in.

**File:** [src/lib/fal.ts](../src/lib/fal.ts)

```ts
export const MODELS = {
  image: "openai/gpt-image-2",        // text → image
  imageEdit: "openai/gpt-image-2/edit", // image(s) + prompt → image
} as const;
```

Replace with your model paths. The route at [src/app/api/generate/route.ts](../src/app/api/generate/route.ts) calls `fal.subscribe(model, { input })` — if your new model has a different input schema (different field names, extra required fields), edit that route too.

Two things to check when swapping:

- **Mask support.** GPT Image 2 takes `mask_url`. If your model doesn't, the inpaint brush and outpaint flows will silently degrade. Either disable them in the UI or pass the mask differently.
- **`image_size` shape.** GPT Image 2 accepts `"auto"` or `{ width, height }`. If your model only takes one form, sanitize the value before forwarding.

## Add a new upscale model

You have two paths: **add at runtime via the Dashboard** (no code, no rebuild) or **add to the built-in registry** (more control, fits if you're shipping a fork).

### Runtime (the user-facing path)

Open the Dashboard (chart icon in the top bar) → "custom upscale models" → "add". Paste the fal model id, give it a display name, fill in pricing. Stored in localStorage; merged into the model picker automatically.

Custom models use a generic input shape (`image_url` + `upscale_factor` + `scale`). That works for most fal upscalers; ones with mandatory extra params (e.g. mask, prompt, model variant) need the in-code path below.

### Built-in (the fork path)

**File:** [src/lib/upscaleModels.ts](../src/lib/upscaleModels.ts)

Append an entry to `UPSCALE_MODELS`:

```ts
{
  id: "fal-ai/your-upscaler",
  name: "Your Upscaler",
  description: "What it's good at.",
  qualityHint: "balanced",                    // "basic" | "balanced" | "premium"
  factor: { allowed: [2, 4], default: 2 },
  pricing: { kind: "per_mp", usdPerMP: 0.02 }, // or { kind: "per_second", usdPerSecond: 0.001, estimateSeconds: 8 }
},
```

Then teach [src/app/api/upscale/route.ts](../src/app/api/upscale/route.ts) how to build the input for your model — add a `case` to the `switch (modelId)` block. Most fal upscalers take some combination of `image_url`, `upscale_factor`, `scale`, and a quality preset. Copy the shape from one of the existing cases and adjust field names. Unmatched ids fall through to the generic shape used by runtime-added models.

The UI picks up the new model automatically — `UpscaleModal` reads `UPSCALE_MODELS` and renders one row per entry with the cost estimator from the same module.

## Change the size matrix or aspect ratios

**File:** [src/lib/sizes.ts](../src/lib/sizes.ts)

The matrix is computed: `aspect ratios × resolution tiers`, with the long edge driven by the tier. To add an aspect ratio:

```ts
const ASPECTS: Aspect[] = [
  // ...existing
  { id: "panoramic", label: "panoramic · 21:9", ratioW: 21, ratioH: 9 },
];
```

To change tier sizes:

```ts
const TIER_LONG_EDGE: Record<ResolutionTier, number> = {
  "1k": 1024,
  "2k": 2048,
  "4k": 3840,
};
```

All computed dimensions round to multiples of 16 to satisfy fal's image-size constraint. Don't exceed 3840 on the long edge (fal will reject it).

## Theme colors

**File:** [src/app/globals.css](../src/app/globals.css)

Two blocks define every color: `@theme` (for Tailwind class generation) and `:root` (for direct `var()` use). They must stay in sync — Tailwind v4 with `@theme` plus arbitrary-value classes occasionally races on initial paint, so both blocks define the same values. Change them in pairs.

```css
@theme {
  --color-accent: #a78bfa;   /* the brand purple */
  --color-bg: #0a0a0b;
  /* ... */
}
:root {
  --color-accent: #a78bfa;
  --color-bg: #0a0a0b;
  /* ... */
}
```

Common changes:

- **Brand color** — swap `--color-accent` and `--color-accent-hover` in both blocks.
- **Make it light mode** — flip the bg/fg pairs and the muted scale. The whole UI uses semantic variables, so this is a 6-line change.

## Disable the password gate

The gate is **off** by default. Setting `APP_PASSWORD` in `.env.local` turns it on; clearing it turns it off again. No code changes needed.

The relevant logic is in [src/proxy.ts](../src/proxy.ts):

```ts
const passwordRequired = Boolean(process.env.APP_PASSWORD);
if (!passwordRequired) {
  // gate is bypassed; /login redirects to /
  return NextResponse.next();
}
```

When you do turn it on, also set `AUTH_SECRET` (a 32-byte hex string) so the session cookie can be signed. Generate one with:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

## Dashboard

The Dashboard (chart icon, top bar) is a small panel that shows:

- Library counts and all-time estimated spend (using the pricing table in [src/lib/pricing.ts](../src/lib/pricing.ts) — only "priced" sizes are counted; the rest surface as `+N unpriced`).
- Per-model, per-project, per-tag breakdowns (horizontal bar charts).
- Custom upscale model manager (see above).

It's entirely client-side — no new server endpoints. All stats are derived from the same `assets` array the library renders.

## Reuse

Every library card and the Lightbox have a **reuse** button. It re-uploads the asset's stored reference + mask images to fal storage, then prefills the studio panel with the asset's prompt, size, quality, and mask. Implemented in [src/lib/reuse.ts](../src/lib/reuse.ts) (`prepareReuse`).

The prefill flows through `StudioPanel`'s `prefill` prop, which carries a monotonically increasing `token` so React applies each prefill exactly once. If you add fields to the studio panel you want reusable, extend `StudioPrefill` and the `useEffect` block that applies it.

## Adjust concurrency, references, or library defaults

**File:** [src/app/page.tsx](../src/app/page.tsx)

Top of the file:

```ts
export const MAX_CONCURRENT = 4;   // simultaneous in-flight generations
export const MAX_REFERENCES = 4;   // images per generate request
```

Lower these for cost control, raise them if your fal plan allows it. Note: `image_urls` cap for the edit model is set by fal, not us.

## Add a snippet on first run

Snippets live in `localStorage`, but if you want defaults shipped with your fork, seed them on the first render.

**File:** [src/lib/snippets.ts](../src/lib/snippets.ts) — add a `seedDefaults()` function that calls `saveSnippet()` once if `listSnippets()` returns empty. Wire it into the `useEffect` in [src/components/panels/StudioPanel.tsx](../src/components/panels/StudioPanel.tsx) that already loads snippets.

## Where downloads come from

Downloads don't serve the raw file from `public/generations/`. They go through [src/app/api/download/route.ts](../src/app/api/download/route.ts) which re-encodes via sharp to strip metadata. If you want the raw bytes preserved (e.g. to keep PNG text chunks for forensics), change the anchor `href` on the AssetCard and Lightbox download buttons back to `asset.url`.

## Where generated files live

```
public/generations/
├── images/              <- the actual image files Next serves at /generations/images/...
├── meta/<id>.json       <- one sidecar per asset (prompt, model, tags, project, extras)
├── sources/<batch>/     <- reference images + mask snapshots for each generation
└── projects.json        <- list of named projects
```

[src/lib/storage.ts](../src/lib/storage.ts) is the single touchpoint. To swap disk for S3/R2/Supabase, replace the read/write functions there. The rest of the codebase only calls `downloadAndSave`, `listAssets`, `updateAssetMeta`, `deleteAsset`, and `saveSourcesForBatch`. See [`docs/PORTING_TO_VERCEL_R2_SUPABASE.md`](PORTING_TO_VERCEL_R2_SUPABASE.md) for a fuller sketch of that.

## Add a new API route

API routes go under [src/app/api/](../src/app/api/). The patterns we follow:

- Always `export const runtime = "nodejs";` (sharp + fs need it; Edge runtime won't work).
- Long-running routes set `export const maxDuration = 300;`.
- Read fal credentials via `getFal()` from [src/lib/fal.ts](../src/lib/fal.ts) — never read `process.env.FAL_KEY` directly.
- Persist outputs with `downloadAndSave()`; inherit project + tags from the source asset when applicable.

## Common pitfalls

- **fal CDN URLs expire.** Don't store them as primary references — we keep them in `remoteUrl` as a hint only. Source-of-truth is the file on disk under `public/generations/`.
- **`@theme` variables can race on first paint.** Keep them mirrored in `:root` (the file already does this). When in doubt, hardcode the color inline with `style={{ backgroundColor: "#111114" }}` — see the popovers.
- **Native `<button>` children block parent drag.** The library cards use a div-with-role-button on purpose so drag-and-drop can initiate from the image area. Don't replace it with a real button.
- **Sharp on Windows requires a build toolchain** if it falls back to compiling. The prebuilt binary usually loads cleanly; if it doesn't, `npm rebuild sharp` is the first thing to try.

## What would be a good first PR

If you're looking to contribute back to the upstream:

- A new upscale model (small, contained change).
- A new aspect-ratio entry.
- A theme variant (e.g. light mode) shipped as a flag.
- A new fal generation model added behind a `MODELS.alt` constant + a switcher in the UI.

Larger changes (auth provider integration, S3 backend, multi-user mode) are interesting but stretch the local-first thesis — open an issue to discuss first.
