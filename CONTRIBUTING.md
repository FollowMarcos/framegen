# Contributing

Thanks for taking a look. This project is a small, single-author tool first
and an open-source project second — so contributions that keep the codebase
focused are easier to merge than wide refactors. Treat this guide as a
description of the current expectations; nothing here is rigid.

## Local setup

```bash
git clone https://github.com/FollowMarcos/framegen.git
cd frame
cp .env.example .env.local   # fill in FAL_ADMIN_KEY and AUTH_SECRET
npm install
npm run dev
```

Open <http://localhost:3000>. The app needs:

- A fal.ai account and an Admin-scope API key (set as `FAL_ADMIN_KEY`).
- A long random string for `AUTH_SECRET` (used to sign session cookies).
- Optionally `APP_PASSWORD` if you want the password gate enabled.

See `README.md` for the full env-var reference.

## Scripts

| Script             | What it does                                             |
| ------------------ | -------------------------------------------------------- |
| `npm run dev`      | Next.js dev server with Turbopack                        |
| `npm run build`    | Production build (uses `output: "standalone"`)           |
| `npm run start`    | Run the production build                                 |
| `npm run lint`     | ESLint (flat config in `eslint.config.mjs`)              |
| `npm run typecheck`| `tsc --noEmit` — type-only check, faster than build      |

Before opening a PR, please run **both** `npm run lint` and `npm run build`.
CI runs the same.

## Code style

- TypeScript strict mode is on. Use explicit types on exported functions; let
  inference handle locals.
- React 19, function components only. No class components.
- Tailwind v4 with `@theme` tokens — read from CSS variables (`var(--color-*)`)
  rather than hardcoding hex values, so the design.md theme system keeps
  working.
- Keep files under ~300 lines where possible. The biggest existing files
  (`src/app/page.tsx`, `src/components/Lightbox.tsx`,
  `src/components/dashboard/DocsSection.tsx`) are due for splitting — PRs
  that carve out cohesive chunks are welcome.

## What we don't optimize for

- **Backwards compatibility shims.** This is a personal-use app; if a setting
  shape changes, change the localStorage key and move on.
- **Hypothetical extension points.** Add abstractions when the second caller
  exists, not when you can imagine one.
- **Test coverage targets.** There are no unit tests yet. New code doesn't
  need to ship with tests, but tests for known-tricky logic
  (`src/lib/designMd.ts`, `src/lib/storage.ts`) would be welcome additions.

## Known tech debt

Things flagged by ESLint as warnings, deliberately not fixed in this pass:

- `react-hooks/set-state-in-effect`, `react-hooks/refs`, `react-hooks/purity` —
  new in react-hooks v7. Several existing patterns (data fetch on mount,
  derived-state initialization) trip them. A future PR can migrate to the
  recommended patterns.
- A few `react-hooks/exhaustive-deps` warnings where the dep list is
  intentionally narrowed.
- The five biggest components (`page.tsx`, `Lightbox.tsx`, `DocsSection.tsx`,
  `StudioPanel.tsx`, `InpaintBrush.tsx`) are over the soft 300-line target.

## Filing issues

For bugs: please include a repro, the URL or page where it happened, and the
console output if any.

For feature requests: a short paragraph on what you want and why beats a
detailed design — happy to discuss before code lands.

## Security

Please don't file security issues as GitHub issues. See `SECURITY.md`.

## Cutting a release

The `release` workflow (`.github/workflows/release.yml`) fires on any
`vX.Y.Z` git tag, builds a multi-arch Docker image to GHCR, and publishes
a GitHub release with notes pulled from `CHANGELOG.md`. To cut one:

1. Move the `## [Unreleased]` items in `CHANGELOG.md` under a new
   `## [vX.Y.Z] - YYYY-MM-DD` heading. Add a fresh empty `[Unreleased]`
   section above it.
2. Bump `version` in `package.json`. The version badge in the UI reads
   from there, so it'll update on next build.
3. Commit, tag, push:
   ```bash
   git commit -am "release vX.Y.Z"
   git tag vX.Y.Z
   git push --follow-tags
   ```
4. Watch the `release` workflow. When it's green you'll have:
   - `ghcr.io/<owner>/<repo>:vX.Y.Z` + `:X.Y` + `:latest`
   - A GitHub Release with the changelog section as the body

Semver: anything user-facing breaking → major. Feature flags / new
opt-ins behind defaults-off toggles → minor. Bug fixes + docs → patch.
