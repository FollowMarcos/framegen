"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowRight, X } from "lucide-react";
import { EditorMount } from "@/components/editor/EditorMount";
import { newDoc } from "@/lib/editor/store";
import { mostRecentDraft } from "@/lib/editor/drafts";
import type { BaseLayer, EditorDoc, EditorDocSummary } from "@/lib/editor/types";

// Entry surface for "open a new editor":
//   /editor                  — blank canvas, with an opt-in
//                              "Continue last draft?" chip if a recent
//                              draft exists. We deliberately don't
//                              auto-redirect — explicit choice beats
//                              clever defaults here.
//   /editor?from=<imageUrl>  — seeded with the image as the base layer
//
// useSearchParams forces the page off the static-prerender path, so we
// wrap the inner client in <Suspense>. Both halves stay client-only
// because EditorMount itself imports react-konva, which can't render
// on the server.
export default function EditorEntryPage() {
  return (
    <Suspense fallback={<EntryLoading label="Preparing canvas…" />}>
      <EditorEntry />
    </Suspense>
  );
}

function EditorEntry() {
  const params = useSearchParams();
  const router = useRouter();
  const from = params.get("from");

  const [initial, setInitial] = useState<EditorDoc | null>(null);
  // Surfaced as a dismissable chip in the corner of the canvas when a
  // recent draft exists. Null means "no draft to offer" — either there
  // isn't one, or the user already saw + dismissed this one.
  const [draftOffer, setDraftOffer] = useState<EditorDocSummary | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function build() {
      if (!from) {
        // Always start with a fresh doc. If a recent draft exists, show
        // a chip on the canvas inviting the user to switch — much
        // clearer UX than silently replacing the URL.
        const draft = mostRecentDraft();
        if (draft) {
          setDraftOffer({
            id: draft.id,
            name: draft.name,
            createdAt: draft.createdAt,
            updatedAt: draft.updatedAt,
            thumbUrl: null,
            width: draft.canvas.width,
            height: draft.canvas.height,
          });
        }
        setInitial(newDoc());
        return;
      }
      try {
        const img = await loadImage(from);
        if (cancelled) return;
        const base: BaseLayer = {
          assetUrl: from,
          naturalWidth: img.naturalWidth,
          naturalHeight: img.naturalHeight,
          crop: null,
        };
        setInitial(
          newDoc({
            base,
            width: img.naturalWidth,
            height: img.naturalHeight,
            background: "#000000",
          })
        );
      } catch {
        if (!cancelled) setInitial(newDoc());
      }
    }
    build();
    return () => {
      cancelled = true;
    };
  }, [from, router]);

  if (!initial) return <EntryLoading label="Preparing canvas…" />;
  return (
    <>
      <EditorMount initial={initial} />
      {draftOffer && (
        <DraftRestoreChip
          draft={draftOffer}
          onAccept={() => router.replace(`/editor/${draftOffer.id}`)}
          onDismiss={() => setDraftOffer(null)}
        />
      )}
    </>
  );
}

// Floating, non-blocking chip prompting the user to switch to a recent
// draft. Bottom-left so it sits clear of the zoom HUD (bottom-right)
// and the layer rail (right side). One click to accept, one to
// dismiss — no third option.
function DraftRestoreChip({
  draft,
  onAccept,
  onDismiss,
}: {
  draft: EditorDocSummary;
  onAccept: () => void;
  onDismiss: () => void;
}) {
  return (
    <div className="fixed bottom-3 left-3 z-40 max-w-[320px] rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-elevated)]/95 backdrop-blur shadow-2xl p-3 flex items-start gap-3 animate-in fade-in slide-in-from-bottom-2">
      <div className="flex-1 min-w-0">
        <p className="text-[12px] font-medium text-[var(--color-fg)]">
          Continue your last draft?
        </p>
        <p className="text-[11px] text-[var(--color-muted)] mt-0.5 truncate">
          {draft.name || "untitled"} · saved {relativeTime(draft.updatedAt)}
        </p>
        <button
          type="button"
          onClick={onAccept}
          className="mt-2 inline-flex items-center gap-1 h-7 px-2.5 rounded-md bg-[var(--color-accent)] text-[var(--color-fg-on-accent)] text-[11px] font-semibold hover:bg-[var(--color-accent-hover)] transition"
        >
          Open <ArrowRight className="size-3" />
        </button>
      </div>
      <button
        type="button"
        onClick={onDismiss}
        aria-label="dismiss"
        className="size-6 grid place-items-center rounded text-[var(--color-muted)] hover:text-[var(--color-fg)] hover:bg-[var(--color-surface)] transition shrink-0"
      >
        <X className="size-3.5" />
      </button>
    </div>
  );
}

function EntryLoading({ label }: { label: string }) {
  return (
    <div className="h-screen w-screen grid place-items-center bg-[var(--color-bg)] text-[var(--color-muted)] text-[12px]">
      {label}
    </div>
  );
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const el = new window.Image();
    el.crossOrigin = "anonymous";
    el.onload = () => resolve(el);
    el.onerror = reject;
    el.src = url;
  });
}

function relativeTime(ts: number): string {
  const diffSec = Math.max(0, (Date.now() - ts) / 1000);
  if (diffSec < 60) return "just now";
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
  const days = Math.floor(diffSec / 86400);
  if (days < 7) return `${days}d ago`;
  return new Date(ts).toLocaleDateString();
}
