"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  BarChart3,
  BookOpen,
  ChevronLeft,
  ChevronRight,
  Coffee,
  ImageIcon,
  Layers,
  Pencil,
  Search,
  Trash2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { VersionBadge } from "@/components/VersionBadge";

export type DashboardSection =
  | "overview"
  | "models"
  | "uploads"
  | "edits"
  | "trash"
  | "docs";

const SECTIONS: { id: DashboardSection; label: string; icon: React.ReactNode }[] = [
  { id: "overview", label: "Overview", icon: <BarChart3 className="size-3.5" /> },
  { id: "models", label: "Models", icon: <Layers className="size-3.5" /> },
  { id: "uploads", label: "Uploads", icon: <ImageIcon className="size-3.5" /> },
  { id: "edits", label: "Edits", icon: <Pencil className="size-3.5" /> },
  { id: "trash", label: "Trash", icon: <Trash2 className="size-3.5" /> },
  { id: "docs", label: "Documentation", icon: <BookOpen className="size-3.5" /> },
];

const COLLAPSE_KEY = "frame.dashboardNavCollapsed.v1";

export function DashboardNav({
  active,
  onChange,
}: {
  active: DashboardSection;
  onChange: (id: DashboardSection) => void;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const [search, setSearch] = useState("");

  // Persist the collapsed state so it survives navigation.
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      setCollapsed(localStorage.getItem(COLLAPSE_KEY) === "1");
    } catch {
      // ignore
    }
  }, []);

  function toggle() {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(COLLAPSE_KEY, next ? "1" : "0");
      } catch {
        // ignore
      }
      return next;
    });
  }

  // Section filtering — keeps the keyboard ⌘K shortcut visually honest by
  // doing real work even though we don't have a full command palette.
  const filteredSections = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return SECTIONS;
    return SECTIONS.filter((s) => s.label.toLowerCase().includes(q));
  }, [search]);

  return (
    <nav
      className={cn(
        "flex flex-col h-full p-3 gap-2 transition-[width] duration-200",
        collapsed ? "w-[56px]" : "w-[240px]"
      )}
    >
      <div
        className={cn(
          "flex items-center mb-1",
          collapsed ? "justify-center" : "justify-between"
        )}
      >
        {!collapsed && (
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 h-8 px-2 rounded-md text-[11px] text-[var(--color-muted)] hover:text-[var(--color-fg)] hover:bg-[var(--color-surface)] transition"
            title="back to studio"
          >
            <ArrowLeft className="size-3" />
            back to studio
          </Link>
        )}
        {collapsed && (
          <Link
            href="/"
            className="size-7 grid place-items-center rounded-md text-[var(--color-muted)] hover:text-[var(--color-fg)] hover:bg-[var(--color-surface)] transition"
            title="back to studio"
            aria-label="back to studio"
          >
            <ArrowLeft className="size-3.5" />
          </Link>
        )}
        <button
          type="button"
          onClick={toggle}
          className="size-7 grid place-items-center rounded-md text-[var(--color-muted)] hover:text-[var(--color-fg)] hover:bg-[var(--color-surface)] transition"
          aria-label={collapsed ? "expand sidebar" : "collapse sidebar"}
          title={collapsed ? "expand sidebar" : "collapse sidebar"}
        >
          {collapsed ? <ChevronRight className="size-3.5" /> : <ChevronLeft className="size-3.5" />}
        </button>
      </div>

      {/* Search input — mirrors the Orbit dashboard's command-bar affordance.
          Currently filters the section list locally; a full ⌘K palette
          could replace this later without changing the visual contract. */}
      {!collapsed && (
        <div className="relative mb-2">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-[var(--color-muted)] pointer-events-none" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search"
            spellCheck={false}
            // Chrome heuristics treat search-shaped inputs as fair game
            // for "email I've used here before" autofill — opt out with
            // both the standard attribute and a neutral, non-email name.
            name="dashboard-section-search"
            autoComplete="off"
            data-1p-ignore=""
            data-lpignore="true"
            className="w-full h-9 pl-8 pr-12 rounded-lg bg-[var(--color-surface)] border border-[var(--color-border)] text-[12px] text-[var(--color-fg)] placeholder:text-[var(--color-muted-dim)] outline-none hover:border-[var(--color-border-strong)] focus:border-[var(--color-accent)] transition-colors"
          />
          <span
            className="absolute right-2 top-1/2 -translate-y-1/2 inline-flex items-center gap-0.5 text-[10px] font-mono text-[var(--color-muted)] tabular-nums"
            aria-hidden
          >
            <kbd className="px-1 py-0.5 rounded bg-[var(--color-bg-elevated)] border border-[var(--color-border)]">⌘</kbd>
            <kbd className="px-1 py-0.5 rounded bg-[var(--color-bg-elevated)] border border-[var(--color-border)]">K</kbd>
          </span>
        </div>
      )}

      {!collapsed && (
        <div className="text-[10px] font-mono uppercase tracking-[0.08em] text-[var(--color-muted)] px-2.5 mb-1 mt-1">
          Navigation
        </div>
      )}

      <div className="flex flex-col gap-0.5">
        {filteredSections.map((s) => {
          const isActive = active === s.id;
          return (
            <button
              key={s.id}
              type="button"
              onClick={() => onChange(s.id)}
              className={cn(
                "h-9 rounded-lg text-[12px] transition-colors inline-flex items-center font-medium",
                collapsed ? "justify-center px-0" : "gap-2.5 px-2.5",
                isActive
                  ? "bg-[var(--color-surface)] border border-[var(--color-border-strong)] text-[var(--color-fg)] shadow-sm"
                  : "border border-transparent text-[var(--color-muted)] hover:text-[var(--color-fg)] hover:bg-[var(--color-surface)]"
              )}
              title={collapsed ? s.label : undefined}
              aria-label={collapsed ? s.label : undefined}
            >
              {s.icon}
              {!collapsed && s.label}
            </button>
          );
        })}
        {!collapsed && filteredSections.length === 0 && (
          <div className="px-2.5 py-3 text-[11px] text-[var(--color-muted-dim)]">
            No matches for &ldquo;{search}&rdquo;
          </div>
        )}
      </div>

      {/* Build identifier + donation link — pushed to the bottom so they
          stay out of the way but easy to grab. Hidden in collapsed mode
          (no room) except the ko-fi icon, which stays as a single-button
          affordance. */}
      <div className="mt-auto pt-2 border-t border-[var(--color-border)] space-y-2">
        {!collapsed && <VersionBadge variant="stacked" />}
        <a
          href="https://ko-fi.com/meltenx"
          target="_blank"
          rel="noopener noreferrer"
          className={cn(
            "h-8 rounded-md inline-flex items-center font-medium text-[11px] transition-colors",
            "text-[var(--color-muted)] hover:text-[var(--color-fg)] hover:bg-[var(--color-surface)]",
            collapsed ? "size-8 justify-center" : "gap-2 px-2.5 w-full"
          )}
          title="support development on Ko-fi"
          aria-label="support development on Ko-fi"
        >
          <Coffee className="size-3.5" />
          {!collapsed && <span>Support on Ko-fi</span>}
        </a>
      </div>
    </nav>
  );
}
