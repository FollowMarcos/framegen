"use client";

import { useCallback, useEffect, useState } from "react";
import {
  AlertCircle,
  Check,
  CheckCircle2,
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";

type Status = {
  source: "env" | "file" | "none";
  maskedHint: string | null;
};

// Dashboard card that lets a user paste their fal Admin key from the UI
// instead of editing .env.local. Lookup precedence on the server is
// env-var > file > nothing, so users running under Docker / CI keep
// deterministic env behaviour; this card just exposes the *file* slot
// (`.te-config.json` at the project root) for the local-first case.
export function FalKeyCard() {
  const [status, setStatus] = useState<Status | null>(null);
  const [draft, setDraft] = useState("");
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState<null | "save" | "clear">(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/account/fal-key", { cache: "no-store" });
      const json = (await res.json()) as Status;
      setStatus(json);
    } catch {
      setStatus({ source: "none", maskedHint: null });
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function handleSave() {
    if (!draft.trim()) return;
    setBusy("save");
    setError(null);
    setSuccess(false);
    try {
      const res = await fetch("/api/account/fal-key", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ key: draft.trim(), test: true }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || `request failed (${res.status})`);
        return;
      }
      setStatus(json.status as Status);
      setDraft("");
      setVisible(false);
      setSuccess(true);
      // Clear the success flash after a moment — the masked hint
      // stays as the persistent indicator.
      setTimeout(() => setSuccess(false), 2500);
    } catch (e) {
      setError(e instanceof Error ? e.message : "request failed");
    } finally {
      setBusy(null);
    }
  }

  async function handleClear() {
    if (!confirm("Remove the dashboard-set fal key? Generation will fail until a new one is set or FAL_ADMIN_KEY is back in env.")) {
      return;
    }
    setBusy("clear");
    setError(null);
    try {
      const res = await fetch("/api/account/fal-key", { method: "DELETE" });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || `request failed (${res.status})`);
        return;
      }
      setStatus(json.status as Status);
    } catch (e) {
      setError(e instanceof Error ? e.message : "request failed");
    } finally {
      setBusy(null);
    }
  }

  if (!status) {
    return (
      <section className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 flex items-center justify-center h-24">
        <Loader2 className="size-4 animate-spin text-[var(--color-muted)]" />
      </section>
    );
  }

  const active = status.source !== "none";

  return (
    <section
      className={cn(
        "rounded-xl border bg-[var(--color-surface)] p-4 transition-colors",
        active
          ? "border-emerald-500/30"
          : "border-[var(--color-danger)]/30"
      )}
    >
      <header className="flex items-start gap-3 mb-3">
        <div
          className={cn(
            "relative size-9 rounded-md grid place-items-center shrink-0 transition-colors",
            active
              ? "bg-emerald-500/10 text-emerald-500"
              : "bg-[var(--color-danger)]/10 text-[var(--color-danger)]"
          )}
        >
          <KeyRound className="size-4" />
          {/* Status pip overlapping the icon corner — peripheral-vision
              cue so the user can spot the state from across the
              dashboard without parsing the label. */}
          <span
            className={cn(
              "absolute -top-0.5 -right-0.5 size-3 rounded-full border-2 border-[var(--color-surface)]",
              active ? "bg-emerald-500" : "bg-[var(--color-danger)]"
            )}
            aria-hidden
          />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <div className="text-[10px] uppercase tracking-[0.08em] font-semibold text-[var(--color-muted)]">
              fal API key
            </div>
            <StatusPill status={status} />
          </div>
          <h2 className="text-[14px] font-semibold tracking-tight mt-0.5">
            <StatusLabel status={status} />
          </h2>
          <p className="text-[11.5px] text-[var(--color-muted)] mt-1 leading-relaxed">
            <StatusDescription status={status} />
          </p>
        </div>
      </header>

      <div className="space-y-2">
        <label className="block">
          <span className="block text-[10px] font-semibold uppercase tracking-wider text-[var(--color-muted)] mb-1">
            {status.source === "file" ? "Replace key" : "Paste key"}
          </span>
          <div className="relative">
            <input
              type={visible ? "text" : "password"}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="00000000-0000-0000-0000-000000000000:abcdef…"
              spellCheck={false}
              // Chrome / Safari ignore autoComplete="off" on password
              // fields. "new-password" reliably opts out of saved-
              // credential autofill. The neutral name + 1P/LastPass
              // hints stop those extensions from filling either.
              name="fal-admin-key"
              autoComplete="new-password"
              data-1p-ignore=""
              data-lpignore="true"
              className="w-full h-9 px-2.5 pr-9 rounded-md bg-[var(--color-bg-elevated)] border border-[var(--color-border)] text-[12px] font-mono text-[var(--color-fg)] outline-none focus:border-[var(--color-border-strong)] transition-colors"
              aria-label="fal Admin key"
            />
            <button
              type="button"
              onClick={() => setVisible((v) => !v)}
              aria-label={visible ? "hide key" : "show key"}
              title={visible ? "hide" : "show"}
              className="absolute right-1 top-1/2 -translate-y-1/2 size-7 grid place-items-center text-[var(--color-muted)] hover:text-[var(--color-fg)] rounded transition"
            >
              {visible ? (
                <EyeOff className="size-3.5" />
              ) : (
                <Eye className="size-3.5" />
              )}
            </button>
          </div>
        </label>

        {error && (
          <div className="flex items-start gap-1.5 text-[11px] text-[var(--color-danger)] bg-[var(--color-danger)]/10 border border-[var(--color-danger)]/30 rounded px-2 py-1.5">
            <X className="size-3.5 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}
        {success && (
          <div className="flex items-center gap-1.5 text-[11px] text-[var(--color-accent)] bg-[var(--color-accent-dim)] border border-[var(--color-accent)]/30 rounded px-2 py-1.5">
            <Check className="size-3.5 shrink-0" />
            <span>Key verified with fal &amp; saved.</span>
          </div>
        )}

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleSave}
            disabled={busy !== null || !draft.trim()}
            className={cn(
              "h-9 px-3 rounded-md text-[12px] font-semibold inline-flex items-center gap-1.5 transition",
              "bg-[var(--color-accent)] text-[var(--color-fg-on-accent)]",
              "hover:bg-[var(--color-accent-hover)]",
              "disabled:opacity-40 disabled:cursor-not-allowed"
            )}
          >
            {busy === "save" ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Check className="size-3.5" />
            )}
            Test &amp; save
          </button>
          {status.source === "file" && (
            <button
              type="button"
              onClick={handleClear}
              disabled={busy !== null}
              className="h-9 px-3 rounded-md text-[12px] font-medium inline-flex items-center gap-1.5 border border-[var(--color-border)] bg-[var(--color-bg-elevated)] hover:bg-[var(--color-surface-hover)] hover:border-[var(--color-border-strong)] transition disabled:opacity-40"
            >
              {busy === "clear" ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <X className="size-3.5" />
              )}
              Remove
            </button>
          )}
        </div>
        <p className="text-[10.5px] text-[var(--color-muted)] leading-snug">
          Stored locally at{" "}
          <code className="font-mono">./.te-config.json</code>. Never sent to
          the browser. <code className="font-mono">FAL_ADMIN_KEY</code> in
          your environment overrides this.{" "}
          <a
            href="https://fal.ai/dashboard/keys"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[var(--color-accent)] hover:text-[var(--color-accent-hover)]"
          >
            Get an Admin-scope key
          </a>
          .
        </p>
      </div>
    </section>
  );
}

