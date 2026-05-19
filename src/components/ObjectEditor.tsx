"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, Trash2, Wand2, X } from "lucide-react";
import type { PickedImage } from "@/components/ImagePicker";
import { Button, Kbd, TextArea } from "@/components/fields";
import { cn } from "@/lib/utils";
import type { StartJob, EndJob } from "@/app/page";

type Phase = "idle" | "segmenting" | "selected" | "editing" | "submitting" | "error";

type Mask = {
  url: string;
  width?: number;
  height?: number;
};

export function ObjectEditor({
  source,
  startJob,
  endJob,
  onClose,
}: {
  source: PickedImage;
  startJob: StartJob;
  endJob: EndJob;
  onClose: () => void;
}) {
  const imgRef = useRef<HTMLImageElement>(null);
  const [phase, setPhase] = useState<Phase>("idle");
  const [mask, setMask] = useState<Mask | null>(null);
  const [editText, setEditText] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  async function handleClick(e: React.MouseEvent<HTMLImageElement>) {
    const img = imgRef.current;
    if (!img || !img.complete || img.naturalWidth === 0) return;
    if (phase === "segmenting" || phase === "submitting") return;

    const rect = img.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * img.naturalWidth;
    const y = ((e.clientY - rect.top) / rect.height) * img.naturalHeight;

    setPhase("segmenting");
    setMask(null);
    setError(null);

    try {
      const res = await fetch("/api/segment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image_url: source.url, x, y }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "segmentation failed");
      setMask(json.mask as Mask);
      setPhase("selected");
    } catch (e) {
      setError(e instanceof Error ? e.message : "segmentation failed");
      setPhase("error");
    }
  }

  function reselect() {
    setMask(null);
    setEditText("");
    setError(null);
    setPhase("idle");
  }

  function submit(kind: "remove" | "edit") {
    if (!mask) return;
    if (kind === "edit" && !editText.trim()) return;

    const prompt =
      kind === "remove"
        ? "Remove the object highlighted by the mask. Reconstruct the background behind it so the result looks natural and seamless."
        : `${editText.trim()} Apply the change only to the area highlighted by the mask; keep the rest of the image untouched.`;

    setPhase("submitting");

    const jobId = startJob({
      kind: "edit",
      prompt: kind === "remove" ? "Remove (smart edit)" : `${editText.trim()}`,
      count: 1,
    });

    const requestBody = {
      prompt,
      image_urls: [source.url],
      mask_url: mask.url,
      image_size: "auto",
      quality: "high",
      output_format: "png",
      num_images: 1,
    };
    const retry = { url: "/api/generate", body: requestBody };
    const reuse = {
      prompt,
      imageUrls: [source.url],
      maskUrl: mask.url,
      quality: "high",
      outputFormat: "png",
      numImages: 1,
      imageSize: "auto" as const,
    };

    fetch("/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(requestBody),
    })
      .then(async (res) => {
        const json = await res.json().catch(() => ({}));
        if (!res.ok) {
          endJob(jobId, { error: json.error || "failed", retry, reuse });
        } else {
          endJob(jobId, { assets: json.assets });
        }
      })
      .catch((e) =>
        endJob(jobId, {
          error: e instanceof Error ? e.message : "failed",
          retry,
          reuse,
        })
      );

    onClose();
  }

  function onEditKeyDown(e: React.KeyboardEvent) {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault();
      submit("edit");
    }
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
        className="relative w-full max-w-[min(1080px,95vw)] h-[calc(100vh-3rem)] flex flex-col gap-3 min-h-0"
      >
        <header className="flex items-center justify-between shrink-0">
          <div className="flex items-baseline gap-2">
            <h2 className="text-[13px] font-semibold tracking-tight">smart edit</h2>
            <span className="text-[11px] text-[var(--color-muted)]">
              {phase === "idle" && "click an object to select it"}
              {phase === "segmenting" && "detecting object…"}
              {phase === "selected" && "select an action below — or click again to reselect"}
              {phase === "editing" && "describe the change"}
              {phase === "submitting" && "queuing…"}
              {phase === "error" && (
                <span className="text-[var(--color-danger)]">{error ?? "error"}</span>
              )}
            </span>
          </div>
          <button
            onClick={onClose}
            className="size-7 rounded-md grid place-items-center text-[var(--color-muted)] hover:text-[var(--color-fg)] hover:bg-[var(--color-surface)] transition"
            aria-label="close"
            title="close (esc)"
          >
            <X className="size-4" />
          </button>
        </header>

        <div className="flex-1 min-h-0 relative bg-black rounded-xl overflow-hidden flex items-center justify-center">
          <div className="relative max-h-full max-w-full">
            { }
            <img
              ref={imgRef}
              src={source.preview}
              alt={source.name}
              onClick={handleClick}
              draggable={false}
              className={cn(
                "max-h-[calc(100vh-12rem)] max-w-full object-contain block",
                phase === "segmenting" || phase === "submitting"
                  ? "cursor-wait"
                  : "cursor-crosshair"
              )}
            />
            {mask && (
              <div
                aria-hidden
                className="absolute inset-0 pointer-events-none bg-[var(--color-accent)] opacity-55 transition-opacity duration-200"
                style={
                  {
                    WebkitMaskImage: `url(${mask.url})`,
                    WebkitMaskMode: "luminance",
                    WebkitMaskSize: "100% 100%",
                    WebkitMaskRepeat: "no-repeat",
                    maskImage: `url(${mask.url})`,
                    maskMode: "luminance",
                    maskSize: "100% 100%",
                    maskRepeat: "no-repeat",
                  } as React.CSSProperties
                }
              />
            )}
            {phase === "segmenting" && (
              <div className="absolute inset-0 grid place-items-center bg-black/30">
                <div className="flex items-center gap-2 px-3 py-2 rounded-md bg-black/70 text-white text-[12px]">
                  <Loader2 className="size-4 animate-spin" />
                  detecting…
                </div>
              </div>
            )}
          </div>
        </div>

        <footer className="shrink-0 rounded-xl bg-[var(--color-bg-elevated)] border border-[var(--color-border)] p-3">
          {phase === "editing" ? (
            <div className="space-y-2">
              <TextArea
                autoFocus
                value={editText}
                onChange={(e) => setEditText(e.target.value)}
                onKeyDown={onEditKeyDown}
                placeholder="e.g. change the shirt to bright red, or add sunglasses…"
                className="min-h-[80px]"
              />
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] text-[var(--color-muted-dim)] flex items-center gap-1.5">
                  <Kbd>⌘</Kbd>
                  <Kbd>↵</Kbd>
                  <span>to submit</span>
                </span>
                <div className="flex gap-2">
                  <Button variant="secondary" size="sm" onClick={() => setPhase("selected")}>
                    cancel
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => submit("edit")}
                    disabled={!editText.trim()}
                  >
                    <Wand2 className="size-3.5" />
                    apply edit
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between gap-3">
              <span className="text-[11px] text-[var(--color-muted-dim)]">
                {mask
                  ? "object selected · pick an action"
                  : "click the image to select an object"}
              </span>
              <div className="flex gap-2">
                {mask && (
                  <Button variant="secondary" size="sm" onClick={reselect}>
                    reselect
                  </Button>
                )}
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => submit("remove")}
                  disabled={!mask || phase === "submitting"}
                  className="text-[var(--color-danger)] hover:text-[var(--color-danger)]"
                >
                  <Trash2 className="size-3.5" />
                  remove
                </Button>
                <Button
                  size="sm"
                  onClick={() => setPhase("editing")}
                  disabled={!mask || phase === "submitting"}
                >
                  <Wand2 className="size-3.5" />
                  edit…
                </Button>
              </div>
            </div>
          )}
        </footer>
      </div>
    </div>
  );
}
