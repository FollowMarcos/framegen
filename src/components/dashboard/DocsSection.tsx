"use client";

import { useEffect, useRef, useState } from "react";
import { BookOpen, ChevronDown, PanelLeftClose, PanelLeftOpen, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";

const COLLAPSE_KEY = "frame.docsCollapsed.v1";

type DocPageId =
  | "getting-started"
  | "quickstart"
  | "tech-stack"
  | "ai-agents"
  | "models"
  | "snippets"
  | "smart-edit"
  | "outpaint"
  | "upscale"
  | "projects-tags"
  | "shortcuts"
  | "privacy"
  | "theming"
  | "concurrency"
  | "deploy"
  | "faq";

const PAGES: { id: DocPageId; group: string; title: string }[] = [
  { id: "getting-started", group: "Getting started", title: "Welcome" },
  { id: "quickstart", group: "Getting started", title: "Quickstart" },
  { id: "tech-stack", group: "Getting started", title: "Tech stack" },
  { id: "ai-agents", group: "Getting started", title: "Using with AI agents" },
  { id: "models", group: "Models", title: "Adding models" },
  { id: "snippets", group: "Models", title: "Prompt snippets" },
  { id: "smart-edit", group: "Workflows", title: "Smart edit (SAM 3)" },
  { id: "outpaint", group: "Workflows", title: "Outpainting" },
  { id: "upscale", group: "Workflows", title: "Upscaling" },
  { id: "projects-tags", group: "Library", title: "Projects & tags" },
  { id: "shortcuts", group: "Reference", title: "Keyboard shortcuts" },
  { id: "privacy", group: "Reference", title: "Privacy & storage" },
  { id: "theming", group: "Reference", title: "Theming" },
  { id: "concurrency", group: "Reference", title: "Concurrency & pagination" },
  { id: "deploy", group: "Reference", title: "Deploying" },
  { id: "faq", group: "Reference", title: "FAQ" },
];

export function DocsSection() {
  const [page, setPage] = useState<DocPageId>("getting-started");
  const [collapsed, setCollapsed] = useState(false);
  const [popoverOpen, setPopoverOpen] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);

  // Persist the collapsed state so it survives section/page navigation.
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      setCollapsed(localStorage.getItem(COLLAPSE_KEY) === "1");
    } catch {
      // ignore
    }
  }, []);

  // Click-outside + Escape to close the floating contents popover (only used
  // when the sidebar is collapsed).
  useEffect(() => {
    if (!popoverOpen) return;
    function onDown(e: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setPopoverOpen(false);
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setPopoverOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [popoverOpen]);

  function setCollapsedPersistent(next: boolean) {
    setCollapsed(next);
    try {
      localStorage.setItem(COLLAPSE_KEY, next ? "1" : "0");
    } catch {
      // ignore
    }
  }

  // Group pages for the sub-nav.
  const grouped = PAGES.reduce<Record<string, typeof PAGES>>((acc, p) => {
    (acc[p.group] ??= []).push(p);
    return acc;
  }, {});

  const currentPage = PAGES.find((p) => p.id === page);

  // Inline nav block — reused by the persistent sidebar AND the floating
  // popover when collapsed. Either rendering shows the same content with
  // identical interactions.
  const navList = (
    <nav className="space-y-4">
      {Object.entries(grouped).map(([group, pages]) => (
        <div key={group}>
          <div className="text-[10px] uppercase tracking-[0.08em] font-semibold text-[var(--color-muted)] mb-1.5 px-2">
            {group}
          </div>
          <ul className="space-y-0.5">
            {pages.map((p) => {
              const active = p.id === page;
              return (
                <li key={p.id}>
                  <button
                    type="button"
                    onClick={() => {
                      setPage(p.id);
                      setPopoverOpen(false);
                    }}
                    className={cn(
                      "w-full text-left px-2 h-7 rounded text-[12px] transition-colors truncate",
                      active
                        ? "bg-[var(--color-accent-dim)] text-[var(--color-fg)]"
                        : "text-[var(--color-muted)] hover:text-[var(--color-fg-dim)] hover:bg-[var(--color-surface)]"
                    )}
                    title={p.title}
                  >
                    {p.title}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );

  return (
    <div
      className={cn(
        "grid gap-6 min-h-full transition-[grid-template-columns] duration-200",
        collapsed ? "grid-cols-[1fr]" : "grid-cols-[220px_1fr]"
      )}
    >
      {!collapsed && (
        <aside className="border-r border-[var(--color-border)] sticky top-0 self-start pr-4">
          <div className="flex items-center justify-between mb-4 gap-2">
            <h1 className="inline-flex items-center gap-2 text-[14px] font-semibold tracking-tight">
              <BookOpen className="size-3.5 text-[var(--color-muted)]" />
              Documentation
            </h1>
            <button
              type="button"
              onClick={() => setCollapsedPersistent(true)}
              className="size-7 rounded-md grid place-items-center text-[var(--color-muted)] hover:text-[var(--color-fg)] hover:bg-[var(--color-surface)] transition"
              aria-label="hide contents sidebar"
              title="hide contents"
            >
              <PanelLeftClose className="size-3.5" />
            </button>
          </div>
          {navList}
        </aside>
      )}

      <article className="relative min-w-0">
        {/* Floating "Contents" trigger — only shown when the persistent
            sidebar is hidden. Doubles as a current-page indicator (group +
            title) so the user keeps context even without the sidebar. */}
        {collapsed && (
          <div
            ref={popoverRef}
            className="sticky top-0 z-20 -mt-2 pt-2 pb-3 mb-4 bg-[var(--color-bg)]"
          >
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setCollapsedPersistent(false)}
                className="size-8 grid place-items-center rounded-md text-[var(--color-muted)] hover:text-[var(--color-fg)] hover:bg-[var(--color-surface)] border border-[var(--color-border)] transition"
                aria-label="pin contents sidebar"
                title="pin contents"
              >
                <PanelLeftOpen className="size-3.5" />
              </button>
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setPopoverOpen((v) => !v)}
                  aria-haspopup="menu"
                  aria-expanded={popoverOpen}
                  className={cn(
                    "h-8 inline-flex items-center gap-2 px-3 rounded-md border text-[12px] transition-colors",
                    popoverOpen
                      ? "bg-[var(--color-surface-hover)] border-[var(--color-border-strong)]"
                      : "bg-[var(--color-surface)] border-[var(--color-border)] hover:border-[var(--color-border-strong)]"
                  )}
                >
                  <span className="text-[10px] uppercase tracking-[0.08em] font-semibold text-[var(--color-muted)]">
                    {currentPage?.group ?? "Docs"}
                  </span>
                  <span className="text-[var(--color-muted-dim)]">·</span>
                  <span className="text-[var(--color-fg)] font-medium">
                    {currentPage?.title ?? "Documentation"}
                  </span>
                  <ChevronDown
                    className={cn(
                      "size-3.5 text-[var(--color-muted)] transition-transform",
                      popoverOpen && "rotate-180"
                    )}
                  />
                </button>

                {popoverOpen && (
                  <div
                    role="menu"
                    className="absolute left-0 top-full mt-1 z-30 w-[280px] max-h-[70vh] overflow-y-auto rounded-md border border-[var(--color-border)] shadow-xl p-3"
                    style={{ backgroundColor: "var(--color-bg-elevated)" }}
                  >
                    {navList}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* The prose column has its own max-width for line-length
            readability; the surrounding container is full-width so code
            blocks, tables, and diagrams can break out as needed. */}
        <div className="prose-like max-w-[920px]">{renderPage(page)}</div>
      </article>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Content
// ---------------------------------------------------------------------------

function renderPage(id: DocPageId): React.ReactNode {
  switch (id) {
    case "getting-started":
      return <GettingStarted />;
    case "quickstart":
      return <Quickstart />;
    case "tech-stack":
      return <TechStack />;
    case "ai-agents":
      return <AiAgents />;
    case "models":
      return <Models />;
    case "snippets":
      return <Snippets />;
    case "smart-edit":
      return <SmartEdit />;
    case "outpaint":
      return <Outpaint />;
    case "upscale":
      return <Upscale />;
    case "projects-tags":
      return <ProjectsTags />;
    case "shortcuts":
      return <Shortcuts />;
    case "privacy":
      return <Privacy />;
    case "theming":
      return <Theming />;
    case "concurrency":
      return <Concurrency />;
    case "deploy":
      return <Deploy />;
    case "faq":
      return <FAQ />;
    default:
      return null;
  }
}

// Reusable typography helpers — kept inline so all docs share one look.
function H1({ children }: { children: React.ReactNode }) {
  return <h1 className="text-[20px] font-semibold tracking-tight mb-2">{children}</h1>;
}
function Lede({ children }: { children: React.ReactNode }) {
  return <p className="text-[13px] text-[var(--color-muted)] leading-relaxed mb-6">{children}</p>;
}
function H2({ children }: { children: React.ReactNode }) {
  return <h2 className="text-[14px] font-semibold tracking-tight mt-8 mb-2">{children}</h2>;
}
function P({ children }: { children: React.ReactNode }) {
  return <p className="text-[12.5px] text-[var(--color-fg-dim)] leading-relaxed mb-3">{children}</p>;
}
function Code({ children }: { children: React.ReactNode }) {
  return (
    <code className="font-mono text-[11.5px] px-1 py-0.5 rounded bg-[var(--color-surface)] border border-[var(--color-border)]">
      {children}
    </code>
  );
}
function Pre({ children }: { children: React.ReactNode }) {
  return (
    <pre className="font-mono text-[11.5px] leading-relaxed rounded-md bg-[var(--color-surface)] border border-[var(--color-border)] p-3 overflow-x-auto mb-3">
      {children}
    </pre>
  );
}
function Ul({ children }: { children: React.ReactNode }) {
  return <ul className="text-[12.5px] text-[var(--color-fg-dim)] leading-relaxed mb-3 list-disc pl-5 space-y-1">{children}</ul>;
}
function Callout({ tone = "info", children }: { tone?: "info" | "warn"; children: React.ReactNode }) {
  return (
    <div
      className={cn(
        "rounded-md border px-3 py-2 mb-3 text-[12px] leading-relaxed",
        tone === "warn"
          ? "border-yellow-500/30 bg-yellow-500/5 text-[var(--color-fg-dim)]"
          : "border-[var(--color-accent)]/25 bg-[var(--color-accent)]/5 text-[var(--color-fg-dim)]"
      )}
    >
      {children}
    </div>
  );
}
function Link({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="text-[var(--color-accent)] hover:text-[var(--color-accent-hover)] inline-flex items-center gap-1 transition"
    >
      {children}
      <ExternalLink className="size-3" />
    </a>
  );
}

// ---------------------------------------------------------------------------
// Pages
// ---------------------------------------------------------------------------

function GettingStarted() {
  return (
    <>
      <H1>Welcome</H1>
      <Lede>
        te · studio is a local-first AI image studio. It runs on your machine, saves everything to
        your disk, and uses <Link href="https://fal.ai">fal.ai</Link> for inference. No accounts,
        no database, no cloud sync.
      </Lede>

      <H2>What this app does</H2>
      <Ul>
        <li>Generate images from text, or edit existing ones with references + masks.</li>
        <li>Click-to-segment and modify any object in a source.</li>
        <li>Outpaint, upscale, compare side-by-side.</li>
        <li>Organize by projects + tags, full-text search across prompts.</li>
        <li>Save reusable prompt snippets and recall them with <Code>/</Code>.</li>
      </Ul>

      <H2>The mental model</H2>
      <P>
        Every generation produces a file under <Code>public/generations/images/</Code> plus a JSON
        sidecar in <Code>public/generations/meta/</Code> capturing the prompt, model, dimensions,
        tags, and project. Library views are derived from those sidecars; deletions clean both
        files up.
      </P>

      <H2>Local-first means…</H2>
      <Ul>
        <li>One user, your machine.</li>
        <li>If you delete <Code>public/generations/</Code>, the library is gone.</li>
        <li>You don&apos;t need a database. You don&apos;t need the cloud.</li>
        <li>
          You <em>do</em> need a fal.ai API key. Sign up at{" "}
          <Link href="https://fal.ai">fal.ai</Link> and put the key in <Code>.env.local</Code>.
        </li>
      </Ul>
    </>
  );
}

function Quickstart() {
  return (
    <>
      <H1>Quickstart</H1>
      <Lede>From a fresh clone to a first generation in about five minutes.</Lede>

      <H2>1. Install</H2>
      <Pre>{`npm install
cp .env.example .env.local`}</Pre>

      <H2>2. Paste your fal key</H2>
      <P>
        Open <Code>.env.local</Code> and set <Code>FAL_KEY</Code> from the{" "}
        <Link href="https://fal.ai/dashboard/keys">fal dashboard</Link>. The other variables stay
        empty unless you want the password gate.
      </P>

      <H2>3. Run</H2>
      <Pre>npm run dev</Pre>

      <P>Open http://localhost:3000.</P>

      <Callout>
        Want to skip the toolchain? <Code>docker compose up</Code> after step 2 runs the same
        thing in a container. Images persist to <Code>./public/generations</Code>.
      </Callout>
    </>
  );
}

function TechStack() {
  return (
    <>
      <H1>Tech stack</H1>
      <Lede>
        Everything you need to know to fork, modify, and deploy. Versions track{" "}
        <Code>package.json</Code>; the major choices below are stable for the lifetime of
        the project.
      </Lede>

      <H2>Runtime</H2>
      <Ul>
        <li>
          <Code>node &gt;= 20</Code> — pinned in <Code>package.json</Code>{" "}
          <Code>engines</Code>. Required for the Node-runtime API routes that touch the
          filesystem.
        </li>
        <li>
          The proxy runs on <strong>Node runtime</strong> (Next.js 16 default for{" "}
          <Code>proxy.ts</Code>), not Edge — so <Code>node:crypto</Code> and the in-memory
          rate limiter both work.
        </li>
      </Ul>

      <H2>Framework & UI</H2>
      <Ul>
        <li>
          <Code>next@^16.2</Code> — App Router, Turbopack dev, <Code>output: &quot;standalone&quot;</Code>{" "}
          build for slim Docker images. Important: this project uses <Code>proxy.ts</Code>{" "}
          (renamed from <Code>middleware.ts</Code> in Next 16) — don&apos;t add a{" "}
          <Code>middleware.ts</Code> alongside it; the build will reject both.
        </li>
        <li>
          <Code>react@^19.2</Code> &amp; <Code>react-dom@^19.2</Code> — function components
          only. <Code>useSyncExternalStore</Code> backs the settings store so all consumers
          see live updates without prop drilling.
        </li>
        <li>
          <Code>tailwindcss@^4.3</Code> + <Code>@tailwindcss/postcss</Code> — the v4
          <Code>@theme</Code> directive in <Code>globals.css</Code> mirrors the runtime
          design-tokens onto Tailwind utilities. <strong>Never hardcode hex colors</strong>{" "}
          in components — read CSS variables (<Code>var(--color-fg)</Code>, etc.) so the
          theme system keeps working.
        </li>
        <li>
          <Code>geist</Code> via <Code>next/font/google</Code> — Sans + Mono variable fonts.
        </li>
        <li>
          <Code>lucide-react</Code> for iconography. <Code>clsx</Code> +{" "}
          <Code>tailwind-merge</Code> via the <Code>cn()</Code> helper in{" "}
          <Code>src/lib/utils.ts</Code>.
        </li>
      </Ul>

      <H2>Inference</H2>
      <Ul>
        <li>
          <Code>@fal-ai/client@^1.10</Code> — every model call goes through{" "}
          <Code>fal.subscribe()</Code> in <Code>src/lib/fal.ts</Code> using{" "}
          <Code>FAL_ADMIN_KEY</Code> (Admin scope — superset of API, also enables billing
          endpoints). <Code>FAL_KEY</Code> is accepted as a legacy fallback.
        </li>
        <li>
          Default models: <Code>openai/gpt-image-2</Code> (generate) and{" "}
          <Code>openai/gpt-image-2/edit</Code> (with refs). Upscalers: Real-ESRGAN, AuraSR,
          Clarity, Creative. SAM 3 for click-to-segment. All swappable.
        </li>
        <li>
          Model ids sent from the client are gated by{" "}
          <Code>src/lib/modelAllowlist.ts</Code>. Set{" "}
          <Code>ALLOW_CUSTOM_FAL_MODELS=true</Code> to permit non-built-in ids.
        </li>
      </Ul>

      <H2>Server-side image work</H2>
      <Ul>
        <li>
          <Code>sharp@^0.34</Code> — strips EXIF/PNG-chunk metadata on download
          (<Code>/api/download</Code>), composites outpaint canvas
          (<Code>/api/outpaint</Code>), and handles re-encodes.
        </li>
      </Ul>

      <H2>Storage</H2>
      <Ul>
        <li>
          <strong>Filesystem only.</strong> No database. Generated images go to{" "}
          <Code>public/generations/images/</Code>. Each asset has a JSON sidecar in{" "}
          <Code>public/generations/meta/</Code>. Reference images per batch live in{" "}
          <Code>public/generations/sources/&lt;batch-id&gt;/</Code>. Projects live in{" "}
          <Code>public/generations/projects.json</Code>.
        </li>
        <li>
          Per-browser settings (theme, app title, page size, snippets, custom models)
          live in <Code>localStorage</Code> under <Code>te.*</Code> keys.
        </li>
      </Ul>

      <H2>Auth & rate limiting</H2>
      <Ul>
        <li>
          <Code>APP_PASSWORD</Code> (optional) enables a password gate.{" "}
          <Code>AUTH_SECRET</Code> signs HMAC session cookies — required.
        </li>
        <li>
          In-memory sliding-window rate limit in <Code>src/proxy.ts</Code>: 10 logins / 10
          min and 60 API calls / min per IP. Single-process only — swap for Upstash or KV
          if you scale horizontally.
        </li>
      </Ul>

      <H2>Dev tools</H2>
      <Ul>
        <li>
          <Code>typescript@^6</Code> in strict mode. Path alias{" "}
          <Code>@/*</Code> → <Code>src/*</Code>.
        </li>
        <li>
          <Code>eslint@^9</Code> with <Code>eslint-config-next</Code> (flat config in{" "}
          <Code>eslint.config.mjs</Code>). React-hooks v7 rules{" "}
          <Code>set-state-in-effect</Code>, <Code>refs</Code>, <Code>purity</Code> are
          downgraded to warnings — see <Code>CONTRIBUTING.md</Code>.
        </li>
        <li>
          No test framework yet. <Code>npm run build</Code> and{" "}
          <Code>npm run lint</Code> must both pass before commit.
        </li>
      </Ul>

      <H2>What this stack rules out</H2>
      <Ul>
        <li>
          <strong>Vercel-as-is.</strong> Vercel&apos;s serverless functions have a
          read-only filesystem and <Code>public/</Code> is built into the image. To host on
          Vercel you&apos;d need to swap <Code>src/lib/storage.ts</Code> for S3/R2 + a
          database. See <Code>docs/PORTING_TO_VERCEL_R2_SUPABASE.md</Code> for a sketch.
        </li>
        <li>
          <strong>Multi-tenant.</strong> Everything assumes one operator. The password
          gate is the boundary; the local pricing cache is module-scoped; the rate limiter
          is per-process.
        </li>
      </Ul>
    </>
  );
}

function AiAgents() {
  return (
    <>
      <H1>Using with AI agents</H1>
      <Lede>
        Concrete instructions for AI coding assistants — Claude Code, Cursor, Codex,
        Aider, Continue. Paste the block below into the tool&apos;s context (system
        prompt, <Code>.cursorrules</Code>, <Code>CLAUDE.md</Code>, etc.) so the agent
        works <em>with</em> the codebase&apos;s conventions instead of against them.
      </Lede>

      <H2>The instruction block</H2>
      <P>
        Copy this into your AI tool. Trim to the parts that apply.
      </P>
      <Pre>{`You are working on Frame: an open-source local-first AI image generator.
Stack: Next.js 16 (App Router, Turbopack, Node runtime), React 19,
TypeScript strict, Tailwind v4, fal.ai for inference, sharp for
server-side image work. No database — everything is files in
public/generations/ + localStorage. See Documentation → Tech stack.

## Conventions to follow

- READ the relevant file in src/ before editing. Mimic the existing
  patterns: function components, named exports, top-level "use client"
  on interactive components, Node runtime on API routes that touch fs.
- COLORS: never hardcode hex values. Use CSS variables defined in
  globals.css: var(--color-bg), --color-fg, --color-accent,
  --color-fg-on-accent, --color-muted, --color-border, --color-danger,
  --color-success. The runtime theme system overrides these — hardcoded
  colors will break light themes.
- TAILWIND: v4 with @theme directive. Use arbitrary values like
  bg-[var(--color-surface)] for theme tokens.
- FILE WRITES at runtime go through src/lib/storage.ts. Never write to
  public/ from anywhere else.
- API ROUTES are in src/app/api/<name>/route.ts. Always:
    export const runtime = "nodejs";
    export const maxDuration = 300; // for fal calls
  Validate the body, call isAllowedModelId() for any user-supplied
  model string, surface fal errors via falErrorMessage() from
  src/lib/falError.ts.
- AUTH: src/proxy.ts gates everything. Don't add middleware.ts —
  Next 16 forbids both. Session cookies are HMAC-signed; never log
  AUTH_SECRET or FAL_ADMIN_KEY.
- RATE LIMITS: existing buckets in proxy.ts are per-IP, per-process.
  New fal-billed endpoints MUST be covered — add to the API_BUCKET
  matcher rather than minting a new bucket.

## Where things live

- src/app/api/**           server route handlers (Node runtime)
- src/app/page.tsx         studio + library (the main app)
- src/app/dashboard/       stats, models, docs
- src/components/          UI primitives + composite components
- src/components/panels/   StudioPanel (the generation form)
- src/lib/fal.ts           fal client + MODELS constants
- src/lib/storage.ts       filesystem layout for generations
- src/lib/storage helpers  ensureDirs, downloadAndSave, listAssets,
                            saveSourcesForBatch, updateAssetMeta
- src/lib/pricing.ts       authoritative GPT-Image-2 price table
- src/lib/pricingApi.ts    fal pricing API client + cache
- src/lib/themes.ts        design.md theme loader
- src/themes/*.ts          theme source files (design.md format)
- src/lib/settings.ts      useSettings() hook + Settings type
- src/lib/modelAllowlist.ts  server-side model id validator

## Adding things

- New theme: drop a design.md markdown string into src/themes/
  <slug>.ts (export default the string), then register it in
  src/lib/themes.ts THEME_SOURCES. Don't expand globals.css.
- New upscale model: add to UPSCALE_MODELS in src/lib/upscaleModels.ts
  AND to the switch in src/app/api/upscale/route.ts if it needs a
  custom input shape.
- New generation model: edit MODELS in src/lib/fal.ts or let the
  user add it via Dashboard → Models (custom registry).
- New API route: copy an existing one (e.g. src/app/api/upscale/
  route.ts) for the runtime/auth/rate-limit pattern.

## Commands

  npm run dev        Turbopack dev server on :3000
  npm run build      production build (standalone)
  npm run start      run the production build
  npm run lint       eslint .
  npm run typecheck  tsc --noEmit

Both lint and build must pass before commit. There are no tests yet.

## What NOT to do

- Don't add a database. Storage is intentionally local-first.
- Don't add Vercel-specific code. The fs-based design rules out
  Vercel-as-is; document trade-offs instead.
- Don't bypass isAllowedModelId() — it's the only thing stopping
  arbitrary model dispatch on the operator's fal account.
- Don't introduce React class components or Pages Router files.
- Don't add npm packages without justification — the dep list is
  intentionally small.
- Don't write JSON-mode prompts to fal expecting structured output;
  this is an image studio.`}</Pre>

      <H2>Tips per tool</H2>
      <Ul>
        <li>
          <strong>Claude Code</strong> — drop the block above into a{" "}
          <Code>CLAUDE.md</Code> at the repo root (project-level), or add it via{" "}
          <Code>/memorize</Code>. It will be loaded into every session.
        </li>
        <li>
          <strong>Cursor</strong> — paste into <Code>.cursorrules</Code> at the repo
          root. Add a follow-up rule: <Code>always run `npm run lint` after editing</Code>{" "}
          so you catch the react-hooks warnings.
        </li>
        <li>
          <strong>Codex / OpenAI Code Interpreter</strong> — open the file with the block
          and reference it: &quot;Follow the conventions in <Code>docs/AGENTS.md</Code>{" "}
          when editing this repo.&quot; Models like Codex respect explicit file
          references better than implicit context.
        </li>
        <li>
          <strong>Aider</strong> — drop into <Code>CONVENTIONS.md</Code> and add it via{" "}
          <Code>/add CONVENTIONS.md</Code>. Aider pins it into context for every diff.
        </li>
      </Ul>

      <H2>Useful read-only paths to expose</H2>
      <P>
        Most AI agents work better with a curated reading list than full repo access.
        Start with:
      </P>
      <Ul>
        <li>
          <Code>README.md</Code>, <Code>CONTRIBUTING.md</Code>, <Code>SECURITY.md</Code>
        </li>
        <li>
          <Code>src/lib/fal.ts</Code>, <Code>src/lib/storage.ts</Code>,{" "}
          <Code>src/lib/themes.ts</Code>, <Code>src/lib/settings.ts</Code>,{" "}
          <Code>src/lib/modelAllowlist.ts</Code>
        </li>
        <li>
          <Code>src/proxy.ts</Code> and one example route from{" "}
          <Code>src/app/api/</Code>
        </li>
        <li>
          <Code>eslint.config.mjs</Code> and <Code>package.json</Code>
        </li>
      </Ul>

      <Callout>
        Treat AI-generated patches as PRs from a junior contributor: run lint and build
        before merging. The react-hooks v7 warnings are downgraded but real — agents
        often introduce new ones; review them.
      </Callout>
    </>
  );
}

function Models() {
  return (
    <>
      <H1>Adding models</H1>
      <Lede>
        You can register additional fal models at runtime without rebuilding. Four kinds are
        supported.
      </Lede>

      <H2>Upscale models</H2>
      <P>Fully wired. Open Dashboard → Models → Add → kind = Upscale.</P>
      <P>
        Any fal upscale model that accepts <Code>image_url</Code> + either <Code>upscale_factor</Code>{" "}
        or <Code>scale</Code> will work. Custom models appear in the Upscale picker next to the
        built-in ones with their pricing estimate.
      </P>

      <H2>Image generation / edit models</H2>
      <P>
        Fully wired. The studio panel has a <strong>model picker</strong> in the Composition
        section that lists every applicable model for the current mode — text-to-image when
        there are no references, image-edit when there are. Built-ins come first (GPT Image 2),
        then your custom models.
      </P>
      <P>
        Each row in the picker shows a <strong>live cost estimate</strong> projected from
        fal&apos;s pricing API for the currently selected output size. Per-megapixel and
        per-image models compute exactly; per-second models show their billing unit instead.
      </P>
      <P>
        Custom image-gen models use a generic input shape (prompt + image_size + quality);
        anything model-specific (negative prompts, samplers, etc.) needs a code change in{" "}
        <Code>src/app/api/generate/route.ts</Code> to map the field names. The route accepts a{" "}
        <Code>model</Code> field on the request body that overrides the built-in default.
      </P>

      <H2>Video models</H2>
      <Callout tone="warn">
        Video generation isn&apos;t wired up in the UI yet. Adding a video model in the dashboard
        stores it for future use, but you can&apos;t generate video from the studio panel. See the
        FAQ for the rough shape of what&apos;d need to be built.
      </Callout>

      <H2>Built-in registry</H2>
      <P>
        If you&apos;re forking the project, the cleaner path for permanent additions is editing
        the registry directly. See <Code>src/lib/upscaleModels.ts</Code> for upscalers and{" "}
        <Code>src/lib/fal.ts</Code> for the generation model id constants.
      </P>

      <H2>Live pricing</H2>
      <P>
        Three places use fal&apos;s pricing API at runtime:
      </P>
      <Ul>
        <li>
          <strong>Studio panel model picker</strong> — every row shows the projected per-image
          cost for the currently selected output size.
        </li>
        <li>
          <strong>Upscale picker</strong> — same idea, rows with a published price show a small{" "}
          <Code>LIVE</Code> tag and override the hardcoded estimate.
        </li>
        <li>
          <strong>Dashboard Overview → per-model breakdown</strong> — totals per model use
          live pricing when fal has it published for that model, falling back to the hardcoded
          GPT Image 2 pricing table for the six published sizes. A small <Code>+</Code> next
          to the total means some assets were at unpriced sizes; the displayed number is a
          lower bound.
        </li>
      </Ul>
      <Callout>
        Pricing is fetched through{" "}
        <Code>/api/pricing</Code> server-side so your fal key stays out of the browser. Results
        are cached for an hour per endpoint id. When you add a custom model, the{" "}
        <strong>fetch pricing</strong> button calls the same endpoint and auto-fills the unit
        and rate.
      </Callout>
    </>
  );
}

function Snippets() {
  return (
    <>
      <H1>Prompt snippets</H1>
      <Lede>Reusable prompt fragments. Type <Code>/</Code> in the prompt to recall.</Lede>

      <H2>Saving a snippet</H2>
      <P>
        Click <em>snippets</em> under the prompt or hit the manage link inside the slash popover.
        The save form pre-fills with whatever&apos;s currently in the prompt box, so &quot;save
        current prompt as a snippet&quot; is a two-click action.
      </P>

      <H2>Inserting</H2>
      <P>
        Type <Code>/</Code> in the prompt. A popover lists matching snippets. ↑/↓ navigate, ↵ inserts.
      </P>

      <H2>Where they&apos;re stored</H2>
      <P>
        In <Code>localStorage</Code> under <Code>te.snippets.v1</Code>. They&apos;re per-browser
        and aren&apos;t synced across machines.
      </P>
    </>
  );
}

function SmartEdit() {
  return (
    <>
      <H1>Smart edit · click an object</H1>
      <Lede>
        Click any object in a source image to select it, then choose Remove or Edit. Powered by
        SAM 3 (<Code>fal-ai/sam-3/image</Code>) for the segmentation step and GPT Image 2&apos;s
        mask-aware edit endpoint for the actual change.
      </Lede>

      <H2>Workflow</H2>
      <Ul>
        <li>Attach a reference image to the studio panel.</li>
        <li>Click <em>smart edit · click an object</em>.</li>
        <li>Click on any object — a moment later, the mask appears as a tinted overlay.</li>
        <li>Pick <em>Remove</em> for clean removal, or <em>Edit…</em> to type a change.</li>
      </Ul>

      <H2>Why it works well</H2>
      <P>
        SAM produces precise segmentations, and GPT Image 2&apos;s mask support means the edit is
        constrained to exactly that region — the rest of the image stays untouched.
      </P>
    </>
  );
}

function Outpaint() {
  return (
    <>
      <H1>Outpainting · expand the canvas</H1>
      <Lede>Extend an image in any direction. GPT Image 2 fills the new area.</Lede>

      <H2>How it works internally</H2>
      <Ul>
        <li>The source is composited onto a larger transparent canvas.</li>
        <li>A binary mask is built: white in the new area, black over the source.</li>
        <li>Both are pushed to fal storage and sent to the edit endpoint.</li>
        <li>The model fills only the masked (white) area.</li>
      </Ul>

      <H2>Picking directions</H2>
      <P>
        The 3×3 grid lets you toggle which sides to extend. The amount selector controls how far —
        25%, 50%, 75%, or 100% of the original&apos;s corresponding dimension.
      </P>

      <Callout>
        The output is capped at fal&apos;s 3840 max edge. If your target would exceed that, the
        whole thing is scaled down to fit while preserving the aspect ratio.
      </Callout>
    </>
  );
}

function Upscale() {
  return (
    <>
      <H1>Upscaling</H1>
      <Lede>
        Generate at 1k or 2k for speed; pick winners; upscale only those. The cost difference is
        substantial — a 4k high-quality generation can be 10× the price of upscaling a 1k.
      </Lede>

      <H2>Built-in models</H2>
      <Ul>
        <li>
          <strong>Real-ESRGAN</strong> — fast, cheap, basic upscaling.
        </li>
        <li>
          <strong>AuraSR</strong> — GAN-based, balanced. 4× only.
        </li>
        <li>
          <strong>Clarity</strong> — diffusion-based, preserves detail.
        </li>
        <li>
          <strong>Creative</strong> — adds detail creatively, best for stylized.
        </li>
      </Ul>

      <H2>Adding custom upscale models</H2>
      <P>
        Dashboard → Models → Add (kind = Upscale). Custom models appear in the same picker with
        their pricing estimate.
      </P>
    </>
  );
}

function ProjectsTags() {
  return (
    <>
      <H1>Projects and tags</H1>

      <H2>Projects</H2>
      <P>
        Created from the project switcher in the top bar. While a real project is active, new
        generations are stamped with that project automatically. Switch to &quot;All&quot; or
        &quot;Unsorted&quot; to land elsewhere.
      </P>

      <H2>Tags</H2>
      <P>
        Per-asset, edited in the Lightbox. Tags on the AssetCard hover are clickable — that adds
        the tag as a filter. Multiple tag filters AND together.
      </P>

      <H2>Search</H2>
      <P>
        Full-text over the prompt field. Case-insensitive substring. Combines with the project +
        tag filters.
      </P>
    </>
  );
}

function Shortcuts() {
  return (
    <>
      <H1>Keyboard shortcuts</H1>
      <Lede>Quick reference for the keystrokes that exist.</Lede>

      <H2>Studio panel</H2>
      <Ul>
        <li><Code>⌘ ↵</Code> / <Code>Ctrl ↵</Code> — submit the form.</li>
        <li><Code>@</Code> — open the reference picker popover. ↑/↓ ↵ to select.</li>
        <li><Code>/</Code> — open the snippet popover. ↑/↓ ↵ to insert.</li>
      </Ul>

      <H2>Lightbox</H2>
      <Ul>
        <li><Code>← →</Code> or <Code>↑ ↓</Code> — navigate between images.</li>
        <li>Scroll wheel — same as arrow keys.</li>
        <li><Code>Esc</Code> — close.</li>
      </Ul>

      <H2>Inpaint brush</H2>
      <Ul>
        <li><Code>B</Code> — brush · <Code>E</Code> — eraser.</li>
        <li><Code>[</Code> / <Code>]</Code> — decrease / increase brush size.</li>
        <li><Code>Esc</Code> — close without saving.</li>
      </Ul>
    </>
  );
}

function Privacy() {
  return (
    <>
      <H1>Privacy & storage</H1>
      <Lede>What gets stored, where, and what leaves your machine.</Lede>

      <H2>What stays local</H2>
      <Ul>
        <li>All generated images and their metadata sidecars live under <Code>public/generations/</Code>.</li>
        <li>Snippets, settings, and custom model registrations live in <Code>localStorage</Code>.</li>
        <li>Projects live in <Code>public/generations/projects.json</Code>.</li>
      </Ul>

      <H2>What leaves your machine</H2>
      <Ul>
        <li>Prompts and reference images go to fal.ai for inference.</li>
        <li>Your fal API key goes to fal.ai (it&apos;s how they bill).</li>
        <li>
          A read-only call to fal&apos;s account-billing endpoint is made on app open to
          show your remaining credit balance. Cached for ~1 minute server-side.
        </li>
        <li>Nothing else. No telemetry, no analytics, no auth provider.</li>
      </Ul>

      <H2>Account credits</H2>
      <P>
        The top-bar wallet chip and the Overview tab show your fal credit balance via{" "}
        <Code>GET /v1/account/billing?expand=credits</Code>. When balance &lt; $1, the chip
        and the dashboard card switch to a yellow low-balance state.
      </P>

      <Callout tone="warn">
        <strong>fal API keys have two scopes: API and ADMIN.</strong> The billing endpoint
        requires Admin — a standard API-scope key 403s here. Admin is a superset, so the
        same key also handles all generation/edit/upscale calls.
      </Callout>

      <H2>Setup</H2>
      <Ul>
        <li>
          Create an <strong>Admin</strong>-scope key at{" "}
          <Link href="https://fal.ai/dashboard/keys">fal.ai/dashboard/keys</Link>.
        </li>
        <li>
          Set it as <Code>FAL_ADMIN_KEY</Code> in <Code>.env.local</Code>. That single key
          does everything — generation, edits, upscales, and credit reads.
        </li>
        <li>Restart <Code>npm run dev</Code>.</li>
      </Ul>

      <H2>If you only have an API-scope key</H2>
      <P>
        Set it as <Code>FAL_ADMIN_KEY</Code> anyway — generation will work, but the credits
        chip will be hidden and the Overview tab will show a small explanation card instead of
        pretending the feature works.
      </P>

      <p className="text-[11.5px] text-[var(--color-muted)] leading-relaxed mb-3">
        Legacy: <Code>FAL_KEY</Code> is still accepted as a fallback for users who set up the
        app before the rename. New installs should use <Code>FAL_ADMIN_KEY</Code>.
      </p>

      <H2>Downloads are stripped</H2>
      <P>
        Clicking download routes through <Code>/api/download</Code>, which re-encodes the file via
        sharp. EXIF, PNG text chunks (which some image models embed prompts into), and color
        profiles are all wiped. The file on disk under <Code>public/generations/</Code> is{" "}
        <em>not</em> modified — gallery previews show the raw output.
      </P>
    </>
  );
}

function Theming() {
  return (
    <>
      <H1>Theming</H1>
      <Lede>
        Themes are written in the{" "}
        <Link href="https://github.com/google-labs-code/design.md">design.md</Link> format and
        live under <Code>src/themes/</Code>. The app ships with four (Midnight, Ember, Paper,
        Pastel Candy) and any theme from{" "}
        <Link href="https://designdotmd.directory/">designdotmd.directory</Link> drops in as-is.
      </Lede>

      <H2>Switching themes</H2>
      <P>
        Open Settings (the gear in the top bar) and pick a theme. The change applies instantly,
        persists to <Code>localStorage</Code> (key <Code>te.settings.v1</Code>), and survives
        reloads. Each entry shows a 2x2 swatch of its background, surface, foreground, and
        accent so you can tell them apart.
      </P>

      <H2>How it works</H2>
      <Ul>
        <li>
          <Code>src/themes/*.ts</Code> — one file per theme, each exporting the raw design.md
          markdown as a string. Only the YAML frontmatter is parsed.
        </li>
        <li>
          <Code>src/lib/designMd.ts</Code> — parser. Reads the <Code>colors</Code> block from
          the frontmatter and maps its semantic tokens (<Code>primary</Code>,{" "}
          <Code>secondary</Code>, <Code>tertiary</Code>, <Code>neutral</Code>,{" "}
          <Code>surface</Code>, <Code>on-primary</Code>) onto this app&apos;s CSS variables.
          Light vs. dark is detected from the luminance of <Code>neutral</Code>.
        </li>
        <li>
          <Code>src/lib/themes.ts</Code> — registry. Imports the markdown files, parses each,
          and exposes the result as <Code>THEMES</Code>.
        </li>
        <li>
          <Code>src/components/ThemeApplier.tsx</Code> — reads the chosen theme on mount and
          writes its variables onto <Code>document.documentElement.style</Code>.
        </li>
      </Ul>

      <H2>Adding a theme</H2>
      <P>
        Grab any theme from{" "}
        <Link href="https://designdotmd.directory/">designdotmd.directory</Link>, copy its
        markdown, and drop it into a new file under <Code>src/themes/</Code>. Then register it
        in <Code>THEME_SOURCES</Code> inside <Code>src/lib/themes.ts</Code>.
      </P>
      <Pre>{`// src/themes/oceanic.ts
export default \`---
version: alpha
name: Oceanic
description: Cool teals on deep navy.
colors:
  primary: "#e6f7ff"
  secondary: "#7aa9c4"
  tertiary: "#22d3ee"
  neutral: "#071019"
  surface: "#13212f"
  on-primary: "#071019"
---
\`;`}</Pre>
      <Pre>{`// src/lib/themes.ts
import oceanicMd from "@/themes/oceanic";

const THEME_SOURCES = [
  // ... existing themes
  { id: "oceanic", src: oceanicMd },
];`}</Pre>

      <H2>How colors are mapped</H2>
      <P>
        The five required design.md colors are enough to derive every variable the app reads.
        Intermediate tints (surface-hover, borders, dimmed text) are computed by mixing toward
        the opposite end of the light/dark axis. Provide <Code>on-primary</Code> to override
        the text color used on top of the accent (otherwise it&apos;s auto-picked from the
        accent&apos;s luminance).
      </P>
      <Ul>
        <li><Code>primary</Code> → <Code>--color-fg</Code> (main text)</li>
        <li><Code>secondary</Code> → <Code>--color-muted</Code> (captions, borders source)</li>
        <li><Code>tertiary</Code> → <Code>--color-accent</Code> (interaction driver)</li>
        <li><Code>neutral</Code> → <Code>--color-bg</Code> (page canvas)</li>
        <li><Code>surface</Code> → <Code>--color-bg-elevated</Code> (cards, modals)</li>
        <li><Code>on-primary</Code> → <Code>--color-fg-on-accent</Code></li>
      </Ul>
      <Callout>
        <Code>typography</Code>, <Code>rounded</Code>, <Code>spacing</Code>, and{" "}
        <Code>components</Code> blocks are ignored. The app has its own type scale and shape
        language; pulling those from design.md is intentionally out of scope for now.
      </Callout>
    </>
  );
}

function Concurrency() {
  return (
    <>
      <H1>Concurrency & pagination</H1>

      <H2>Concurrent batches</H2>
      <P>
        Up to 4 in-flight generations at once (configurable via <Code>MAX_CONCURRENT</Code> in{" "}
        <Code>src/app/page.tsx</Code>). The form stays editable while batches run; each pending
        image shows as a labeled skeleton with a live elapsed timer.
      </P>

      <H2>Library pagination</H2>
      <P>
        The library renders <Code>pageSize</Code> cards at a time (configurable via Settings → page size).
        Scrolling near the bottom triggers an <Code>IntersectionObserver</Code> that mounts the
        next page. Filters reset the visible count to one page.
      </P>

      <H2>References cap</H2>
      <P>
        Up to 4 reference images per generation (<Code>MAX_REFERENCES</Code>). Drag-and-drop, the
        Lightbox &quot;use as reference&quot; button, and bulk selection from the library all
        respect this cap.
      </P>
    </>
  );
}

function Deploy() {
  return (
    <>
      <H1>Deploying</H1>
      <Lede>Short version: don&apos;t. This app is built to run locally.</Lede>

      <H2>Why Vercel won&apos;t work as-is</H2>
      <P>
        Vercel serverless functions have a read-only filesystem at runtime, and{" "}
        <Code>public/</Code> is baked into the build. The app writes new generations directly to{" "}
        <Code>public/generations/</Code>, which only works on a long-running Node server with disk access.
      </P>

      <H2>Long-running Node host</H2>
      <P>
        A regular VPS, Fly.io VM, Railway service, or self-hosted Docker setup all work. Use the
        included <Code>Dockerfile</Code> and <Code>docker-compose.yml</Code>. Mount{" "}
        <Code>./public/generations</Code> as a volume so it survives restarts.
      </P>

      <H2>Real cloud deployment</H2>
      <P>
        Requires swapping the storage layer. The {""}
        <Code>docs/PORTING_TO_VERCEL_R2_SUPABASE.md</Code> guide in the repo sketches a path:
        Cloudflare R2 for blob storage, Supabase for metadata.
      </P>
    </>
  );
}

function FAQ() {
  return (
    <>
      <H1>FAQ</H1>

      <H2>Why is GPT Image 2 non-deterministic? Where&apos;s the seed?</H2>
      <P>
        OpenAI&apos;s public API for GPT Image 2 doesn&apos;t expose a seed parameter on fal,
        so we can&apos;t expose one either. Output isn&apos;t reproducible. Other models on fal
        (FLUX, Stable Diffusion 3.5) do expose seeds — swapping models is the only path to
        determinism.
      </P>

      <H2>Can I add video generation?</H2>
      <P>
        You can register video models in Dashboard → Models, but the studio panel doesn&apos;t
        generate video. The work to wire it up:
      </P>
      <Ul>
        <li>A new <Code>/api/generate-video</Code> route, similar to <Code>/api/generate</Code>.</li>
        <li>A new panel mode that swaps the form for a video-specific one (duration, frame rate).</li>
        <li>Storage handling for <Code>.mp4</Code> / <Code>.webm</Code> outputs.</li>
        <li>An updated <Code>AssetCard</Code> that renders <Code>&lt;video&gt;</Code> for video assets.</li>
      </Ul>

      <H2>Where is my data?</H2>
      <P>
        On disk under <Code>public/generations/</Code> in your project directory, plus a few
        things in browser <Code>localStorage</Code> (snippets, custom models, settings). Nothing
        else.
      </P>

      <H2>How do I delete everything?</H2>
      <P>
        Empty <Code>public/generations/</Code>, then clear browser storage for the app&apos;s
        origin. That&apos;s a hard reset.
      </P>

      <H2>I want a different default generation model</H2>
      <P>
        Edit the <Code>MODELS</Code> object in <Code>src/lib/fal.ts</Code>. Both{" "}
        <Code>image</Code> (text-to-image) and <Code>imageEdit</Code> (with references) live there.
      </P>
    </>
  );
}
