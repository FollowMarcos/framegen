"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  ChevronDown,
  ChevronLeft,
  Download,
  FilePlus,
  FolderOpen,
  ImagePlus,
  Keyboard,
  Loader2,
  Redo2,
  Smile,
  Type,
  Undo2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { EmojiPicker } from "./EmojiPicker";

export function EditorToolbar({
  name,
  onNameChange,
  onAddText,
  onAddEmoji,
  onOpenAssetPicker,
  onExport,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
  saving,
}: {
  name: string;
  onNameChange: (v: string) => void;
  onAddText: () => void;
  // Adds an emoji as a large standalone "sticker" overlay. The picker
  // stays open after each click so the user can stack several stickers,
  // mirroring Instagram stories' UX.
  onAddEmoji: (emoji: string) => void;
  // The shell owns the picker modal state — toolbar just asks it to open.
  // This way the modal lives at shell level and can stack above the
  // canvas/transformer without z-index gymnastics inside the toolbar.
  onOpenAssetPicker: () => void;
  onExport: () => void | Promise<void>;
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  saving: boolean;
}) {
  const [busyExport, setBusyExport] = useState(false);
  const [emojiOpen, setEmojiOpen] = useState(false);

  return (
    <div className="flex items-center gap-2 h-12 px-3 border-b border-[var(--color-border)] bg-[var(--color-bg-elevated)] shrink-0">
      <Link
        href="/dashboard?section=edits"
        className="size-8 grid place-items-center rounded-md text-[var(--color-muted)] hover:text-[var(--color-fg)] hover:bg-[var(--color-surface)] transition"
        title="back to your edits"
        aria-label="back to edits"
      >
        <ChevronLeft className="size-4" />
      </Link>

      <DocMenu name={name} onNameChange={onNameChange} />

      <span
        className={cn(
          "text-[10px] tabular-nums transition-opacity",
          saving
            ? "text-[var(--color-muted)] opacity-100"
            : "text-[var(--color-muted-dim)] opacity-60"
        )}
        aria-live="polite"
      >
        {saving ? "saving…" : "saved"}
      </span>

      <div className="mx-2 h-5 w-px bg-[var(--color-border)]" aria-hidden />

      <ToolbarBtn
        onClick={onUndo}
        disabled={!canUndo}
        title="undo (⌘ Z)"
        ariaLabel="undo"
      >
        <Undo2 className="size-4" />
      </ToolbarBtn>
      <ToolbarBtn
        onClick={onRedo}
        disabled={!canRedo}
        title="redo (⌘ ⇧ Z)"
        ariaLabel="redo"
      >
        <Redo2 className="size-4" />
      </ToolbarBtn>

      <div className="mx-2 h-5 w-px bg-[var(--color-border)]" aria-hidden />

      <ToolbarBtn
        onClick={onAddText}
        title="add text"
        ariaLabel="add text overlay"
      >
        <Type className="size-4" />
      </ToolbarBtn>
      <div className="relative">
        <ToolbarBtn
          onClick={() => setEmojiOpen((v) => !v)}
          title="add emoji sticker"
          ariaLabel="add emoji sticker"
          active={emojiOpen}
        >
          <Smile className="size-4" />
        </ToolbarBtn>
        {emojiOpen && (
          <EmojiPicker
            anchor="bottom"
            onPick={(e) => onAddEmoji(e)}
            onClose={() => setEmojiOpen(false)}
          />
        )}
      </div>
      <ToolbarBtn
        onClick={onOpenAssetPicker}
        title="add image · pick from generations / uploads / device"
        ariaLabel="add image overlay"
      >
        <ImagePlus className="size-4" />
      </ToolbarBtn>

      <div className="ml-auto" />

      <ShortcutsButton />

      <button
        type="button"
        onClick={async () => {
          setBusyExport(true);
          try {
            await onExport();
          } finally {
            setBusyExport(false);
          }
        }}
        disabled={busyExport}
        className={cn(
          "h-8 px-3 rounded-md text-[12px] font-semibold inline-flex items-center gap-1.5 transition",
          "bg-[var(--color-accent)] text-[var(--color-fg-on-accent)]",
          "hover:bg-[var(--color-accent-hover)]",
          "disabled:opacity-40 disabled:cursor-not-allowed"
        )}
      >
        {busyExport ? (
          <Loader2 className="size-3.5 animate-spin" />
        ) : (
          <Download className="size-3.5" />
        )}
        Export PNG
      </button>
    </div>
  );
}

