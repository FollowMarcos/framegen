"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown, Folder, FolderPlus, Pencil, Search, Trash2, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Project } from "@/lib/projects";

// The "active project" selector is a tri-state: a real Project, or one of
// these two pseudo-projects represented as strings.
export const PROJECT_ALL = "__all__" as const;
export const PROJECT_UNSORTED = "__unsorted__" as const;
export type ActiveProject = string; // a real project id, PROJECT_ALL, or PROJECT_UNSORTED

// --- Top-bar controls (project switcher + search) ---------------------------

export function LibraryHeaderControls({
  projects,
  activeProject,
  onChangeProject,
  onCreateProject,
  onRenameProject,
  onDeleteProject,
  search,
  onSearchChange,
}: {
  projects: Project[];
  activeProject: ActiveProject;
  onChangeProject: (id: ActiveProject) => void;
  onCreateProject: (name: string) => Promise<void>;
  onRenameProject: (id: string, name: string) => Promise<void>;
  onDeleteProject: (id: string) => Promise<void>;
  search: string;
  onSearchChange: (v: string) => void;
}) {
  return (
    <div className="flex items-center gap-2 min-w-0">
      <ProjectSwitcher
        projects={projects}
        activeProject={activeProject}
        onChange={onChangeProject}
        onCreate={onCreateProject}
        onRename={onRenameProject}
        onDelete={onDeleteProject}
      />

      <div className="relative flex-1 min-w-[160px] max-w-[420px]">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-[var(--color-muted)] pointer-events-none" />
        <input
          type="search"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="search prompts…"
          className="w-full h-8 pl-8 pr-3 rounded-md bg-[var(--color-surface)] border border-[var(--color-border)] text-[12px] outline-none hover:border-[var(--color-border-strong)] focus:border-[var(--color-accent)] transition-colors"
        />
      </div>
    </div>
  );
}

// --- Tag chips (remain below the page heading) ------------------------------

export function ActiveTagFilters({
  tagFilters,
  onRemoveTag,
  onClearTags,
}: {
  tagFilters: string[];
  onRemoveTag: (tag: string) => void;
  onClearTags: () => void;
}) {
  if (tagFilters.length === 0) return null;
  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      <span className="text-[10px] uppercase tracking-[0.08em] font-semibold text-[var(--color-muted)]">
        tags
      </span>
      {tagFilters.map((tag) => (
        <button
          key={tag}
          type="button"
          onClick={() => onRemoveTag(tag)}
          className="inline-flex items-center gap-1 px-2 h-6 rounded-full bg-[var(--color-accent)]/15 text-[var(--color-accent)] text-[11px] font-medium hover:bg-[var(--color-accent)]/25 transition"
          title="remove filter"
        >
          #{tag}
          <X className="size-2.5" />
        </button>
      ))}
      <button
        type="button"
        onClick={onClearTags}
        className="text-[10px] text-[var(--color-muted)] hover:text-[var(--color-fg)] ml-1"
      >
        clear
      </button>
    </div>
  );
}

