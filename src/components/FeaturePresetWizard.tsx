"use client";

import { useEffect, useState } from "react";
import { ArrowRight, Check, Settings as SettingsIcon, X } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  FEATURE_KEYS,
  FEATURE_LABELS,
  PRESET_FLAGS,
  PRESET_LABELS,
  presetPatch,
  useSettings,
  type UiPreset,
} from "@/lib/settings";

// First-run preset picker. Fires once when `settings.wizardSeen` is false,
// then never again — picking a preset (or dismissing) sets wizardSeen so
// reloads stop showing it.
//
// The wizard is purely a *downgrade* affordance: defaults already enable
// every feature, so dismissing without picking is harmless. "Custom" just
// punts to the regular Settings → Features tab.

const PRESETS: UiPreset[] = ["basic", "medium", "advanced", "custom"];

export function FeaturePresetWizard({
  onOpenSettings,
}: {
  // Called when the user clicks the Custom card — lets the parent open the
  // full Settings modal pre-scrolled to the Features tab.
  onOpenSettings?: () => void;
}) {
  const { settings, update } = useSettings();
  // Local guard: settings hydrate from localStorage post-mount, so during
  // SSR + first paint wizardSeen is false from DEFAULT_SETTINGS. Without
  // this delay the modal would flash on screen for users who already
  // dismissed it on a previous visit.
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => {
    setHydrated(true);
  }, []);

  function pick(preset: UiPreset) {
    update({ ...presetPatch(preset), wizardSeen: true });
    if (preset === "custom" && onOpenSettings) {
      onOpenSettings();
    }
  }

  function dismiss() {
    // No preset chosen — keep the existing defaults (advanced) but stop
    // showing the wizard on subsequent reloads.
    update({ wizardSeen: true });
  }

  if (!hydrated || settings.wizardSeen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="welcome — pick a feature preset"
      className="fixed inset-0 z-[60] bg-black/85 backdrop-blur-md flex items-center justify-center p-6 animate-in"
    >
      <div
        className="w-full max-w-[720px] max-h-[calc(100vh-3rem)] rounded-xl border border-[var(--color-border)] overflow-hidden flex flex-col"
        style={{ backgroundColor: "var(--color-bg-elevated)" }}
      >
        <header className="flex items-start justify-between px-5 pt-5 pb-3 shrink-0">
          <div className="min-w-0">
            <h2 className="text-[15px] font-semibold tracking-tight">
              Welcome — pick a UI preset
            </h2>
            <p className="text-[12px] text-[var(--color-muted)] mt-1 leading-snug">
              Power features can hide more than they help when you&apos;re still
              getting your bearings. Pick how much surface you want on screen;
              you can change this at any time in Settings → Features.
            </p>
          </div>
          <button
            type="button"
            onClick={dismiss}
            className="size-7 -mr-1.5 -mt-1.5 rounded-md grid place-items-center text-[var(--color-muted)] hover:text-[var(--color-fg)] hover:bg-[var(--color-surface)] transition shrink-0"
            aria-label="skip (keeps everything enabled)"
            title="skip — keeps everything enabled"
          >
            <X className="size-3.5" />
          </button>
        </header>

        <div className="px-5 pb-5 overflow-y-auto">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {PRESETS.map((p) => (
              <PresetCard key={p} preset={p} onPick={() => pick(p)} />
            ))}
          </div>
        </div>

        <footer className="border-t border-[var(--color-border)] px-5 py-3 flex items-center justify-between gap-3 shrink-0">
          <span className="text-[11px] text-[var(--color-muted-dim)]">
            Skipping keeps everything enabled (same as Advanced).
          </span>
          <button
            type="button"
            onClick={dismiss}
            className="inline-flex items-center justify-center h-8 px-3 rounded-md bg-[var(--color-surface)] hover:bg-[var(--color-surface-hover)] border border-[var(--color-border)] text-[12px] font-medium transition"
          >
            Skip for now
          </button>
        </footer>
      </div>
    </div>
  );
}

function PresetCard({
  preset,
  onPick,
}: {
  preset: UiPreset;
  onPick: () => void;
}) {
  const meta = PRESET_LABELS[preset];
  const flags = preset === "custom" ? null : PRESET_FLAGS[preset];

  return (
    <button
      type="button"
      onClick={onPick}
      className={cn(
        "group text-left rounded-lg border p-4 transition-colors",
        preset === "advanced"
          ? "border-[var(--color-accent)]/40 bg-[var(--color-accent-dim)] hover:border-[var(--color-accent)]"
          : "border-[var(--color-border)] bg-[var(--color-surface)] hover:border-[var(--color-border-strong)]"
      )}
    >
      <div className="flex items-baseline justify-between mb-2">
        <div className="flex items-baseline gap-2">
          <span className="text-[13.5px] font-semibold tracking-tight">
            {meta.title}
          </span>
          {preset === "advanced" && (
            <span className="text-[9px] uppercase tracking-wider font-semibold text-[var(--color-accent)]">
              default
            </span>
          )}
        </div>
        {preset === "custom" ? (
          <SettingsIcon className="size-3.5 text-[var(--color-muted)] group-hover:text-[var(--color-fg)] transition" />
        ) : (
          <ArrowRight className="size-3.5 text-[var(--color-muted)] group-hover:text-[var(--color-fg)] transition" />
        )}
      </div>

      <p className="text-[11.5px] text-[var(--color-muted)] leading-snug mb-3">
        {meta.hint}
      </p>

      {flags && (
        <ul className="space-y-1">
          {FEATURE_KEYS.map((key) => {
            const on = flags[key];
            return (
              <li
                key={key}
                className={cn(
                  "flex items-center gap-1.5 text-[10.5px]",
                  on
                    ? "text-[var(--color-fg-dim)]"
                    : "text-[var(--color-muted-dim)]"
                )}
              >
                <span
                  className={cn(
                    "size-3 rounded-full grid place-items-center shrink-0",
                    on
                      ? "bg-[var(--color-accent)] text-[var(--color-fg-on-accent)]"
                      : "border border-[var(--color-border-strong)]"
                  )}
                  aria-hidden
                >
                  {on && <Check className="size-2" strokeWidth={3} />}
                </span>
                <span className={cn(!on && "line-through")}>
                  {FEATURE_LABELS[key].title}
                </span>
              </li>
            );
          })}
        </ul>
      )}

      {!flags && (
        <p className="text-[10.5px] text-[var(--color-muted)] italic">
          Pick features one by one after closing this wizard.
        </p>
      )}
    </button>
  );
}