// Cmd vs Ctrl depending on platform — Konva's wheel handler honors both,
// but the user only sees one in the shortcut sheet.
function getMod(): "⌘" | "Ctrl" {
  if (typeof navigator === "undefined") return "⌘";
  return /Mac|iPod|iPhone|iPad/.test(navigator.platform) ? "⌘" : "Ctrl";
}

// Help popover listing every editor shortcut. Opens on click, closes on
// outside-click or Escape. Also responds to "?" (Shift+/) as the global
// open shortcut, mirroring how most apps surface their cheat sheet.
function ShortcutsButton() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);
  const mod = getMod();

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setOpen(false);
        return;
      }
      // "?" — only when no input is focused, so typing a literal ? into
      // the text panel doesn't pop the help sheet.
      if (e.key === "?" && !e.ctrlKey && !e.metaKey) {
        const active = document.activeElement;
        const inField =
          active instanceof HTMLInputElement ||
          active instanceof HTMLTextAreaElement ||
          (active instanceof HTMLElement && active.isContentEditable);
        if (!inField) {
          e.preventDefault();
          setOpen((v) => !v);
        }
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (!open) return;
    function onDocDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onDocDown);
    return () => document.removeEventListener("mousedown", onDocDown);
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        title="Keyboard shortcuts (?)"
        aria-label="keyboard shortcuts"
        aria-expanded={open}
        className={cn(
          "size-8 grid place-items-center rounded-md transition",
          open
            ? "text-[var(--color-fg)] bg-[var(--color-surface)]"
            : "text-[var(--color-fg-dim)] hover:text-[var(--color-fg)] hover:bg-[var(--color-surface)]"
        )}
      >
        <Keyboard className="size-4" />
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="keyboard shortcuts"
          className="absolute right-0 top-full mt-2 w-[300px] rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-elevated)] shadow-xl p-3 z-30"
        >
          <h3 className="text-[11px] font-semibold uppercase tracking-wider text-[var(--color-muted)] mb-2 px-1">
            Shortcuts
          </h3>
          <Group title="History">
            <Row label="Undo" keys={[mod, "Z"]} />
            <Row label="Redo" keys={[mod, "⇧", "Z"]} />
          </Group>
          <Group title="Canvas">
            <Row label="Zoom in" keys={[mod, "+"]} />
            <Row label="Zoom out" keys={[mod, "−"]} />
            <Row label="Fit to screen" keys={[mod, "0"]} />
            <Row label="100%" keys={[mod, "1"]} />
            <Row label="Zoom at cursor" keys={[mod, "scroll"]} />
            <Row label="Pan" keys={["scroll"]} />
            <Row label="Pan (drag)" keys={["Space", "+", "drag"]} />
          </Group>
          <Group title="Layers">
            <Row label="Delete selected" keys={["Del"]} />
            <Row label="Add text" keys={["Click", "T", "in toolbar"]} hint />
            <Row label="Add image" keys={["Click", "🖼", "in toolbar"]} hint />
          </Group>
          <Group title="Help">
            <Row label="Toggle this sheet" keys={["?"]} />
          </Group>
        </div>
      )}
    </div>
  );
}

function Group({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mb-2 last:mb-0">
      <div className="text-[9px] font-semibold uppercase tracking-wider text-[var(--color-muted-dim)] px-1 mb-0.5">
        {title}
      </div>
      <div className="space-y-0.5">{children}</div>
    </div>
  );
}

