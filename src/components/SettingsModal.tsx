"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, Check, X } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  DEFAULT_APP_TITLE,
  DEFAULT_SETTINGS,
  FEATURE_KEYS,
  FEATURE_LABELS,
  MAX_APP_TITLE_LENGTH,
  PAGE_SIZE_OPTIONS,
  PRESET_FLAGS,
  PRESET_LABELS,
  formatPageSize,
  presetPatch,
  type FeatureKey,
  type Settings,
  type UiPreset,
} from "@/lib/settings";
import { THEMES } from "@/lib/themes";

type TabId = "general" | "workspace" | "features" | "theme";

const TABS: { id: TabId; label: string }[] = [
  { id: "general", label: "general" },
  { id: "workspace", label: "workspace" },
  { id: "features", label: "features" },
  { id: "theme", label: "theme" },
];

export function SettingsModal({
  settings,
  onChange,
  onClose,
  libraryCount,
  initialTab,
}: {
  settings: Settings;
  onChange: (patch: Partial<Settings>) => void;
  onClose: () => void;
  libraryCount: number;
  // Open the modal pre-scrolled to a specific tab. Used by the first-run
  // wizard's "Custom" path so the user lands directly on the Features list
  // instead of seeing "general" first and hunting for the right page.
  initialTab?: string;
}) {
  const [tab, setTab] = useState<TabId>(() => {
    if (initialTab && TABS.some((t) => t.id === initialTab)) {
      return initialTab as TabId;
    }
    return "general";
  });

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

  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={onClose}
      className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-6 animate-in"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-[560px] max-h-[calc(100vh-3rem)] rounded-xl border border-[var(--color-border)] overflow-hidden flex flex-col"
        style={{ backgroundColor: "var(--color-bg-elevated)" }}
      >
        <header className="flex items-center justify-between h-11 px-4 border-b border-[var(--color-border)] shrink-0">
          <h2 className="text-[13px] font-semibold tracking-tight">settings</h2>
          <button
            onClick={onClose}
            className="size-6 rounded-md grid place-items-center text-[var(--color-muted)] hover:text-[var(--color-fg)] hover:bg-[var(--color-surface)] transition"
            aria-label="close"
          >
            <X className="size-3.5" />
          </button>
        </header>

        <nav
          role="tablist"
          aria-label="settings sections"
          className="flex items-center gap-1 px-3 pt-2 border-b border-[var(--color-border)] shrink-0"
        >
          {TABS.map((t) => {
            const active = t.id === tab;
            return (
              <button
                key={t.id}
                role="tab"
                aria-selected={active}
                aria-controls={`settings-panel-${t.id}`}
                id={`settings-tab-${t.id}`}
                type="button"
                onClick={() => setTab(t.id)}
                className={cn(
                  "h-8 px-3 text-[12px] font-medium transition-colors relative",
                  active
                    ? "text-[var(--color-fg)]"
                    : "text-[var(--color-muted)] hover:text-[var(--color-fg-dim)]"
                )}
              >
                {t.label}
                {active && (
                  <span
                    className="absolute left-2 right-2 -bottom-px h-px bg-[var(--color-accent)]"
                    aria-hidden
                  />
                )}
              </button>
            );
          })}
        </nav>

        <div className="p-4 overflow-y-auto flex-1 min-h-0">
          {tab === "general" && (
            <div
              id="settings-panel-general"
              role="tabpanel"
              aria-labelledby="settings-tab-general"
              className="space-y-6"
            >
              <GeneralTab
                settings={settings}
                onChange={onChange}
                libraryCount={libraryCount}
              />
            </div>
          )}

          {tab === "workspace" && (
            <div
              id="settings-panel-workspace"
              role="tabpanel"
              aria-labelledby="settings-tab-workspace"
            >
              <WorkspaceTab settings={settings} onChange={onChange} />
            </div>
          )}

          {tab === "features" && (
            <div
              id="settings-panel-features"
              role="tabpanel"
              aria-labelledby="settings-tab-features"
            >
              <FeaturesTab settings={settings} onChange={onChange} />
            </div>
          )}

          {tab === "theme" && (
            <div
              id="settings-panel-theme"
              role="tabpanel"
              aria-labelledby="settings-tab-theme"
            >
              <ThemeTab settings={settings} onChange={onChange} />
            </div>
          )}
        </div>

        <footer className="border-t border-[var(--color-border)] p-3 flex justify-end shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center justify-center h-8 px-3 rounded-md bg-[var(--color-surface)] hover:bg-[var(--color-surface-hover)] border border-[var(--color-border)] text-[12px] font-medium transition"
          >
            done
          </button>
        </footer>
      </div>
    </div>
  );
}