function ProjectSwitcher({
  projects,
  activeProject,
  onChange,
  onCreate,
  onRename,
  onDelete,
}: {
  projects: Project[];
  activeProject: ActiveProject;
  onChange: (id: ActiveProject) => void;
  onCreate: (name: string) => Promise<void>;
  onRename: (id: string, name: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setCreating(false);
        setRenamingId(null);
      }
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  const current = (() => {
    if (activeProject === PROJECT_ALL) return { name: "All projects", muted: false };
    if (activeProject === PROJECT_UNSORTED) return { name: "Unsorted", muted: true };
    const p = projects.find((x) => x.id === activeProject);
    return p ? { name: p.name, muted: false } : { name: "All projects", muted: false };
  })();

  async function commitCreate() {
    if (!newName.trim()) return;
    await onCreate(newName.trim());
    setNewName("");
    setCreating(false);
  }

  async function commitRename(id: string) {
    if (!renameValue.trim()) return;
    await onRename(id, renameValue.trim());
    setRenamingId(null);
    setRenameValue("");
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-1.5 h-8 px-2.5 rounded-md bg-[var(--color-surface)] border border-[var(--color-border)] hover:border-[var(--color-border-strong)] text-[12px] font-medium transition"
      >
        <Folder className="size-3.5 text-[var(--color-muted)]" />
        <span className={cn(current.muted && "text-[var(--color-muted)]")}>
          {current.name}
        </span>
        <ChevronDown className="size-3 text-[var(--color-muted)]" />
      </button>

      {open && (
        <div className="absolute left-0 top-full mt-1 z-30 min-w-[240px] rounded-md border border-[var(--color-border)] bg-[var(--color-bg-elevated)] shadow-lg overflow-hidden">
          <ul className="py-1 max-h-72 overflow-y-auto">
            <ProjectRow
              label="All projects"
              selected={activeProject === PROJECT_ALL}
              onClick={() => {
                onChange(PROJECT_ALL);
                setOpen(false);
              }}
            />
            <ProjectRow
              label="Unsorted"
              muted
              selected={activeProject === PROJECT_UNSORTED}
              onClick={() => {
                onChange(PROJECT_UNSORTED);
                setOpen(false);
              }}
            />
            {projects.length > 0 && (
              <li className="border-t border-[var(--color-border)] my-1" aria-hidden />
            )}
            {projects.map((p) => (
              <li key={p.id}>
                {renamingId === p.id ? (
                  <div className="flex items-center gap-1 px-2 py-1">
                    <input
                      autoFocus
                      value={renameValue}
                      onChange={(e) => setRenameValue(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") commitRename(p.id);
                        if (e.key === "Escape") {
                          setRenamingId(null);
                          setRenameValue("");
                        }
                      }}
                      className="flex-1 h-7 px-2 rounded bg-[var(--color-surface)] border border-[var(--color-border)] text-[12px] outline-none focus:border-[var(--color-accent)]"
                    />
                    <button
                      onClick={() => commitRename(p.id)}
                      className="text-[10px] text-[var(--color-muted)] hover:text-[var(--color-fg)] px-1"
                    >
                      save
                    </button>
                  </div>
                ) : (
                  <div className="group flex items-center">
                    <button
                      type="button"
                      onClick={() => {
                        onChange(p.id);
                        setOpen(false);
                      }}
                      className={cn(
                        "flex-1 text-left px-3 py-1.5 text-[12px] transition-colors",
                        activeProject === p.id
                          ? "bg-[var(--color-accent-dim)] text-[var(--color-fg)]"
                          : "text-[var(--color-fg-dim)] hover:bg-[var(--color-surface)]"
                      )}
                    >
                      {p.name}
                    </button>
                    <div className="opacity-0 group-hover:opacity-100 transition flex pr-1">
                      <button
                        type="button"
                        onClick={() => {
                          setRenamingId(p.id);
                          setRenameValue(p.name);
                        }}
                        className="size-6 grid place-items-center rounded text-[var(--color-muted)] hover:text-[var(--color-fg)] hover:bg-[var(--color-surface)]"
                        aria-label="rename"
                        title="rename"
                      >
                        <Pencil className="size-3" />
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if (confirm(`Delete project "${p.name}"? Images stay; they become unsorted.`)) {
                            onDelete(p.id);
                          }
                        }}
                        className="size-6 grid place-items-center rounded text-[var(--color-muted)] hover:text-[var(--color-danger)] hover:bg-[var(--color-surface)]"
                        aria-label="delete"
                        title="delete"
                      >
                        <Trash2 className="size-3" />
                      </button>
                    </div>
                  </div>
                )}
              </li>
            ))}

            <li className="border-t border-[var(--color-border)] mt-1 pt-1">
              {creating ? (
                <div className="flex items-center gap-1 px-2 py-1">
                  <input
                    autoFocus
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") commitCreate();
                      if (e.key === "Escape") {
                        setCreating(false);
                        setNewName("");
                      }
                    }}
                    placeholder="project name"
                    className="flex-1 h-7 px-2 rounded bg-[var(--color-surface)] border border-[var(--color-border)] text-[12px] outline-none focus:border-[var(--color-accent)]"
                  />
                  <button
                    onClick={commitCreate}
                    className="text-[10px] text-[var(--color-muted)] hover:text-[var(--color-fg)] px-1"
                  >
                    create
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setCreating(true)}
                  className="w-full text-left px-3 py-1.5 text-[12px] text-[var(--color-muted)] hover:text-[var(--color-fg)] hover:bg-[var(--color-surface)] inline-flex items-center gap-1.5"
                >
                  <FolderPlus className="size-3.5" />
                  new project…
                </button>
              )}
            </li>
          </ul>
        </div>
      )}
    </div>
  );
}

function ProjectRow({
  label,
  selected,
  muted,
  onClick,
}: {
  label: string;
  selected: boolean;
  muted?: boolean;
  onClick: () => void;
}) {
  return (
    <li>
      <button
        type="button"
        onClick={onClick}
        className={cn(
          "w-full text-left px-3 py-1.5 text-[12px] transition-colors",
          selected
            ? "bg-[var(--color-accent-dim)] text-[var(--color-fg)]"
            : muted
              ? "text-[var(--color-muted)] hover:bg-[var(--color-surface)] hover:text-[var(--color-fg-dim)]"
              : "text-[var(--color-fg-dim)] hover:bg-[var(--color-surface)]"
        )}
      >
        {label}
      </button>
    </li>
  );
}
