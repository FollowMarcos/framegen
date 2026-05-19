"use client";

import { AlertTriangle, Pencil, RotateCcw, Trash2 } from "lucide-react";
import type { FailedJob } from "@/app/page";

// In-grid card for a generation that failed. Replaces the silently-vanishing
// skeleton with a visible record so the user can:
//   - read the actual fal error (image too large, content policy, etc.),
//   - retry the same payload with one click,
//   - edit (load the prompt + size back into the StudioPanel), or
//   - delete the failed entry.
//
// Sized to match AssetCard / AssetSkeleton's aspect-square so the grid
// layout stays uniform.

export function FailedCard({
  job,
  onRetry,
  onEdit,
  onDelete,
}: {
  job: FailedJob;
  onRetry: (id: string) => void;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  const canRetry = Boolean(job.retry);
  const canEdit = Boolean(job.reuse);

  return (
    <div
      role="article"
      aria-label={`failed generation: ${job.error}`}
      className="relative aspect-square rounded-lg border border-[var(--color-danger)]/30 bg-[var(--color-danger)]/5 p-3 flex flex-col"
    >
      <div className="flex items-start gap-2 mb-2 shrink-0">
        <AlertTriangle className="size-4 text-[var(--color-danger)] shrink-0 mt-0.5" />
        <div className="min-w-0 flex-1">
          <div className="text-[11px] font-semibold text-[var(--color-danger)] uppercase tracking-wider">
            {job.kind === "upscale" ? "upscale failed" : "generation failed"}
          </div>
          {job.expectedCount > 1 && (
            <div className="text-[10px] text-[var(--color-muted)] font-mono tabular-nums mt-0.5">
              {job.expectedCount} images requested
            </div>
          )}
        </div>
      </div>

      <p
        className="text-[12px] text-[var(--color-fg-dim)] leading-snug flex-1 overflow-y-auto break-words"
        title={job.error}
      >
        {job.error}
      </p>

      {job.prompt && (
        <p
          className="text-[10.5px] text-[var(--color-muted)] mt-2 line-clamp-2 italic break-words shrink-0"
          title={job.prompt}
        >
          “{job.prompt}”
        </p>
      )}

      <div className="mt-2 flex items-center gap-1 shrink-0">
        {canRetry && (
          <button
            type="button"
            onClick={() => onRetry(job.id)}
            className="inline-flex items-center gap-1 h-7 px-2 rounded-md bg-[var(--color-surface)] hover:bg-[var(--color-surface-hover)] border border-[var(--color-border)] hover:border-[var(--color-border-strong)] text-[11px] font-medium text-[var(--color-fg-dim)] hover:text-[var(--color-fg)] transition"
            title="retry with the same parameters"
          >
            <RotateCcw className="size-3" />
            retry
          </button>
        )}
        {canEdit && (
          <button
            type="button"
            onClick={() => onEdit(job.id)}
            className="inline-flex items-center gap-1 h-7 px-2 rounded-md bg-[var(--color-surface)] hover:bg-[var(--color-surface-hover)] border border-[var(--color-border)] hover:border-[var(--color-border-strong)] text-[11px] font-medium text-[var(--color-fg-dim)] hover:text-[var(--color-fg)] transition"
            title="load this prompt back into the studio panel"
          >
            <Pencil className="size-3" />
            edit
          </button>
        )}
        <div className="flex-1" />
        <button
          type="button"
          onClick={() => onDelete(job.id)}
          className="size-7 grid place-items-center rounded-md text-[var(--color-muted)] hover:text-[var(--color-danger)] hover:bg-[var(--color-surface)] transition"
          aria-label="dismiss failed job"
          title="dismiss"
        >
          <Trash2 className="size-3.5" />
        </button>
      </div>
    </div>
  );
}
