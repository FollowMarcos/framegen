"use client";

import {
  ArrowDown,
  ArrowUp,
  Eye,
  EyeOff,
  Lock,
  Plus,
  Trash2,
  Type,
  Unlock,
} from "lucide-react";
import type { Overlay } from "@/lib/editor/types";
import { cn } from "@/lib/utils";
import { resolveFontFamily } from "@/lib/editor/fontModules";

// Visual layer list, top = front. Each row is a 48-px thumbnail strip
// matching the gallery / dock aesthetic — text overlays show a glyph on
// a swatch using the actual font + color, image overlays show the
// referenced thumbnail. Action buttons live on a single hover row to
// keep idle visual noise low.
export function LayerRail({
  overlays,
  selectedId,
  hasBase,
  baseSelected,
  baseThumbUrl,
  onSelect,
  onToggleHidden,
  onToggleLocked,
  onRemove,
  onMove,
}: {
  overlays: Overlay[];
  selectedId: string | null;
  hasBase: boolean;
  baseSelected: boolean;
  baseThumbUrl?: string;
  onSelect: (id: string | null) => void;
  onToggleHidden: (id: string, hidden: boolean) => void;
  onToggleLocked: (id: string, locked: boolean) => void;
  onRemove: (id: string) => void;
  // +1 moves the layer up in the visual stack (later in the doc array),
  // -1 down. The rail renders reversed so "up" matches what the user
  // sees.
  onMove: (id: string, direction: 1 | -1) => void;
}) {
  const rows = [...overlays].reverse();

  return (
    <div className="w-64 shrink-0 border-l border-[var(--color-border)] bg-[var(--color-bg-elevated)] overflow-y-auto flex flex-col">
      <div className="px-4 h-11 flex items-center justify-between border-b border-[var(--color-border)] sticky top-0 bg-[var(--color-bg-elevated)] z-10">
        <h2 className="text-[11px] font-semibold uppercase tracking-wider text-[var(--color-muted)]">
          Layers
        </h2>
        <span className="text-[10px] font-mono tabular-nums text-[var(--color-muted-dim)]">
          {overlays.length + (hasBase ? 1 : 0)}
        </span>
      </div>

      {overlays.length === 0 && !hasBase ? (
        <EmptyState />
      ) : (
        <ul className="p-2 space-y-1">
          {rows.map((o, visualIndex) => {
            const docIndex = overlays.length - 1 - visualIndex;
            const isSelected = selectedId === o.id;
            return (
              <LayerRow
                key={o.id}
                overlay={o}
                selected={isSelected}
                canMoveUp={docIndex < overlays.length - 1}
                canMoveDown={docIndex > 0}
                onSelect={() => onSelect(o.id)}
                onToggleHidden={() => onToggleHidden(o.id, !o.hidden)}
                onToggleLocked={() => onToggleLocked(o.id, !o.locked)}
                onMoveUp={() => onMove(o.id, 1)}
                onMoveDown={() => onMove(o.id, -1)}
                onRemove={() => onRemove(o.id)}
              />
            );
          })}

          {hasBase && (
            <li>
              <button
                type="button"
                onClick={() => onSelect(null)}
                className={cn(
                  "w-full flex items-center gap-2.5 p-1.5 rounded-md text-left transition-colors group/row relative mt-1",
                  baseSelected
                    ? "bg-[var(--color-accent-dim)] text-[var(--color-fg)]"
                    : "text-[var(--color-fg-dim)] hover:bg-[var(--color-surface)]"
                )}
              >
                {baseSelected && (
                  <span className="absolute left-0 top-1.5 bottom-1.5 w-0.5 rounded-full bg-[var(--color-accent)]" aria-hidden />
                )}
                <div className="size-10 rounded-md overflow-hidden border border-[var(--color-border)] bg-black shrink-0 grid place-items-center">
                  {baseThumbUrl ? (
                    <img
                      src={baseThumbUrl}
                      alt="base"
                      className="w-full h-full object-cover"
                    />
                  ) : null}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[12px] font-medium text-[var(--color-fg)] truncate">
                    Base
                  </div>
                  <div className="text-[10px] text-[var(--color-muted)]">
                    Image · pinned
                  </div>
                </div>
              </button>
            </li>
          )}
        </ul>
      )}
    </div>
  );
}

