"use client";

import { useEffect, useRef, useState } from "react";
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Copy,
  Download,
  Expand,
  Folder,
  Image as ImgIcon,
  Loader2,
  Plus,
  RotateCcw,
  Sparkles,
  Tag,
  Trash2,
  X,
} from "lucide-react";
import type { StoredAsset, StoredSource } from "@/lib/storage";
import type { Project } from "@/lib/projects";
import type { AddReferenceFromAsset } from "@/app/page";
import { cn } from "@/lib/utils";

const SPECIAL_KEYS = new Set(["sources", "mask"]);

// Wheel events fire in bursts; only advance once per WHEEL_THROTTLE_MS.
const WHEEL_THROTTLE_MS = 220;
const WHEEL_DELTA_THRESHOLD = 8;

// Filmstrip thumbnail metrics — kept in JS so we can compute how many fit.
const STRIP_THUMB_PX = 64; // matches w-16 / aspect-square
const STRIP_GAP_PX = 8;    // matches gap-2
const STRIP_MIN = 3;
const STRIP_MAX = 15;

function readSources(extras: Record<string, unknown> | undefined): StoredSource[] {
  const v = extras?.sources;
  if (!Array.isArray(v)) return [];
  return v.filter(
    (s): s is StoredSource => Boolean(s) && typeof (s as StoredSource).url === "string"
  );
}

function readMask(extras: Record<string, unknown> | undefined): StoredSource | null {
  const v = extras?.mask;
  if (v && typeof (v as StoredSource).url === "string") return v as StoredSource;
  return null;
}