// Compact status badge surfaced next to the section heading. Splits
// "active" into two flavours (env vs file) so the user can tell which
// slot the live credential is coming from at a glance — both render
// as a green pill since either means "things will work".
function StatusPill({ status }: { status: Status }) {
  if (status.source === "none") {
    return (
      <span className="inline-flex items-center gap-1 h-4 px-1.5 rounded text-[10px] font-semibold tracking-wide uppercase bg-[var(--color-danger)]/15 text-[var(--color-danger)]">
        <AlertCircle className="size-3" />
        Not set
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 h-4 px-1.5 rounded text-[10px] font-semibold tracking-wide uppercase bg-emerald-500/15 text-emerald-400">
      <CheckCircle2 className="size-3" />
      Active{" "}
      <span className="opacity-70 font-normal normal-case">
        · {status.source}
      </span>
    </span>
  );
}

function StatusLabel({ status }: { status: Status }) {
  if (status.source === "env") {
    return (
      <>
        Set via environment{" "}
        <span className="text-[var(--color-muted)] font-mono text-[11px]">
          {status.maskedHint}
        </span>
      </>
    );
  }
  if (status.source === "file") {
    return (
      <>
        Set via dashboard{" "}
        <span className="text-[var(--color-muted)] font-mono text-[11px]">
          {status.maskedHint}
        </span>
      </>
    );
  }
  return <span className="text-[var(--color-danger)]">Not set</span>;
}

function StatusDescription({ status }: { status: Status }) {
  if (status.source === "env") {
    return (
      <>
        Reading from{" "}
        <code className="font-mono">FAL_ADMIN_KEY</code> /{" "}
        <code className="font-mono">FAL_KEY</code>. The dashboard-set value
        below is stored but won&apos;t take effect until you remove the env
        var.
      </>
    );
  }
  if (status.source === "file") {
    return (
      <>
        Reading from <code className="font-mono">.te-config.json</code> set
        from this dashboard. Replace the key below at any time.
      </>
    );
  }
  return (
    <>
      No fal credential found. Paste your Admin-scope key below to start
      generating, or set <code className="font-mono">FAL_ADMIN_KEY</code> in
      your environment.
    </>
  );
}