// --- tab contents ---------------------------------------------------------

function SectionHeader({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="flex items-baseline justify-between mb-1.5">
      <span className="text-[10px] uppercase tracking-[0.08em] font-semibold text-[var(--color-muted)]">
        {title}
      </span>
      {hint && (
        <span className="text-[10px] text-[var(--color-muted-dim)]">{hint}</span>
      )}
    </div>
  );
}

function GeneralTab({
  settings,
  onChange,
  libraryCount,
}: {
  settings: Settings;
  onChange: (patch: Partial<Settings>) => void;
  libraryCount: number;
}) {
  const willBeUnlimited = settings.pageSize === 0;
  const heavyUnlimited = willBeUnlimited && libraryCount > 500;

  return (
    <>
      <section>
        <SectionHeader title="app title" hint="shown in the header & browser tab" />
        <input
          type="text"
          value={settings.appTitle}
          onChange={(e) =>
            onChange({ appTitle: e.target.value.slice(0, MAX_APP_TITLE_LENGTH) })
          }
          placeholder={DEFAULT_APP_TITLE}
          maxLength={MAX_APP_TITLE_LENGTH}
          spellCheck={false}
          className="w-full h-9 px-3 rounded-md bg-[var(--color-surface)] border border-[var(--color-border)] text-[13px] text-[var(--color-fg)] placeholder:text-[var(--color-muted-dim)] outline-none hover:border-[var(--color-border-strong)] focus:border-[var(--color-accent)] transition-colors"
          aria-label="App title"
        />
        <p className="mt-2 text-[11px] text-[var(--color-muted)] leading-snug">
          The first two characters also seed the small logo mark next to the title.
        </p>
      </section>

      <section>
        <SectionHeader
          title="library page size"
          hint="how many cards to render at a time"
        />
        <div className="grid grid-cols-5 gap-1 p-0.5 rounded-md bg-[var(--color-surface)] border border-[var(--color-border)]">
          {PAGE_SIZE_OPTIONS.map((opt) => {
            const selected = opt === settings.pageSize;
            return (
              <button
                key={opt}
                type="button"
                onClick={() => onChange({ pageSize: opt })}
                className={cn(
                  "h-8 rounded text-[12px] font-medium transition-colors",
                  selected
                    ? "bg-[var(--color-bg-elevated)] text-[var(--color-fg)] shadow-sm"
                    : "text-[var(--color-muted)] hover:text-[var(--color-fg-dim)]"
                )}
                style={selected ? { backgroundColor: "#16161a" } : undefined}
              >
                {formatPageSize(opt)}
              </button>
            );
          })}
        </div>
        <p className="mt-2 text-[11px] text-[var(--color-muted)] leading-snug">
          The library renders this many cards on first paint. Scroll near the bottom and
          another page loads in. Lower it on slow machines or huge libraries; raise it if
          you like fewer scroll-loads.
        </p>
        {heavyUnlimited && (
          <div className="mt-2 flex items-start gap-2 rounded-md border border-yellow-500/30 bg-yellow-500/5 px-3 py-2">
            <AlertTriangle className="size-3.5 text-yellow-400 shrink-0 mt-0.5" />
            <p className="text-[11px] text-[var(--color-fg-dim)] leading-snug">
              Unlimited will render all {libraryCount} cards at once. That can feel sluggish on
              large libraries — pick a number unless you have a reason.
            </p>
          </div>
        )}
      </section>
    </>
  );
}