export function Lightbox({
  asset,
  assets,
  onClose,
  onDelete,
  onNavigate,
  onUseAsReference,
  refLoadingId,
  refsFull,
  projects,
  onUpdateMeta,
  onUpscale,
  onOutpaint,
  busyUpscaleId,
  onReuse,
  reuseLoadingId,
}: {
  asset: StoredAsset | null;
  assets: StoredAsset[];
  onClose: () => void;
  onDelete: (id: string) => void;
  onNavigate: (next: StoredAsset) => void;
  onUseAsReference?: AddReferenceFromAsset;
  refLoadingId?: string | null;
  refsFull?: boolean;
  projects?: Project[];
  onUpdateMeta?: (
    id: string,
    patch: { tags?: string[]; projectId?: string | null }
  ) => Promise<void>;
  onUpscale?: (asset: StoredAsset) => void;
  onOutpaint?: (asset: StoredAsset) => void;
  busyUpscaleId?: string | null;
  onReuse?: (asset: StoredAsset) => void;
  reuseLoadingId?: string | null;
}) {
  const [copied, setCopied] = useState(false);
  const [addedFlash, setAddedFlash] = useState(false);
  const lastWheelAt = useRef(0);

  const index = asset ? assets.findIndex((a) => a.id === asset.id) : -1;
  const canPrev = index > 0;
  const canNext = index >= 0 && index < assets.length - 1;

  // Keep latest refs for the keyboard handler to avoid stale closures while
  // still attaching the listener once per asset open.
  const navRef = useRef({ canPrev, canNext, prev: () => {}, next: () => {} });
  navRef.current = {
    canPrev,
    canNext,
    prev: () => canPrev && onNavigate(assets[index - 1]),
    next: () => canNext && onNavigate(assets[index + 1]),
  };

  useEffect(() => {
    if (!asset) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        onClose();
        return;
      }
      if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
        e.preventDefault();
        navRef.current.prev();
        return;
      }
      if (e.key === "ArrowRight" || e.key === "ArrowDown") {
        e.preventDefault();
        navRef.current.next();
      }
    }
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [asset, onClose]);

  if (!asset) return null;

  async function copyPrompt() {
    if (!asset) return;
    await navigator.clipboard.writeText(asset.prompt);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  function onWheel(e: React.WheelEvent) {
    if (Math.abs(e.deltaY) < WHEEL_DELTA_THRESHOLD) return;
    const now = Date.now();
    if (now - lastWheelAt.current < WHEEL_THROTTLE_MS) return;
    lastWheelAt.current = now;
    if (e.deltaY > 0) navRef.current.next();
    else navRef.current.prev();
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={onClose}
      className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-6 animate-in"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-[min(1280px,95vw)] h-[calc(100vh-3rem)] grid lg:grid-cols-[1fr_360px_auto] gap-4 min-h-0"
      >
        <div
          onWheel={onWheel}
          className="relative bg-black rounded-xl overflow-hidden flex items-center justify-center min-h-0 min-w-0 group"
        >
          { }
          <img
            key={asset.id}
            src={asset.url}
            alt={asset.prompt}
            className="max-h-full max-w-full object-contain transition-opacity duration-150"
          />

          {canPrev && (
            <button
              type="button"
              onClick={() => navRef.current.prev()}
              aria-label="previous image"
              className="absolute left-2 top-1/2 -translate-y-1/2 size-9 rounded-full bg-black/55 hover:bg-black/80 text-white/80 hover:text-white grid place-items-center transition opacity-0 group-hover:opacity-100 backdrop-blur"
            >
              <ChevronLeft className="size-5" />
            </button>
          )}
          {canNext && (
            <button
              type="button"
              onClick={() => navRef.current.next()}
              aria-label="next image"
              className="absolute right-2 top-1/2 -translate-y-1/2 size-9 rounded-full bg-black/55 hover:bg-black/80 text-white/80 hover:text-white grid place-items-center transition opacity-0 group-hover:opacity-100 backdrop-blur"
            >
              <ChevronRight className="size-5" />
            </button>
          )}

          {assets.length > 1 && (
            <div
              className="pointer-events-none absolute bottom-3 left-1/2 -translate-x-1/2 text-[10px] font-mono text-white/70 bg-black/55 backdrop-blur px-2 py-0.5 rounded tabular-nums opacity-0 group-hover:opacity-100 transition"
              aria-live="polite"
            >
              {index + 1} / {assets.length}
            </div>
          )}
        </div>

        <div className="flex flex-col bg-[var(--color-bg-elevated)] border border-[var(--color-border)] rounded-xl overflow-hidden min-h-0">
          <div className="flex items-center justify-between h-11 px-4 border-b border-[var(--color-border)] shrink-0">
            <div className="flex items-baseline gap-2">
              <span className="text-[11px] uppercase tracking-[0.08em] text-[var(--color-muted)] font-semibold">
                details
              </span>
              {assets.length > 1 && (
                <span className="text-[10px] font-mono text-[var(--color-muted-dim)] tabular-nums">
                  {index + 1} / {assets.length}
                </span>
              )}
            </div>
            <button
              onClick={onClose}
              className="size-6 rounded-md grid place-items-center text-[var(--color-muted)] hover:text-[var(--color-fg)] hover:bg-[var(--color-surface)] transition"
              aria-label="close"
            >
              <X className="size-3.5" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-4 min-h-0">
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[10px] uppercase tracking-[0.08em] text-[var(--color-muted)] font-semibold">
                  prompt
                </span>
                <button
                  onClick={copyPrompt}
                  className="text-[11px] text-[var(--color-muted)] hover:text-[var(--color-fg)] inline-flex items-center gap-1 transition"
                >
                  {copied ? (
                    <>
                      <Check className="size-3" /> copied
                    </>
                  ) : (
                    <>
                      <Copy className="size-3" /> copy
                    </>
                  )}
                </button>
              </div>
              <div className="max-h-48 overflow-y-auto rounded-md bg-[var(--color-bg)] border border-[var(--color-border)] p-2.5">
                <p className="text-[12.5px] leading-relaxed text-[var(--color-fg-dim)] whitespace-pre-wrap break-words">
                  {asset.prompt}
                </p>
              </div>
            </div>

            {(() => {
              const sources = readSources(asset.extras);
              const mask = readMask(asset.extras);
              if (sources.length === 0 && !mask) return null;
              return (
                <div>
                  <div className="text-[10px] uppercase tracking-[0.08em] text-[var(--color-muted)] font-semibold mb-1.5">
                    references
                  </div>
                  {sources.length > 0 && (
                    <div className="grid grid-cols-4 gap-1.5">
                      {sources.map((s, i) => (
                        <a
                          key={i}
                          href={s.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          title={`open ${s.fileName}`}
                          className="relative aspect-square rounded-md overflow-hidden bg-black border border-[var(--color-border)] hover:border-[var(--color-accent)] transition"
                        >
                          { }
                          <img
                            src={s.url}
                            alt={`reference ${i + 1}`}
                            className="w-full h-full object-cover"
                            loading="lazy"
                          />
                        </a>
                      ))}
                    </div>
                  )}
                  {mask && (
                    <div className="mt-2">
                      <div className="text-[10px] text-[var(--color-muted-dim)] mb-1 font-mono">mask</div>
                      <a
                        href={mask.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block w-16 aspect-square rounded-md overflow-hidden bg-black border border-[var(--color-border)] hover:border-[var(--color-accent)] transition"
                        title={`open ${mask.fileName}`}
                      >
                        { }
                        <img
                          src={mask.url}
                          alt="mask"
                          className="w-full h-full object-cover"
                          loading="lazy"
                        />
                      </a>
                    </div>
                  )}
                </div>
              );
            })()}

            {onUpdateMeta && (
              <TagsEditor
                tags={asset.tags ?? []}
                onChange={(next) => onUpdateMeta(asset.id, { tags: next })}
              />
            )}

            {onUpdateMeta && projects && (
              <ProjectAssign
                value={asset.projectId ?? null}
                projects={projects}
                onChange={(projectId) => onUpdateMeta(asset.id, { projectId })}
              />
            )}

            <Detail label="model" value={asset.model} mono />
            {asset.width && asset.height && (
              <Detail label="dimensions" value={`${asset.width} × ${asset.height}`} mono />
            )}
            {asset.contentType && <Detail label="format" value={asset.contentType} mono />}
            <Detail label="created" value={new Date(asset.createdAt).toLocaleString()} />

            {(() => {
              const entries = Object.entries(asset.extras ?? {}).filter(
                ([k]) => !SPECIAL_KEYS.has(k)
              );
              if (entries.length === 0) return null;
              return (
                <div>
                  <div className="text-[10px] uppercase tracking-[0.08em] text-[var(--color-muted)] font-semibold mb-1.5">
                    parameters
                  </div>
                  <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-[11px]">
                    {entries.map(([k, v]) => (
                      <div key={k} className="contents">
                        <dt className="text-[var(--color-muted)] font-mono">{k}</dt>
                        <dd
                          className="text-[var(--color-fg-dim)] font-mono truncate min-w-0"
                          title={typeof v === "object" ? JSON.stringify(v) : String(v)}
                        >
                          {typeof v === "object" ? JSON.stringify(v) : String(v)}
                        </dd>
                      </div>
                    ))}
                  </dl>
                </div>
              );
            })()}
          </div>

          <div className="border-t border-[var(--color-border)] p-3 shrink-0 space-y-2">
            {(onUpscale || onOutpaint || onReuse) && (
              <div className="flex gap-2">
                {onReuse && (
                  <button
                    onClick={() => onReuse(asset)}
                    disabled={reuseLoadingId === asset.id}
                    className="flex-1 inline-flex items-center justify-center gap-1.5 h-8 rounded-md bg-[var(--color-surface)] hover:bg-[var(--color-surface-hover)] border border-[var(--color-border)] hover:border-[var(--color-border-strong)] text-[12px] font-medium text-[var(--color-fg-dim)] hover:text-[var(--color-fg)] disabled:opacity-50 disabled:cursor-not-allowed transition"
                    title="load this image's prompt, size, and references into the studio panel"
                  >
                    {reuseLoadingId === asset.id ? (
                      <Loader2 className="size-3.5 animate-spin" />
                    ) : (
                      <RotateCcw className="size-3.5" />
                    )}
                    reuse
                  </button>
                )}
                {onUpscale && (
                  <button
                    onClick={() => onUpscale(asset)}
                    disabled={busyUpscaleId === asset.id}
                    className="flex-1 inline-flex items-center justify-center gap-1.5 h-8 rounded-md bg-[var(--color-surface)] hover:bg-[var(--color-surface-hover)] border border-[var(--color-border)] hover:border-[var(--color-border-strong)] text-[12px] font-medium text-[var(--color-fg-dim)] hover:text-[var(--color-fg)] disabled:opacity-50 disabled:cursor-not-allowed transition"
                    title="upscale this image"
                  >
                    {busyUpscaleId === asset.id ? (
                      <Loader2 className="size-3.5 animate-spin" />
                    ) : (
                      <Sparkles className="size-3.5" />
                    )}
                    upscale…
                  </button>
                )}
                {onOutpaint && (
                  <button
                    onClick={() => onOutpaint(asset)}
                    className="flex-1 inline-flex items-center justify-center gap-1.5 h-8 rounded-md bg-[var(--color-surface)] hover:bg-[var(--color-surface-hover)] border border-[var(--color-border)] hover:border-[var(--color-border-strong)] text-[12px] font-medium text-[var(--color-fg-dim)] hover:text-[var(--color-fg)] transition"
                    title="expand canvas"
                  >
                    <Expand className="size-3.5" />
                    expand
                  </button>
                )}
              </div>
            )}
          <div className="grid grid-cols-[1fr_auto_auto] gap-2">
            {onUseAsReference ? (
              <button
                onClick={async () => {
                  if (!asset || refsFull || refLoadingId === asset.id) return;
                  const result = await onUseAsReference(asset);
                  if (result === "added") {
                    setAddedFlash(true);
                    setTimeout(() => setAddedFlash(false), 1500);
                  }
                }}
                disabled={refsFull || refLoadingId === asset.id}
                className={cn(
                  "inline-flex items-center justify-center gap-1.5 h-8 rounded-md text-[12px] font-medium transition disabled:opacity-50 disabled:cursor-not-allowed",
                  addedFlash
                    ? "bg-[var(--color-accent)] text-[var(--color-fg-on-accent)]"
                    : "bg-[var(--color-accent)]/15 text-[var(--color-accent)] hover:bg-[var(--color-accent)]/25"
                )}
                title={
                  refsFull
                    ? "max 4 references"
                    : refLoadingId === asset.id
                      ? "adding…"
                      : "send this image to the studio panel as a reference"
                }
              >
                {refLoadingId === asset.id ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : addedFlash ? (
                  <Check className="size-3.5" />
                ) : (
                  <ImgIcon className="size-3.5" />
                )}
                {addedFlash
                  ? "added to references"
                  : refsFull
                    ? "references full"
                    : "use as reference"}
              </button>
            ) : (
              <div />
            )}
            <a
              href={`/api/download?id=${encodeURIComponent(asset.id)}`}
              download={asset.fileName}
              className="inline-flex items-center justify-center gap-1.5 h-8 px-3 rounded-md bg-[var(--color-surface)] text-[12px] font-medium hover:bg-[var(--color-surface-hover)] border border-[var(--color-border)] transition"
              title="download (metadata stripped)"
            >
              <Download className="size-3.5" />
              download
            </a>
            <button
              onClick={() => {
                onDelete(asset.id);
                onClose();
              }}
              className="inline-flex items-center justify-center gap-1.5 h-8 px-3 rounded-md text-[12px] font-medium text-[var(--color-danger)] hover:bg-[var(--color-danger)]/10 border border-[var(--color-border)] transition"
              title="delete"
            >
              <Trash2 className="size-3.5" />
              delete
            </button>
          </div>
          </div>
        </div>

        <ThumbStrip
          assets={assets}
          currentIndex={index}
          onNavigate={onNavigate}
        />
      </div>
    </div>
  );
}

function ThumbStrip({
  assets,
  currentIndex,
  onNavigate,
}: {
  assets: StoredAsset[];
  currentIndex: number;
  onNavigate: (a: StoredAsset) => void;
}) {
  const containerRef = useRef<HTMLElement>(null);
  // Start with a safe odd default — the effect below will tighten it up to
  // whatever actually fits in the viewport.
  const [count, setCount] = useState(5);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    function measure() {
      if (!el) return;
      const h = el.clientHeight;
      // n thumbs + (n-1) gaps ≤ h  ⇒  n ≤ (h + gap) / (thumb + gap)
      const fit = Math.floor((h + STRIP_GAP_PX) / (STRIP_THUMB_PX + STRIP_GAP_PX));
      // Force odd so the current thumbnail always lands in the middle slot.
      const odd = fit % 2 === 0 ? fit - 1 : fit;
      const clamped = Math.max(STRIP_MIN, Math.min(STRIP_MAX, odd));
      setCount(clamped);
    }

    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  if (assets.length <= 1 || currentIndex < 0) return null;

  const half = Math.floor(count / 2);

  return (
    <aside
      ref={containerRef}
      aria-label="image filmstrip"
      className="hidden lg:flex flex-col gap-2 w-16 h-full overflow-hidden"
    >
      {Array.from({ length: count }).map((_, i) => {
        const offset = i - half;
        const targetIndex = currentIndex + offset;
        const item = assets[targetIndex];
        const isCurrent = offset === 0 && Boolean(item);

        if (!item) {
          return (
            <div
              key={i}
              aria-hidden
              className="aspect-square rounded-md border border-dashed border-[var(--color-border)] opacity-30 shrink-0"
            />
          );
        }

        return (
          <button
            key={`${i}-${item.id}`}
            type="button"
            onClick={() => onNavigate(item)}
            title={item.prompt}
            aria-label={
              isCurrent ? "current image" : `jump to ${offset < 0 ? "newer" : "older"}`
            }
            aria-current={isCurrent ? "true" : undefined}
            className={cn(
              "block aspect-square w-full rounded-md overflow-hidden bg-black transition-all shrink-0",
              isCurrent
                ? "ring-2 ring-[var(--color-accent)] opacity-100 scale-[1.04]"
                : "border border-[var(--color-border)] opacity-50 hover:opacity-100 hover:border-[var(--color-border-strong)]"
            )}
          >
            { }
            <img
              src={item.url}
              alt=""
              loading="lazy"
              className="w-full h-full object-cover"
            />
          </button>
        );
      })}
    </aside>
  );
}

function Detail({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-[0.08em] text-[var(--color-muted)] font-semibold mb-0.5">
        {label}
      </div>
      <div className={`text-[12px] text-[var(--color-fg-dim)] ${mono ? "font-mono" : ""}`}>
        {value}
      </div>
    </div>
  );
}

function TagsEditor({
  tags,
  onChange,
}: {
  tags: string[];
  onChange: (next: string[]) => void;
}) {
  const [adding, setAdding] = useState(false);
  const [input, setInput] = useState("");

  function commit() {
    const t = input.trim().replace(/^#/, "").toLowerCase();
    if (!t) {
      setAdding(false);
      setInput("");
      return;
    }
    if (tags.includes(t)) {
      setInput("");
      return;
    }
    onChange([...tags, t]);
    setInput("");
  }

  function remove(tag: string) {
    onChange(tags.filter((t) => t !== tag));
  }

  return (
    <div>
      <div className="text-[10px] uppercase tracking-[0.08em] text-[var(--color-muted)] font-semibold mb-1.5 flex items-center gap-1">
        <Tag className="size-3" />
        tags
      </div>
      <div className="flex flex-wrap gap-1.5">
        {tags.map((t) => (
          <span
            key={t}
            className="inline-flex items-center gap-1 px-2 h-6 rounded-full bg-[var(--color-surface)] border border-[var(--color-border)] text-[11px] text-[var(--color-fg-dim)]"
          >
            #{t}
            <button
              onClick={() => remove(t)}
              className="text-[var(--color-muted)] hover:text-[var(--color-danger)] transition"
              aria-label={`remove tag ${t}`}
            >
              <X className="size-2.5" />
            </button>
          </span>
        ))}
        {adding ? (
          <input
            autoFocus
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                commit();
                setAdding(false);
              } else if (e.key === "Escape") {
                setInput("");
                setAdding(false);
              } else if (e.key === ",") {
                e.preventDefault();
                commit();
              }
            }}
            placeholder="tag"
            className="h-6 px-2 rounded-full bg-[var(--color-surface)] border border-[var(--color-accent)] text-[11px] outline-none min-w-[60px] max-w-[120px]"
          />
        ) : (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="inline-flex items-center gap-1 px-2 h-6 rounded-full border border-dashed border-[var(--color-border)] text-[11px] text-[var(--color-muted)] hover:text-[var(--color-fg)] hover:border-[var(--color-border-strong)] transition"
          >
            <Plus className="size-2.5" />
            add
          </button>
        )}
      </div>
    </div>
  );
}

function ProjectAssign({
  value,
  projects,
  onChange,
}: {
  value: string | null;
  projects: Project[];
  onChange: (projectId: string | null) => void;
}) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-[0.08em] text-[var(--color-muted)] font-semibold mb-1.5 flex items-center gap-1">
        <Folder className="size-3" />
        project
      </div>
      <select
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value || null)}
        className="w-full h-7 px-2 rounded-md bg-[var(--color-surface)] border border-[var(--color-border)] text-[12px] outline-none hover:border-[var(--color-border-strong)] focus:border-[var(--color-accent)] transition-colors"
      >
        <option value="">unsorted</option>
        {projects.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
      </select>
    </div>
  );
}