function LayerRow({
  overlay,
  selected,
  canMoveUp,
  canMoveDown,
  onSelect,
  onToggleHidden,
  onToggleLocked,
  onMoveUp,
  onMoveDown,
  onRemove,
}: {
  overlay: Overlay;
  selected: boolean;
  canMoveUp: boolean;
  canMoveDown: boolean;
  onSelect: () => void;
  onToggleHidden: () => void;
  onToggleLocked: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onRemove: () => void;
}) {
  const subtitle =
    overlay.kind === "text"
      ? `Text · ${Math.round(overlay.fontSize)}px`
      : `Image · ${Math.round(overlay.width)}×${Math.round(overlay.height)}`;
  const label =
    overlay.kind === "text"
      ? overlay.text.trim().slice(0, 32) || "untitled"
      : "image overlay";

  return (
    <li>
      <div
        role="button"
        tabIndex={0}
        onClick={onSelect}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onSelect();
          }
        }}
        aria-pressed={selected}
        className={cn(
          "group/row relative flex items-center gap-2.5 p-1.5 rounded-md cursor-pointer transition-colors",
          selected
            ? "bg-[var(--color-accent-dim)] text-[var(--color-fg)]"
            : "text-[var(--color-fg-dim)] hover:bg-[var(--color-surface)]",
          overlay.hidden && "opacity-50"
        )}
      >
        {selected && (
          <span
            className="absolute left-0 top-1.5 bottom-1.5 w-0.5 rounded-full bg-[var(--color-accent)]"
            aria-hidden
          />
        )}

        <LayerThumb overlay={overlay} />

        <div className="flex-1 min-w-0">
          <div className="text-[12px] font-medium text-[var(--color-fg)] truncate">
            {label}
          </div>
          <div className="text-[10px] text-[var(--color-muted)] truncate">
            {subtitle}
            {overlay.locked && " · locked"}
          </div>
        </div>

        {/* Quick actions: visibility + lock stay visible (state-bearing
            icons should be easy to scan); reorder + delete fade in on
            hover so idle rows stay quiet. */}
        <div className="flex items-center gap-0.5 shrink-0">
          <RowBtn
            title={overlay.hidden ? "show" : "hide"}
            onClick={(e) => {
              e.stopPropagation();
              onToggleHidden();
            }}
            persistent
          >
            {overlay.hidden ? (
              <EyeOff className="size-3.5" />
            ) : (
              <Eye className="size-3.5" />
            )}
          </RowBtn>
          <RowBtn
            title={overlay.locked ? "unlock" : "lock"}
            onClick={(e) => {
              e.stopPropagation();
              onToggleLocked();
            }}
            persistent={overlay.locked}
          >
            {overlay.locked ? (
              <Lock className="size-3.5" />
            ) : (
              <Unlock className="size-3.5" />
            )}
          </RowBtn>
          <RowBtn
            title="move up"
            onClick={(e) => {
              e.stopPropagation();
              onMoveUp();
            }}
            disabled={!canMoveUp}
          >
            <ArrowUp className="size-3.5" />
          </RowBtn>
          <RowBtn
            title="move down"
            onClick={(e) => {
              e.stopPropagation();
              onMoveDown();
            }}
            disabled={!canMoveDown}
          >
            <ArrowDown className="size-3.5" />
          </RowBtn>
          <RowBtn
            title="delete"
            onClick={(e) => {
              e.stopPropagation();
              onRemove();
            }}
            danger
          >
            <Trash2 className="size-3.5" />
          </RowBtn>
        </div>
      </div>
    </li>
  );
}

// Thumbnail strip showing the actual layer content at miniature size.
// For images we use the asset URL directly; for text we render the first
// few chars in the layer's own font + color on a swatch background so
// the user can spot the right layer without reading the label.
function LayerThumb({ overlay }: { overlay: Overlay }) {
  if (overlay.kind === "image") {
    return (
      <div className="size-10 rounded-md overflow-hidden border border-[var(--color-border)] bg-black shrink-0">
        <img
          src={overlay.assetUrl}
          alt=""
          className="w-full h-full object-cover"
        />
      </div>
    );
  }
  const preview = overlay.text.trim().slice(0, 1) || "T";
  return (
    <div
      className="size-10 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] shrink-0 grid place-items-center overflow-hidden"
      style={{ color: overlay.color }}
    >
      <Type
        className="size-3.5 absolute pointer-events-none opacity-0"
        aria-hidden
      />
      <span
        className="font-semibold leading-none select-none"
        style={{
          fontFamily: resolveFontFamily(overlay.fontFamily),
          fontStyle: overlay.italic ? "italic" : undefined,
          fontWeight: overlay.fontWeight,
          fontSize: 22,
        }}
      >
        {preview}
      </span>
    </div>
  );
}

function RowBtn({
  onClick,
  disabled,
  title,
  danger,
  persistent,
  children,
}: {
  onClick: (e: React.MouseEvent) => void;
  disabled?: boolean;
  title: string;
  danger?: boolean;
  persistent?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      aria-label={title}
      className={cn(
        "size-6 grid place-items-center rounded transition-colors",
        persistent ? "opacity-90" : "opacity-0 group-hover/row:opacity-100 focus:opacity-100",
        danger
          ? "text-[var(--color-muted)] hover:bg-[var(--color-danger)] hover:text-white"
          : "text-[var(--color-muted)] hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-fg)]",
        "disabled:opacity-20 disabled:cursor-not-allowed"
      )}
    >
      {children}
    </button>
  );
}

function EmptyState() {
  return (
    <div className="p-6 text-center">
      <div className="size-10 mx-auto rounded-full bg-[var(--color-surface)] border border-[var(--color-border)] grid place-items-center mb-3">
        <Plus className="size-4 text-[var(--color-muted)]" />
      </div>
      <p className="text-[11px] text-[var(--color-fg-dim)] font-medium">
        No layers yet
      </p>
      <p className="text-[10px] text-[var(--color-muted)] mt-1 leading-snug">
        Add text or an image overlay from the toolbar to start building.
      </p>
    </div>
  );
}