function WorkspaceTab({
  settings,
  onChange,
}: {
  settings: Settings;
  onChange: (patch: Partial<Settings>) => void;
}) {
  return (
    <section>
      <SectionHeader title="studio panel" hint="where the generation form lives" />
      <div className="grid grid-cols-2 gap-2">
        <MenuLayoutOption
          value="sidebar"
          selected={settings.menuLayout === "sidebar"}
          onSelect={() => onChange({ menuLayout: "sidebar" })}
          title="Sidebar"
          hint="left column · always open"
        >
          <div className="flex h-full gap-1">
            <div className="w-1/3 rounded-sm bg-[var(--color-accent)]/30 border border-[var(--color-accent)]/50" />
            <div className="flex-1 rounded-sm border border-[var(--color-border)] bg-[var(--color-surface)]" />
          </div>
        </MenuLayoutOption>
        <MenuLayoutOption
          value="dock"
          selected={settings.menuLayout === "dock"}
          onSelect={() => onChange({ menuLayout: "dock" })}
          title="Floating dock"
          hint="bottom island · more library space"
        >
          <div className="flex h-full flex-col gap-1">
            <div className="flex-1 rounded-sm border border-[var(--color-border)] bg-[var(--color-surface)]" />
            <div className="h-1/3 mx-3 rounded-sm bg-[var(--color-accent)]/30 border border-[var(--color-accent)]/50" />
          </div>
        </MenuLayoutOption>
      </div>
    </section>
  );
}

