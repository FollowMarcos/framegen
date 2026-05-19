# Frame

**Open Source AI Image Generator.** Runs on your machine, saves everything to your disk, uses [fal.ai](https://fal.ai) as the inference backend (default model: OpenAI GPT Image 2, but swappable).

No accounts. No cloud. No database. Your images live in `public/generations/` and nowhere else.

[![ci](https://github.com/FollowMarcos/framegen/actions/workflows/ci.yml/badge.svg)](https://github.com/FollowMarcos/framegen/actions/workflows/ci.yml)
[![release](https://img.shields.io/github/v/release/FollowMarcos/framegen?label=release)](https://github.com/FollowMarcos/framegen/releases/latest)
[![docker](https://img.shields.io/badge/ghcr.io-framegen-blue?logo=docker)](https://github.com/FollowMarcos/framegen/pkgs/container/framegen)
[![license: MIT](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)
[![ko-fi](https://img.shields.io/badge/ko--fi-support-FF5E5B?logo=kofi&logoColor=white)](https://ko-fi.com/meltenx)

> Status: works well as a personal tool. The codebase is intentionally small and forks are welcome.

---

## Demo

<!--
  TODO before publishing: drop a real demo GIF + screenshots at the paths
  below. Suggested capture: 800px wide, ~15s loop showing prompt → generate
  → reuse → variations. Until then GitHub will render the alt text as a
  placeholder, which is good enough to ship.
-->

![Frame in action](docs/media/demo.gif)

<details>
<summary>More screenshots</summary>

| Studio (sidebar) | Studio (dock) |
|---|---|
| ![sidebar layout](docs/media/sidebar.png) | ![dock layout](docs/media/dock.png) |

| Compare slider | Dashboard |
|---|---|
| ![A/B compare](docs/media/compare.png) | ![dashboard overview](docs/media/dashboard.png) |

</details>

---

## What it does

**Generation**
- **Generate** images from text. **Edit** with reference images, masks, or `@image1` mentions in the prompt.
- **Click-to-segment** any object in a source (SAM 3) and Remove / Edit it in one click.
- **Paint masks** directly on a canvas with a brush + eraser.
- **Outpaint** to extend an image's canvas in any direction.
- **Upscale** through one of four models (Real-ESRGAN, AuraSR, Clarity, Creative) with live cost estimates per model.
- **Compare** 2–4 generations side-by-side.
- **Concurrent batches** — fire up to 4 in flight, each with a labeled skeleton + live timer.

**Editor** ([/editor](http://localhost:3000/editor))
- **Layered canvas** built on Konva — base image + text + image overlays + emoji stickers.
- **Non-destructive adjustments** (exposure, contrast, saturation, temperature, tint, sharpen, rotate) with live CSS-filter preview and baked-in export.
- **Text effects** — drop shadow, outline, neon, sticker, glow, long shadow — 8 preset chips with live previews.
- **24 self-hosted Google Fonts** grouped by category (sans, serif, display, handwriting, mono); no third-party CDN.
- **Twemoji stickers** picker with 9 categories + search.
- **Zoom + pan** (⌘/Ctrl + scroll, hold Space to drag, ⌘0/⌘1/⌘±) and a keyboard shortcut sheet.
- **Three-layer persistence** — React state → localStorage drafts → server-side JSON, with offline divergence detection on reload.

**Post composer**
- One-click "Post" on any generation/upload opens a focused composer.
- **Aspect**: Original (default, image's natural ratio) + Square, Portrait, Landscape, Story.
- **Filters**: 13 CSS-baked presets (Crisp, Vivid, Drama, Warm, Cool, Cream, Faded, Dreamy, Vintage, Moody, Mono, Noir).
- **Export PNG** + **Web Share API** for mobile native share sheet.

**Library + workflow**
- **Organize** with projects, tags, full-text search.
- **Snippets** — save reusable prompt fragments, recall with `/`.
- **Library actions** — drag-and-drop into references, multi-select for bulk delete or bulk reference, "use as reference" from any library card.
- **Metadata-stripped downloads** — every download goes through a sharp re-encode that wipes EXIF, prompt-in-PNG-chunks, and color profiles.

## Quick start

```bash
git clone <your-fork-url> frame
cd frame
npm install
cp .env.example .env.local
# fill in FAL_ADMIN_KEY and AUTH_SECRET in .env.local
npm run dev
```

Open <http://localhost:3000>.

### Required env vars

| Variable                    | Required | What it does                                                                 |
| --------------------------- | -------- | ---------------------------------------------------------------------------- |
| `FAL_ADMIN_KEY`             | Yes      | fal.ai Admin-scope API key. `FAL_KEY` is accepted as a legacy fallback.      |
| `AUTH_SECRET`               | Yes      | Random string used to sign session cookies. `openssl rand -hex 32`.          |
| `APP_PASSWORD`              | Optional | Enables the password gate. Leave unset for localhost-only use.               |
| `ALLOW_CUSTOM_FAL_MODELS`   | Optional | `true` to permit non-built-in fal model ids. See [SECURITY.md](SECURITY.md). |

### Run with Docker (no Node needed)

Use the prebuilt multi-arch image from GitHub Container Registry:

```bash
cp .env.example .env.local
# paste your FAL_ADMIN_KEY + AUTH_SECRET into .env.local

docker run --rm -p 3000:3000 \
  --env-file .env.local \
  -v "$(pwd)/public/generations:/app/public/generations" \
  ghcr.io/FollowMarcos/framegen:latest
```

Or build locally with the shipped compose file:

```bash
cp .env.example .env.local
docker compose up
```

Generations persist to `./public/generations` on the host via a volume mount.

> Tagged versions land at `ghcr.io/FollowMarcos/framegen:vX.Y.Z` after each release.
> See [CHANGELOG.md](CHANGELOG.md) for the version history.

## Configuration

All knobs live in a handful of files:

| What | Where |
|---|---|
| Generation model | [src/lib/fal.ts](src/lib/fal.ts) (`MODELS`) |
| Upscale model registry + pricing | [src/lib/upscaleModels.ts](src/lib/upscaleModels.ts) |
| Size matrix (1k / 2k / 4k × aspects) | [src/lib/sizes.ts](src/lib/sizes.ts) |
| Themes (design.md format) | [src/themes/](src/themes/) + [src/lib/designMd.ts](src/lib/designMd.ts) |
| Pricing table (cost tracker) | [src/lib/pricing.ts](src/lib/pricing.ts) |
| Concurrent-batch cap | `MAX_CONCURRENT` in [src/app/page.tsx](src/app/page.tsx) |
| Reference cap | `MAX_REFERENCES` in [src/app/page.tsx](src/app/page.tsx) |

See [docs/CUSTOMIZING.md](docs/CUSTOMIZING.md) for walkthroughs (swap the generation model, add a new upscaler, change the theme, etc.).

## How it's built

- **Next.js 16** (App Router, Turbopack) on the Node runtime.
- **React 19**, **Tailwind 4**, **Geist** font.
- **fal.ai** for all inference (`@fal-ai/client`).
- **sharp** for server-side image work (download stripping, outpaint compositing).
- **SAM 3** (`fal-ai/sam-3/image`) for click-to-segment.
- Generations save under `public/generations/` so Next serves them directly from disk — no separate file server, no S3, no DB.

## Project layout

```
src/
├── app/
│   ├── api/         <- /generate, /upscale, /outpaint, /segment, /upload, /download, ...
│   └── page.tsx     <- main library + StudioPanel composition
├── components/      <- AssetCard, Lightbox, OutpaintModal, InpaintBrush, etc.
└── lib/             <- fal.ts, storage.ts, sizes.ts, projects.ts, snippets.ts, ...
public/
└── generations/     <- generated images + metadata sidecars (gitignored)
```

## Where files live on disk

```
public/generations/
├── images/                  <- generated outputs (.png / .jpg / .webp)
├── meta/                    <- one .json sidecar per asset (prompt, model, tags, project, ...)
├── sources/<batch-id>/      <- reference images + masks used to produce a generation
├── uploads/                 <- persisted reference-image library
├── trash/                   <- soft-deleted assets with 30-day TTL
└── projects.json            <- list of named projects

public/editor/
├── docs/                    <- one .json per editor document
└── thumbs/                  <- flattened PNG previews for the dashboard listing
```

## Local-first by design

This is meant to run on **your machine** and only your machine. The whole storage model (writing to `public/`, using `process.cwd()`, no DB) assumes:

- A single user.
- A writable filesystem.
- A long-running server process.

That means **don't deploy this to Vercel as-is** — their serverless functions have a read-only filesystem and `public/` is baked at build time. If you want a hosted version, you'd need to swap `lib/storage.ts` to use S3/R2 + a database (see [`docs/PORTING_TO_VERCEL_R2_SUPABASE.md`](docs/PORTING_TO_VERCEL_R2_SUPABASE.md) for a sketch).

## Support the project

Frame is free and open-source. If it's been useful to you and you'd like to help keep it maintained, a coffee goes a long way:

[☕ ko-fi.com/meltenx](https://ko-fi.com/meltenx)

No paywalls, no telemetry, no upsells — just one-off donations from people who like what they're using.

## License

[MIT](LICENSE). Fork, modify, ship — please remove any references to me if you redistribute.
