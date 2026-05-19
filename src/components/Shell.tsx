"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { BarChart3, LogOut, Pencil, Settings as SettingsIcon } from "lucide-react";
import { DEFAULT_APP_TITLE, useSettings } from "@/lib/settings";
import { VersionBadge } from "@/components/VersionBadge";

export function Shell({
  sidebar,
  meta,
  toolbar,
  onOpenSettings,
  children,
}: {
  sidebar: React.ReactNode;
  meta?: React.ReactNode;
  toolbar?: React.ReactNode;
  onOpenSettings?: () => void;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const onDashboard = pathname?.startsWith("/dashboard") ?? false;
  const onEditor = pathname?.startsWith("/editor") ?? false;
  const router = useRouter();
  const { settings } = useSettings();
  const appTitle = settings.appTitle?.trim() || DEFAULT_APP_TITLE;

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/login");
    router.refresh();
  }

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      <header className="flex items-center gap-4 h-12 px-4 border-b border-[var(--color-border)] bg-[var(--color-bg)]">
        <div className="flex items-center gap-2.5 shrink-0">
          <div className="size-6 rounded-md bg-[var(--color-accent)] grid place-items-center">
            <span className="text-[10px] font-bold text-[var(--color-fg-on-accent)] tracking-tighter">
              {appTitle.slice(0, 2).toLowerCase()}
            </span>
          </div>
          <span className="text-[13px] font-medium tracking-tight">{appTitle}</span>
          <VersionBadge variant="pill" />
        </div>

        {/* Toolbar slot fills the center; flex-1 so it absorbs available width */}
        {toolbar && <div className="flex-1 min-w-0">{toolbar}</div>}

        <div className="flex items-center gap-2 shrink-0">
          {meta}
          <Link
            href="/editor"
            className={
              "h-7 px-2 rounded-md inline-flex items-center gap-1.5 text-[12px] font-medium transition " +
              (onEditor
                ? "text-[var(--color-accent)] bg-[var(--color-surface)]"
                : "text-[var(--color-fg-dim)] hover:text-[var(--color-fg)] hover:bg-[var(--color-surface)]")
            }
            aria-label="Open editor"
            title="Editor · adjust + add overlays"
          >
            <Pencil className="size-3.5" />
            Editor
          </Link>
          <Link
            href={onDashboard ? "/" : "/dashboard"}
            className={
              "size-7 rounded-md grid place-items-center transition " +
              (onDashboard
                ? "text-[var(--color-accent)] hover:bg-[var(--color-surface)]"
                : "text-[var(--color-muted)] hover:text-[var(--color-fg)] hover:bg-[var(--color-surface)]")
            }
            aria-label={onDashboard ? "Back to studio" : "Dashboard"}
            title={onDashboard ? "Back to studio" : "Dashboard · stats, models, docs"}
          >
            <BarChart3 className="size-3.5" />
          </Link>
          {onOpenSettings && (
            <button
              onClick={onOpenSettings}
              className="size-7 rounded-md text-[var(--color-muted)] hover:text-[var(--color-fg)] hover:bg-[var(--color-surface)] grid place-items-center transition"
              aria-label="Settings"
              title="Settings"
            >
              <SettingsIcon className="size-3.5" />
            </button>
          )}
          <button
            onClick={logout}
            className="size-7 rounded-md text-[var(--color-muted)] hover:text-[var(--color-fg)] hover:bg-[var(--color-surface)] grid place-items-center transition"
            aria-label="Log out"
            title="Log out"
          >
            <LogOut className="size-3.5" />
          </button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {sidebar && (
          <aside className="shrink-0 border-r border-[var(--color-border)] bg-[var(--color-bg)] flex flex-col min-h-0">
            {sidebar}
          </aside>
        )}
        <main className="flex-1 overflow-y-auto bg-[var(--color-bg)]">{children}</main>
      </div>
    </div>
  );
}
