"use client";

import { useEffect, useState } from "react";
import { Save, Trash2, X } from "lucide-react";
import { Button, TextArea, TextInput } from "@/components/fields";
import {
  type Snippet,
  deleteSnippet,
  listSnippets,
  saveSnippet,
} from "@/lib/snippets";

export function SnippetsModal({
  initialBody,
  onClose,
  onChange,
}: {
  initialBody?: string;
  onClose: () => void;
  onChange?: () => void;
}) {
  const [snippets, setSnippets] = useState<Snippet[]>([]);
  const [name, setName] = useState("");
  const [body, setBody] = useState(initialBody ?? "");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setSnippets(listSnippets());
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

  function commitSave() {
    if (!name.trim() || !body.trim()) {
      setError("name and body required");
      return;
    }
    try {
      saveSnippet(name, body);
      setName("");
      setBody("");
      setError(null);
      setSnippets(listSnippets());
      onChange?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : "failed");
    }
  }

  function remove(id: string) {
    deleteSnippet(id);
    setSnippets(listSnippets());
    onChange?.();
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={onClose}
      className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-6 animate-in"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-[520px] rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-elevated)] overflow-hidden flex flex-col max-h-[calc(100vh-3rem)]"
      >
        <header className="flex items-center justify-between h-11 px-4 border-b border-[var(--color-border)] shrink-0">
          <div className="flex items-baseline gap-2">
            <h2 className="text-[13px] font-semibold tracking-tight">snippets</h2>
            <span className="text-[11px] text-[var(--color-muted)]">
              reusable prompt fragments
            </span>
          </div>
          <button
            onClick={onClose}
            className="size-6 rounded-md grid place-items-center text-[var(--color-muted)] hover:text-[var(--color-fg)] hover:bg-[var(--color-surface)] transition"
            aria-label="close"
          >
            <X className="size-3.5" />
          </button>
        </header>

        <div className="p-4 space-y-4 border-b border-[var(--color-border)] shrink-0">
          <div className="text-[10px] uppercase tracking-[0.08em] font-semibold text-[var(--color-muted)]">
            save new
          </div>
          <div className="space-y-2">
            <TextInput
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="name (e.g. cinematic-portrait)"
            />
            <TextArea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="body — the prompt text you want to reuse"
              className="min-h-[80px]"
            />
            {error && <p className="text-[11px] text-[var(--color-danger)]">{error}</p>}
            <div className="flex justify-end">
              <Button
                size="sm"
                onClick={commitSave}
                disabled={!name.trim() || !body.trim()}
              >
                <Save className="size-3.5" />
                save snippet
              </Button>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-2 min-h-0">
          <div className="text-[10px] uppercase tracking-[0.08em] font-semibold text-[var(--color-muted)]">
            saved · {snippets.length}
          </div>
          {snippets.length === 0 ? (
            <p className="text-[11px] text-[var(--color-muted)] py-3 text-center">
              no snippets yet — save one above
            </p>
          ) : (
            <ul className="space-y-1.5">
              {snippets.map((s) => (
                <li
                  key={s.id}
                  className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] p-2.5 flex items-start gap-2"
                >
                  <div className="min-w-0 flex-1">
                    <div className="font-mono text-[11px] text-[var(--color-fg)]">
                      /{s.name}
                    </div>
                    <p className="text-[11px] text-[var(--color-muted)] mt-0.5 break-words whitespace-pre-wrap">
                      {s.body}
                    </p>
                  </div>
                  <button
                    onClick={() => remove(s.id)}
                    className="size-6 rounded text-[var(--color-muted)] hover:text-[var(--color-danger)] hover:bg-[var(--color-surface)] grid place-items-center transition shrink-0"
                    aria-label="delete"
                    title="delete"
                  >
                    <Trash2 className="size-3" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="border-t border-[var(--color-border)] p-3 flex justify-end shrink-0">
          <Button variant="secondary" size="sm" onClick={onClose}>
            done
          </Button>
        </div>

      </div>
    </div>
  );
}
