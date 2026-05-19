# Changelog

All notable changes to **Frame** are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/); the project
adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

Unreleased work lives at the top under `## [Unreleased]`; cut a release by
moving those items under a new dated `## [vX.Y.Z]` heading and pushing the
matching `vX.Y.Z` git tag (the `release` workflow handles GHCR + GitHub
release from there).

## [Unreleased]

## [1.0.0] - 2026-05-19

Initial public release.

### Studio

- Generate images via OpenAI GPT Image 2 on fal.ai (swappable model).
- Image-edit mode with up to 4 reference images, mask URL support, and
  `@image1` mentions inside the prompt.
- Outpaint to extend any image's canvas in any direction.
- Upscale through one of four built-in models (Real-ESRGAN, AuraSR, Clarity,
  Creative) with per-model live cost estimates.
- Smart edit: click an object in a reference, SAM 3 segments it, then
  Remove or Edit in one click.
- Inpaint brush: paint a mask on a source image directly in-browser.
- Side-by-side compare (2–4 images) with optional A/B slider mode.
- Concurrent batches (max 4), per-batch skeleton card with a live timer.
- Failed-card UX: failures stay in the grid with Retry / Edit / Delete.
- Variations: "more like this" button re-runs the same prompt with a fresh
  seed.
- Negative prompt support (model-dependent).
- Prompt history with prefix autocomplete (Tab to insert, Esc to dismiss).
- Reference cropping with aspect presets; result re-uploads automatically.
- Reference picker now offers either fresh upload OR pick-from-previous.

### Layout

- Two studio layouts: classic left **sidebar** + a wide **floating dock**
  (90 vw) with prompt expand toggle and char/token counter.
- Sidebar's settings modal split into tabs (General, Workspace, Features,
  Theme) with a first-run preset wizard (Basic / Medium / Advanced /
  Custom).

### Library

- Local-first storage: every generation lands in `public/generations/`
  with a JSON sidecar, no database.
- Projects + tags + full-text prompt search.
- Multi-select with Compare / Add-as-references / Bulk delete.
- Drag-and-drop assets into the references picker.
- Reuse: load an asset's prompt, size, quality, and references back into
  the studio panel.
- **Trash** — deletes are soft and recoverable for 30 days; auto-purged
  after that. Dashboard "Trash" section surfaces everything with restore
  / delete-forever actions.
- **Uploads library** — every uploaded reference is persisted; pickable
  again later without re-uploading. Managed via the Uploads dashboard.

### Theming

- `design.md`-format themes live in `src/themes/`. Each is a markdown
  file with YAML frontmatter; drop one in and register it in
  `src/lib/themes.ts`. Ships with Midnight, Ember, Paper, Pastel Candy.
- Customizable app title (also seeds the logo mark).

### Dashboard

- Overview (asset + cost + project stats, fal account credit balance).
- Models (register custom upscale / generation models per-browser).
- Uploads (manage persisted reference library).
- Trash (30-day recovery view).
- Documentation (in-app docs covering tech stack, AI agent guide, models,
  workflows, theming, deployment, FAQ).

### Security / OSS

- Password gate (optional via `APP_PASSWORD`) with HMAC-signed session
  cookies and constant-time compare.
- In-memory sliding-window rate limit in `proxy.ts` (10 logins / 10 min,
  60 API calls / min per IP).
- Server-side model allowlist; non-built-in fal model ids require
  `ALLOW_CUSTOM_FAL_MODELS=true`.
- Upload route caps file size at 25 MiB and rejects non-image MIME types.
- ESLint flat config (Next 16 / react-hooks v7 with new noisy rules
  downgraded to warnings, documented as tech debt).
- README, CONTRIBUTING, SECURITY, AGENTS-friendly doc page.
- Version badge surfaced in both the studio top bar and the dashboard
  sidebar; click to copy `vX.Y.Z · <sha>`.

[Unreleased]: https://github.com/FollowMarcos/framegen/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/FollowMarcos/framegen/releases/tag/v1.0.0