function Row({
  label,
  keys,
  hint,
}: {
  label: string;
  keys: string[];
  // `hint` rows describe a manual action (no real shortcut) — keys are
  // rendered as inline text rather than kbd chips so they don't read as
  // "press this".
  hint?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-3 px-1 py-1 rounded hover:bg-[var(--color-surface)]/60">
      <span className="text-[11.5px] text-[var(--color-fg-dim)]">{label}</span>
      <span className="flex items-center gap-1 shrink-0">
        {hint ? (
          <span className="text-[10px] text-[var(--color-muted)] italic">
            {keys.join(" ")}
          </span>
        ) : (
          keys.map((k, i) => (
            <kbd
              key={i}
              className="px-1.5 min-w-[20px] h-5 rounded border border-[var(--color-border)] bg-[var(--color-surface)] text-[10px] font-mono text-[var(--color-fg-dim)] inline-flex items-center justify-center tabular-nums"
            >
              {k}
            </kbd>
          ))
        )}
      </span>
    </div>
  );
}

// Doc-name field + the dropdown that hangs off it. The chevron exposes
// document-level navigation (New canvas, My documents) without burying
// it behind the back-arrow; the input itself stays editable for inline
// rename so users don't lose the existing affordance. Current doc is
// always autosaved when switching, so neither destination loses work.
function DocMenu({
  name,
  onNameChange,
}: {
  name: string;
  onNameChange: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    function onDocDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDocDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <div className="flex items-center">
        <input
          value={name}
          onChange={(e) => onNameChange(e.target.value)}
          className="h-8 pl-2 pr-1 bg-transparent border border-transparent hover:border-[var(--color-border)] focus:border-[var(--color-border-strong)] rounded-l-md text-[13px] font-medium text-[var(--color-fg)] outline-none w-44 transition-colors"
          placeholder="untitled"
          aria-label="document name"
          name="editor-doc-name"
          autoComplete="off"
          data-1p-ignore=""
          data-lpignore="true"
        />
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-haspopup="menu"
          aria-expanded={open}
          aria-label="document menu"
          title="document menu"
          className={cn(
            "h-8 w-7 grid place-items-center rounded-r-md border border-transparent transition-colors",
            open
              ? "text-[var(--color-fg)] bg-[var(--color-surface)] border-[var(--color-border-strong)]"
              : "text-[var(--color-muted)] hover:text-[var(--color-fg)] hover:bg-[var(--color-surface)] hover:border-[var(--color-border)]"
          )}
        >
          <ChevronDown className="size-3.5" />
        </button>
      </div>

      {open && (
        <div
          role="menu"
          className="absolute left-0 top-full mt-1 w-52 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-elevated)] shadow-xl z-30 p-1"
        >
          <MenuItem
            href="/editor"
            icon={<FilePlus className="size-3.5" />}
            label="New canvas"
            sublabel="Current doc autosaves"
            onClick={() => setOpen(false)}
          />
          <MenuItem
            href="/dashboard?section=edits"
            icon={<FolderOpen className="size-3.5" />}
            label="My documents"
            sublabel="Browse + open saved edits"
            onClick={() => setOpen(false)}
          />
        </div>
      )}
    </div>
  );
}

function MenuItem({
  href,
  icon,
  label,
  sublabel,
  onClick,
}: {
  href: string;
  icon: React.ReactNode;
  label: string;
  sublabel: string;
  onClick: () => void;
}) {
  return (
    <Link
      href={href}
      onClick={onClick}
      role="menuitem"
      className="flex items-center gap-2.5 px-2 py-1.5 rounded-md text-left transition-colors hover:bg-[var(--color-surface)]"
    >
      <span className="text-[var(--color-muted)] shrink-0">{icon}</span>
      <span className="flex-1 min-w-0">
        <span className="block text-[12px] font-medium text-[var(--color-fg)]">
          {label}
        </span>
        <span className="block text-[10px] text-[var(--color-muted)]">
          {sublabel}
        </span>
      </span>
    </Link>
  );
}

function ToolbarBtn({
  onClick,
  disabled,
  title,
  ariaLabel,
  active,
  children,
}: {
  onClick: () => void;
  disabled?: boolean;
  title: string;
  ariaLabel: string;
  active?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      aria-label={ariaLabel}
      aria-pressed={active}
      className={cn(
        "size-8 grid place-items-center rounded-md transition disabled:opacity-30 disabled:cursor-not-allowed",
        active
          ? "text-[var(--color-fg)] bg-[var(--color-surface)]"
          : "text-[var(--color-fg-dim)] hover:text-[var(--color-fg)] hover:bg-[var(--color-surface)]"
      )}
    >
      {children}
    </button>
  );
}
