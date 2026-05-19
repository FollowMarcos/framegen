"use client";

import { useState } from "react";
import {
  ArrowDownAZ,
  Check,
  ChevronDown,
  Heart,
  LayoutGrid,
  Rows3,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  GRID_COLS_MAX,
  GRID_COLS_MIN,
  LIBRARY_SORTS,
  type LibrarySort,
} from "@/lib/settings";

// Inline toolbar for the library:
//   - Sort selector (dropdown)
//   - Favorites-only toggle (heart pill, active when on)
//   - Grid density slider (column count)
//
// Designed to slot between the page header and the asset grid. Each
// control persists to settings via the callbacks; the parent owns the
// state and reflects it back in.

export function LibraryViewControls({
  sort,
  onSortChange,
  favoritesOnly,
  onFavoritesToggle,
  gridCols,
  onGridColsChange,
}: {
  sort: LibrarySort;
  onSortChange: (next: LibrarySort) => void;
  favoritesOnly: boolean;
  onFavoritesToggle: () => void;
  gridCols: number;
  onGridColsChange: (next: number) => void;
}) {
  const [sortOpen, setSortOpen] = useState(false);
  const activeSort =
    LIBRARY_SORTS.find((s) => s.id === sort) ?? LIBRARY_SORTS[0];

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {/* Sort dropdown */}
      <div className="relative">
        <button
          type="button"
          onClick={() => setSortOpen((v) => !v)}
          aria-haspopup="listbox"
          aria-expanded={sortOpen}
          className="inline-flex items-center gap-1.5 h-8 px-2.5 rounded-md bg-[var(--color-surface)] border border-[var(--color-border)] hover:border-[var(--color-border-strong)] text-[12px] font-medium text-[var(--color-fg-dim)] transition"
        >
          <ArrowDownAZ className="size-3 text-[var(--color-muted)]" />
          {activeSort.label}
          <ChevronDown
            className={cn(
              "size-3 text-[var(--color-muted)] transition-transform",
              sortOpen && "rotate-180"
            )}
          />
        </button>
        {sortOpen && (
          <>
            <div
              className="fixed inset-0 z-10"
              onClick={() => setSortOpen(false)}
              aria-hidden
            />
            <ul
              role="listbox"
              className="absolute left-0 top-full mt-1 z-20 min-w-[180px] rounded-md border border-[var(--color-border)] shadow-lg overflow-hidden py-1"
              style={{ backgroundColor: "var(--color-bg-elevated)" }}
            >
              {LIBRARY_SORTS.map((s) => {
                const selected = s.id === sort;
                return (
                  <li key={s.id}>
                    <button
                      type="button"
                      role="option"
                      aria-selected={selected}
                      onClick={() => {
                        onSortChange(s.id);
                        setSortOpen(false);
                      }}
                      className={cn(
                        "w-full px-3 py-1.5 text-left text-[12px] transition-colors flex items-center justify-between gap-3",
                        selected
                          ? "bg-[var(--color-accent-dim)] text-[var(--color-fg)]"
                          : "text-[var(--color-fg-dim)] hover:bg-[var(--color-surface)]"
                      )}
                    >
                      <span>{s.label}</span>
                      {selected && (
                        <Check className="size-3 text-[var(--color-accent)]" />
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </div>

      {/* Favorites filter */}
      <button
        type="button"
        onClick={onFavoritesToggle}
        aria-pressed={favoritesOnly}
        className={cn(
          "inline-flex items-center gap-1.5 h-8 px-2.5 rounded-md border text-[12px] font-medium transition-colors",
          favoritesOnly
            ? "bg-[var(--color-accent-dim)] border-[var(--color-accent)] text-[var(--color-fg)]"
            : "bg-[var(--color-surface)] border-[var(--color-border)] text-[var(--color-fg-dim)] hover:border-[var(--color-border-strong)]"
        )}
        title={favoritesOnly ? "showing favorites only" : "show favorites only"}
      >
        <Heart
          className={cn(
            "size-3",
            favoritesOnly ? "text-[var(--color-accent)]" : "text-[var(--color-muted)]"
          )}
          fill={favoritesOnly ? "currentColor" : "none"}
          strokeWidth={2}
        />
        Favorites
      </button>

      <div className="flex-1" />

      {/* Grid density slider — column-count picker. Plays better than a
          continuous CSS scale because the resulting layout always remains
          on the same column grid, no half-cards. */}
      <div className="inline-flex items-center gap-2 h-8 px-2.5 rounded-md bg-[var(--color-surface)] border border-[var(--color-border)]">
        <Rows3
          className="size-3 text-[var(--color-muted)] cursor-pointer hover:text-[var(--color-fg-dim)]"
          onClick={() =>
            onGridColsChange(Math.min(GRID_COLS_MAX, gridCols + 1))
          }
          aria-hidden
        />
        <input
          type="range"
          min={GRID_COLS_MIN}
          max={GRID_COLS_MAX}
          // Slider direction is inverted vs the underlying column count so
          // dragging *right* makes cards *bigger* (fewer columns), matching
          // the icon order — rows on the left (small/dense), grid on the
          // right (large/sparse).
          value={GRID_COLS_MAX + GRID_COLS_MIN - gridCols}
          onChange={(e) =>
            onGridColsChange(
              GRID_COLS_MAX + GRID_COLS_MIN - Number(e.target.value)
            )
          }
          step={1}
          aria-label="grid density"
          title={`${gridCols} columns`}
          className="w-24 accent-[var(--color-accent)]"
        />
        <LayoutGrid
          className="size-3 text-[var(--color-muted)] cursor-pointer hover:text-[var(--color-fg-dim)]"
          onClick={() =>
            onGridColsChange(Math.max(GRID_COLS_MIN, gridCols - 1))
          }
          aria-hidden
        />
      </div>
    </div>
  );
}