function FeaturesTab({
  settings,
  onChange,
}: {
  settings: Settings;
  onChange: (patch: Partial<Settings>) => void;
}) {
  const flags = settings.featureFlags ?? DEFAULT_SETTINGS.featureFlags;
  const currentPreset: UiPreset = settings.uiPreset ?? "advanced";

  function toggle(key: FeatureKey) {
    onChange({
      uiPreset: "custom",
      featureFlags: { ...flags, [key]: !flags[key] },
    });
  }

  function applyPreset(preset: UiPreset) {
    onChange({ ...presetPatch(preset), wizardSeen: true });
  }

  return (
    <div className="space-y-6">
      <section>
        <SectionHeader
          title="preset"
          hint="quick way to set several toggles at once"
        />
        <div className="grid grid-cols-3 gap-2">
          {(["basic", "medium", "advanced"] as const).map((p) => {
            const selected = currentPreset === p;
            return (
              <button
                key={p}
                type="button"
                onClick={() => applyPreset(p)}
                aria-pressed={selected}
                className={cn(
                  "flex flex-col gap-1 p-2.5 rounded-md border transition-colors text-left",
                  selected
                    ? "border-[var(--color-accent)] bg-[var(--color-accent-dim)]"
                    : "border-[var(--color-border)] bg-[var(--color-surface)] hover:border-[var(--color-border-strong)]"
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[12px] font-medium text-[var(--color-fg)]">
                    {PRESET_LABELS[p].title}
                  </span>
                  {selected && <Check className="size-3 text-[var(--color-accent)]" />}
                </div>
                <span className="text-[10.5px] text-[var(--color-muted)] leading-snug">
                  {countOn(PRESET_FLAGS[p])} of {FEATURE_KEYS.length} on
                </span>
              </button>
            );
          })}
        </div>
        {currentPreset === "custom" && (
          <p className="mt-2 text-[11px] text-[var(--color-muted)] leading-snug">
            You&apos;ve toggled flags individually — picking a preset above will
            overwrite them.
          </p>
        )}
      </section>

      <section>
        <SectionHeader
          title="individual features"
          hint="toggling any of these switches to a custom preset"
        />
        <ul className="space-y-2">
          {FEATURE_KEYS.map((key) => (
            <li key={key}>
              <FeatureToggleRow
                label={FEATURE_LABELS[key].title}
                hint={FEATURE_LABELS[key].hint}
                on={Boolean(flags[key])}
                onChange={() => toggle(key)}
              />
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function FeatureToggleRow({
  label,
  hint,
  on,
  onChange,
}: {
  label: string;
  hint: string;
  on: boolean;
  onChange: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onChange}
      aria-pressed={on}
      className={cn(
        "w-full flex items-start gap-3 p-2.5 rounded-md border transition-colors text-left",
        on
          ? "border-[var(--color-border)] bg-[var(--color-surface)]"
          : "border-[var(--color-border)] bg-transparent opacity-75 hover:opacity-100"
      )}
    >
      <span
        aria-hidden
        className={cn(
          "mt-px relative w-8 h-4 rounded-full transition-colors shrink-0",
          on ? "bg-[var(--color-accent)]" : "bg-[var(--color-border-strong)]"
        )}
      >
        <span
          className={cn(
            "absolute top-0.5 size-3 rounded-full bg-[var(--color-bg-elevated)] transition-transform",
            on ? "translate-x-[18px]" : "translate-x-0.5"
          )}
        />
      </span>
      <span className="flex-1 min-w-0">
        <span className="block text-[12.5px] font-medium text-[var(--color-fg)]">
          {label}
        </span>
        <span className="block text-[11px] text-[var(--color-muted)] leading-snug mt-0.5">
          {hint}
        </span>
      </span>
    </button>
  );
}

function countOn(flags: Record<string, boolean>): number {
  return Object.values(flags).filter(Boolean).length;
}

function ThemeTab({
  settings,
  onChange,
}: {
  settings: Settings;
  onChange: (patch: Partial<Settings>) => void;
}) {
  return (
    <section>
      <SectionHeader title="theme" hint="applies instantly · stored per browser" />
      <ul className="grid grid-cols-1 gap-2">
        {THEMES.map((t) => {
          const selected = settings.themeId === t.id;
          return (
            <li key={t.id}>
              <button
                type="button"
                onClick={() => onChange({ themeId: t.id })}
                aria-pressed={selected}
                className={cn(
                  "w-full flex items-center gap-3 p-2.5 rounded-md border transition-colors text-left",
                  selected
                    ? "border-[var(--color-accent)] bg-[var(--color-accent-dim)]"
                    : "border-[var(--color-border)] bg-[var(--color-surface)] hover:border-[var(--color-border-strong)]"
                )}
              >
                <ThemeSwatch theme={t} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-2">
                    <span className="text-[12.5px] font-medium text-[var(--color-fg)]">
                      {t.name}
                    </span>
                    <span className="text-[10px] uppercase tracking-wider text-[var(--color-muted)] font-mono">
                      {t.type}
                    </span>
                  </div>
                  <p className="text-[11px] text-[var(--color-muted)] mt-0.5 leading-snug">
                    {t.description}
                  </p>
                </div>
                {selected && (
                  <Check className="size-3.5 text-[var(--color-accent)] shrink-0" />
                )}
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

// --- helpers --------------------------------------------------------------

function MenuLayoutOption({
  value,
  selected,
  onSelect,
  title,
  hint,
  children,
}: {
  value: string;
  selected: boolean;
  onSelect: () => void;
  title: string;
  hint: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      aria-label={`${title} layout`}
      onClick={onSelect}
      data-value={value}
      className={cn(
        "flex flex-col gap-2 p-2.5 rounded-md border transition-colors text-left",
        selected
          ? "border-[var(--color-accent)] bg-[var(--color-accent-dim)]"
          : "border-[var(--color-border)] bg-[var(--color-surface)] hover:border-[var(--color-border-strong)]"
      )}
    >
      <div className="h-14 rounded-sm bg-[var(--color-bg)] p-1.5" aria-hidden>
        {children}
      </div>
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-[12px] font-medium text-[var(--color-fg)]">{title}</span>
        {selected && <Check className="size-3 text-[var(--color-accent)]" />}
      </div>
      <span className="text-[10.5px] text-[var(--color-muted)] leading-snug">{hint}</span>
    </button>
  );
}

function ThemeSwatch({ theme }: { theme: import("@/lib/themes").Theme }) {
  const { vars } = theme;
  return (
    <div
      className="size-10 rounded-md grid grid-cols-2 grid-rows-2 overflow-hidden border border-[var(--color-border)] shrink-0"
      aria-hidden
    >
      <span style={{ backgroundColor: vars["--color-bg"] }} />
      <span style={{ backgroundColor: vars["--color-surface"] }} />
      <span style={{ backgroundColor: vars["--color-fg"] }} />
      <span style={{ backgroundColor: vars["--color-accent"] }} />
    </div>
  );
}
