"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { cn } from "@/lib/utils";
import { APP_NAME, APP_VERSION, BUILD_SHA, formatVersion } from "@/lib/version";

// Subtle build identifier shown in the studio header + dashboard sidebar.
// Two layouts:
//   - "pill"    — compact monospace chip for the top bar; just shows the
//                 version (and SHA if present) with a tooltip + click-to-
//                 copy. Designed to fade into the brand area.
//   - "stacked" — two-line variant for the dashboard sidebar footer, with
//                 the package name + version on one row and the SHA below.
//                 Whole block is clickable to copy.
//
// Both flavors expose the same identifier so bug reports always quote the
// same string regardless of where the user grabbed it from.

export function VersionBadge({
  variant = "pill",
  className,
}: {
  variant?: "pill" | "stacked";
  className?: string;
}) {
  const [copied, setCopied] = useState(false);
  const display = formatVersion();

  async function copy() {
    try {
      await navigator.clipboard.writeText(display);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // ignore — clipboard may be unavailable in non-secure contexts
    }
  }

  if (variant === "stacked") {
    return (
      <button
        type="button"
        onClick={copy}
        title={`${display} · click to copy`}
        className={cn(
          "group w-full text-left px-2.5 py-2 rounded-md text-[var(--color-muted)] hover:text-[var(--color-fg-dim)] hover:bg-[var(--color-surface)] transition",
          className
        )}
      >
        <div className="flex items-center justify-between gap-2">
          <span className="text-[10.5px] font-medium tracking-tight">
            {APP_NAME}{" "}
            <span className="text-[var(--color-muted-dim)]">v{APP_VERSION}</span>
          </span>
          <span className="size-3 text-[var(--color-muted-dim)] group-hover:text-[var(--color-muted)] transition">
            {copied ? (
              <Check className="size-3" />
            ) : (
              <Copy className="size-3" />
            )}
          </span>
        </div>
        {BUILD_SHA && (
          <div className="text-[10px] font-mono text-[var(--color-muted-dim)] tabular-nums mt-0.5">
            {BUILD_SHA}
          </div>
        )}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={copy}
      title={`${display} · click to copy`}
      aria-label={`build version ${display}`}
      className={cn(
        "hidden lg:inline-flex items-center gap-1 h-6 px-1.5 rounded text-[10px] font-mono tabular-nums text-[var(--color-muted)] hover:text-[var(--color-fg-dim)] hover:bg-[var(--color-surface)] transition",
        className
      )}
    >
      v{APP_VERSION}
      {BUILD_SHA && (
        <span className="text-[var(--color-muted-dim)]">· {BUILD_SHA}</span>
      )}
      {copied && <Check className="size-3 text-[var(--color-success)]" />}
    </button>
  );
}
