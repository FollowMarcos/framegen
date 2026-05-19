"use client";

import { Suspense, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Lock, ArrowRight } from "lucide-react";
import { DEFAULT_APP_TITLE, useSettings } from "@/lib/settings";

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next") || "/";
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const { settings } = useSettings();
  const appTitle = settings.appTitle?.trim() || DEFAULT_APP_TITLE;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });
    if (!res.ok) {
      setError("incorrect password");
      return;
    }
    startTransition(() => {
      router.replace(next);
      router.refresh();
    });
  }

  return (
    <form
      onSubmit={onSubmit}
      className="w-full max-w-[360px] rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-elevated)] p-7"
      style={{ boxShadow: "0 24px 48px -12px rgba(0,0,0,0.6)" }}
    >
      <div className="flex items-center gap-2.5 mb-7">
        <div className="size-7 rounded-md bg-[var(--color-accent)] grid place-items-center">
          <span className="text-[11px] font-bold text-[var(--color-fg-on-accent)] tracking-tighter">
            {appTitle.slice(0, 2).toLowerCase()}
          </span>
        </div>
        <div>
          <div className="text-[13px] font-semibold tracking-tight leading-tight">{appTitle}</div>
          <div className="text-[10px] text-[var(--color-muted)] leading-tight font-[family-name:var(--font-mono)]">
            gpt-image-2
          </div>
        </div>
      </div>

      <label className="block">
        <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--color-muted)] mb-2 block">
          Password
        </span>
        <div className="relative">
          <Lock className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-[var(--color-muted)]" />
          <input
            id="password"
            type="password"
            autoFocus
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-md bg-[var(--color-surface)] border border-[var(--color-border)] pl-8 pr-3 py-2 text-[13px] outline-none transition-colors hover:border-[var(--color-border-strong)]"
            placeholder="••••••••"
          />
        </div>
      </label>

      {error && (
        <p className="mt-3 text-[11px] text-[var(--color-danger)]" role="alert">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={pending || password.length === 0}
        className="mt-5 w-full inline-flex items-center justify-center gap-1.5 h-9 rounded-md bg-[var(--color-accent)] text-[var(--color-fg-on-accent)] text-[13px] font-medium hover:bg-[var(--color-accent-hover)] disabled:opacity-40 disabled:cursor-not-allowed transition"
      >
        {pending ? (
          <>
            <span className="size-1.5 rounded-full bg-current animate-pulse" />
            unlocking
          </>
        ) : (
          <>
            Unlock
            <ArrowRight className="size-3.5" />
          </>
        )}
      </button>

      <p className="mt-6 pt-5 border-t border-[var(--color-border)] text-[10px] text-[var(--color-muted-dim)] text-center font-[family-name:var(--font-mono)]">
        local · private · self-hosted
      </p>
    </form>
  );
}

export default function LoginPage() {
  return (
    <main className="min-h-screen grid place-items-center px-6 relative overflow-hidden">
      <div
        aria-hidden
        className="absolute inset-0 pointer-events-none opacity-50"
        style={{
          background:
            "radial-gradient(800px circle at 50% 0%, rgba(167,139,250,0.10), transparent 60%)",
        }}
      />
      <Suspense fallback={null}>
        <LoginForm />
      </Suspense>
    </main>
  );
}
