"use client";

import { useEffect, useState } from "react";
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, Loader2, Sparkles, X } from "lucide-react";
import { Button, Field, Kbd, Select, TextArea } from "@/components/fields";
import { cn } from "@/lib/utils";
import type { StoredAsset } from "@/lib/storage";
import type { StartJob, EndJob } from "@/app/page";

type Direction = "left" | "right" | "top" | "bottom";

const AMOUNTS = [
  { value: "0.25", label: "25%" },
  { value: "0.5", label: "50%" },
  { value: "0.75", label: "75%" },
  { value: "1", label: "100%" },
];

export function OutpaintModal({
  asset,
  startJob,
  endJob,
  onClose,
}: {
  asset: StoredAsset;
  startJob: StartJob;
  endJob: EndJob;
  onClose: () => void;
}) {
  const [directions, setDirections] = useState<Set<Direction>>(
    new Set(["left", "right"])
  );
  const [amount, setAmount] = useState("0.5");
  const [prompt, setPrompt] = useState("");
  const [submitting, setSubmitting] = useState(false);
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

  function toggle(d: Direction) {
    setDirections((prev) => {
      const next = new Set(prev);
      if (next.has(d)) next.delete(d);
      else next.add(d);
      return next;
    });
  }

  async function submit() {
    if (directions.size === 0 || submitting) return;
    setSubmitting(true);
    setError(null);

    const jobId = startJob({
      kind: "edit",
      prompt: prompt.trim() || "Outpaint",
      count: 1,
    });

    try {
      const res = await fetch("/api/outpaint", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: asset.id,
          prompt: prompt.trim() || undefined,
          directions: Array.from(directions),
          amount: parseFloat(amount),
          quality: "high",
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        endJob(jobId, { error: json.error || "outpaint failed" });
        setError(json.error || "outpaint failed");
        setSubmitting(false);
        return;
      }
      endJob(jobId, { assets: [json.asset] });
      onClose();
    } catch (e) {
      const message = e instanceof Error ? e.message : "outpaint failed";
      endJob(jobId, { error: message });
      setError(message);
      setSubmitting(false);
    }
  }

  const factor = parseFloat(amount);
  const w = asset.width ?? 0;
  const h = asset.height ?? 0;
  const newW = w + (directions.has("left") ? w * factor : 0) + (directions.has("right") ? w * factor : 0);
  const newH = h + (directions.has("top") ? h * factor : 0) + (directions.has("bottom") ? h * factor : 0);

  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={onClose}
      className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-6 animate-in"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-[860px] max-h-[calc(100vh-3rem)] grid lg:grid-cols-[1fr_340px] gap-4 min-h-0"
      >
        <div className="bg-black rounded-xl overflow-hidden flex items-center justify-center min-h-0 relative">
          <div className="relative w-full h-full grid place-items-center p-6">
            <div className="relative">
              { }
              <img
                src={asset.url}
                alt={asset.prompt}
                className="max-h-[60vh] max-w-full object-contain block"
              />
              <ExtensionPreview directions={directions} factor={factor} />
            </div>
          </div>
        </div>

        <div className="flex flex-col bg-[var(--color-bg-elevated)] border border-[var(--color-border)] rounded-xl overflow-hidden min-h-0">
          <header className="flex items-center justify-between h-11 px-4 border-b border-[var(--color-border)] shrink-0">
            <div className="flex items-baseline gap-2">
              <h2 className="text-[13px] font-semibold tracking-tight">expand canvas</h2>
              <span className="text-[11px] text-[var(--color-muted)]">outpaint</span>
            </div>
            <button
              onClick={onClose}
              className="size-6 rounded-md grid place-items-center text-[var(--color-muted)] hover:text-[var(--color-fg)] hover:bg-[var(--color-surface)] transition"
              aria-label="close"
            >
              <X className="size-3.5" />
            </button>
          </header>

          <div className="flex-1 overflow-y-auto p-4 space-y-4 min-h-0">
            <div>
              <div className="text-[10px] uppercase tracking-[0.08em] text-[var(--color-muted)] font-semibold mb-2">
                extend in directions
              </div>
              <div className="grid grid-cols-3 grid-rows-3 gap-1 w-[140px] mx-auto">
                <div />
                <DirToggle
                  active={directions.has("top")}
                  onClick={() => toggle("top")}
                  icon={<ArrowUp className="size-3.5" />}
                  label="top"
                />
                <div />
                <DirToggle
                  active={directions.has("left")}
                  onClick={() => toggle("left")}
                  icon={<ArrowLeft className="size-3.5" />}
                  label="left"
                />
                <div className="rounded-md border border-dashed border-[var(--color-border)] grid place-items-center text-[10px] text-[var(--color-muted)]">
                  src
                </div>
                <DirToggle
                  active={directions.has("right")}
                  onClick={() => toggle("right")}
                  icon={<ArrowRight className="size-3.5" />}
                  label="right"
                />
                <div />
                <DirToggle
                  active={directions.has("bottom")}
                  onClick={() => toggle("bottom")}
                  icon={<ArrowDown className="size-3.5" />}
                  label="bottom"
                />
                <div />
              </div>
            </div>

            <Field label="amount" hint={`new size ~ ${Math.round(newW)} × ${Math.round(newH)}`}>
              <Select
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                options={AMOUNTS}
              />
            </Field>

            <Field label="prompt (optional)" hint="describe what fills the new area">
              <TextArea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="leave empty to seamlessly extend the existing scene…"
                className="min-h-[80px]"
              />
            </Field>

            {error && (
              <p className="text-[11px] text-[var(--color-danger)]" role="alert">
                {error}
              </p>
            )}
          </div>

          <div className="border-t border-[var(--color-border)] p-3 flex items-center justify-between gap-3 shrink-0">
            <span className="text-[11px] text-[var(--color-muted-dim)] flex items-center gap-1.5">
              <Kbd>esc</Kbd>
              <span>to cancel</span>
            </span>
            <Button
              onClick={submit}
              disabled={directions.size === 0 || submitting}
              loading={submitting}
            >
              {!submitting && <Sparkles className="size-3.5" />}
              expand
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function DirToggle({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      title={label}
      className={cn(
        "size-9 rounded-md grid place-items-center transition-colors",
        active
          ? "bg-[var(--color-accent)] text-[var(--color-fg-on-accent)]"
          : "bg-[var(--color-surface)] border border-[var(--color-border)] text-[var(--color-muted)] hover:text-[var(--color-fg)] hover:border-[var(--color-border-strong)]"
      )}
    >
      {icon}
    </button>
  );
}

function ExtensionPreview({
  directions,
  factor,
}: {
  directions: Set<Direction>;
  factor: number;
}) {
  // Visualize where the canvas will extend with subtle dashed overlay areas.
  const pct = Math.min(1, factor) * 100;
  return (
    <>
      {directions.has("left") && (
        <div
          className="absolute top-0 bottom-0 border-r-2 border-dashed border-[var(--color-accent)] bg-[var(--color-accent)]/10 pointer-events-none"
          style={{ right: "100%", width: `${pct}%` }}
        />
      )}
      {directions.has("right") && (
        <div
          className="absolute top-0 bottom-0 border-l-2 border-dashed border-[var(--color-accent)] bg-[var(--color-accent)]/10 pointer-events-none"
          style={{ left: "100%", width: `${pct}%` }}
        />
      )}
      {directions.has("top") && (
        <div
          className="absolute left-0 right-0 border-b-2 border-dashed border-[var(--color-accent)] bg-[var(--color-accent)]/10 pointer-events-none"
          style={{ bottom: "100%", height: `${pct}%` }}
        />
      )}
      {directions.has("bottom") && (
        <div
          className="absolute left-0 right-0 border-t-2 border-dashed border-[var(--color-accent)] bg-[var(--color-accent)]/10 pointer-events-none"
          style={{ top: "100%", height: `${pct}%` }}
        />
      )}
    </>
  );
}
