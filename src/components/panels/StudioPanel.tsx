"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  BookmarkPlus,
  Check,
  FileImage,
  FolderOpen,
  Gauge,
  ImagePlus,
  Loader2,
  Maximize2,
  Minimize2,
  MousePointerClick,
  Paintbrush,
  Ratio,
  RectangleHorizontal,
  RectangleVertical,
  Sparkles,
  Square,
  X as XIcon,
} from "lucide-react";
import {
  Section,
  Field,
  TextArea,
  Select,
  Stepper,
  Button,
  Kbd,
  QUALITIES,
  OUTPUT_FORMATS,
} from "@/components/fields";
import { CostEstimate } from "@/components/CostEstimate";
import { DockChip } from "@/components/DockChip";
import { ImagePicker, type PickedImage } from "@/components/ImagePicker";
import { InpaintBrush } from "@/components/InpaintBrush";
import { ModelPicker } from "@/components/ModelPicker";
import { UploadsLibraryModal } from "@/components/UploadsLibraryModal";
import { ObjectEditor } from "@/components/ObjectEditor";
import { MentionPopover } from "@/components/MentionPopover";
import { SnippetPopover } from "@/components/SnippetPopover";
import { SnippetsModal } from "@/components/SnippetsModal";
import { SizePicker } from "@/components/SizePicker";
import {
  DEFAULT_SIZE,
  SIZE_PRESETS,
  defaultSizeFor,
  type ResolutionTier,
  type SizeOption,
} from "@/lib/sizes";
import {
  getDefaultModelId,
  getModelsForMode,
} from "@/lib/generationModels";
import { mentionAtCaret } from "@/lib/mentions";
import {
  recordPromptUse,
  suggestFromHistory,
  type PromptHistoryEntry,
} from "@/lib/promptHistory";
import type { StudioPrefill } from "@/lib/reuse";
import { useFeatureFlag } from "@/lib/settings";
import { type Snippet, listSnippets, slashAtCaret } from "@/lib/snippets";
import { cn } from "@/lib/utils";
import { PromptHistoryPopover } from "@/components/PromptHistoryPopover";
import type { Quality, OutputFormat } from "@/lib/fal";
import type { StartJob, EndJob } from "@/app/page";

export function StudioPanel({
  startJob,
  endJob,
  canStartMore,
  runningCount,
  references,
  onReferencesChange,
  onDropAsset,
  projectId,
  prefill,
  variant = "sidebar",
}: {
  startJob: StartJob;
  endJob: EndJob;
  canStartMore: boolean;
  runningCount: number;
  references: PickedImage[];
  onReferencesChange: (next: PickedImage[]) => void;
  onDropAsset?: (assetId: string) => void;
  projectId?: string | null;
  prefill?: StudioPrefill | null;
  // "sidebar" — fixed 380px column inside the Shell aside (default).
  // "dock"    — fills its container; rendered inside a floating bottom
  //             island by the page-level wrapper.
  variant?: "sidebar" | "dock";
}) {
  const [prompt, setPrompt] = useState("");
  // Optional "what to avoid" prompt. Only sent to fal when non-empty and
  // when the negativePrompt feature flag is on (so disabled users don't
  // accidentally accumulate leftover text in localStorage / state).
  const [negativePrompt, setNegativePrompt] = useState("");
  const negativePromptEnabled = useFeatureFlag("negativePrompt");
  const images = references;
  const setImages = onReferencesChange;
  const [mask, setMask] = useState<PickedImage[]>([]);
  const [size, setSize] = useState<SizeOption>(DEFAULT_SIZE);
  const [matchSourceAspect, setMatchSourceAspect] = useState(false);
  const [quality, setQuality] = useState<Quality>("high");
  const [outputFormat, setOutputFormat] = useState<OutputFormat>("png");
  const [numImages, setNumImages] = useState(1);
  // Model selection. Default flips between the text-to-image and image-edit
  // built-ins based on whether references are attached; a custom selection
  // overrides that until references change kind.
  const [modelId, setModelId] = useState<string>(getDefaultModelId(false));
  const [smartEditOpen, setSmartEditOpen] = useState(false);
  const [snippetsModalOpen, setSnippetsModalOpen] = useState(false);
  const [paintMaskOpen, setPaintMaskOpen] = useState(false);

  const promptRef = useRef<HTMLTextAreaElement>(null);
  const [mention, setMention] = useState<{
    startIndex: number;
    selectedIndex: number;
  } | null>(null);
  const [slash, setSlash] = useState<{
    startIndex: number;
    query: string;
    selectedIndex: number;
  } | null>(null);
  const [snippets, setSnippets] = useState<Snippet[]>([]);

  // Prompt-history autocomplete state. Suggestions are computed from
  // localStorage on every prompt change (cheap — capped at 100 entries) and
  // gated behind the `promptHistory` feature flag.
  const promptHistoryEnabled = useFeatureFlag("promptHistory");
  const [historyMatches, setHistoryMatches] = useState<PromptHistoryEntry[]>([]);
  const [historyIndex, setHistoryIndex] = useState(0);
  const [historyDismissed, setHistoryDismissed] = useState(false);

  // Load snippets once on mount.
  useEffect(() => {
    setSnippets(listSnippets());
  }, []);

  // Auto-undismiss history suggestions once the prompt is cleared — the
  // user has visibly moved on, no reason to keep suppressing the popover.
  useEffect(() => {
    if (prompt.length === 0 && historyDismissed) setHistoryDismissed(false);
  }, [prompt, historyDismissed]);

  // Recompute prompt-history suggestions whenever the prompt (or any
  // overriding popover) changes. Snippet + mention popovers take priority
  // when they're active; history hides itself out of the way.
  useEffect(() => {
    if (!promptHistoryEnabled || historyDismissed || mention || slash) {
      setHistoryMatches([]);
      return;
    }
    setHistoryMatches(suggestFromHistory(prompt));
    setHistoryIndex(0);
  }, [prompt, promptHistoryEnabled, historyDismissed, mention, slash]);

  // Apply a reuse prefill exactly once per token change.
  const appliedPrefillRef = useRef<number | null>(null);
  useEffect(() => {
    if (!prefill) return;
    if (appliedPrefillRef.current === prefill.token) return;
    appliedPrefillRef.current = prefill.token;
    setPrompt(prefill.prompt);
    if (prefill.size) setSize(prefill.size);
    if (typeof prefill.matchSourceAspect === "boolean") {
      setMatchSourceAspect(prefill.matchSourceAspect);
    }
    if (prefill.quality) setQuality(prefill.quality);
    if (prefill.mask) setMask(prefill.mask);
  }, [prefill]);

  const hasSource = images.length > 0;
  const willUseAuto = hasSource && matchSourceAspect;

  // Available models switch by mode (text-to-image vs image-edit). When the
  // mode changes, snap to that mode's default unless the user has already
  // picked a custom model in the new mode's list.
  const availableModels = useMemo(() => getModelsForMode(hasSource), [hasSource]);
  useEffect(() => {
    if (!availableModels.some((m) => m.id === modelId)) {
      setModelId(getDefaultModelId(hasSource));
    }
  }, [availableModels, modelId, hasSource]);

  useEffect(() => {
    if (mention && images.length === 0) setMention(null);
  }, [mention, images.length]);

  const filteredSnippets = (() => {
    if (!slash) return snippets;
    const q = slash.query.toLowerCase();
    if (!q) return snippets;
    return snippets.filter((s) => s.name.toLowerCase().includes(q));
  })();

  function checkContext() {
    const ta = promptRef.current;
    if (!ta) return;
    const caret = ta.selectionStart ?? 0;
    const m = mentionAtCaret(ta.value, caret);
    const s = slashAtCaret(ta.value, caret);

    setMention((prev) => {
      if (!m) return null;
      return prev && prev.startIndex === m.startIndex
        ? prev
        : { startIndex: m.startIndex, selectedIndex: 0 };
    });
    setSlash((prev) => {
      if (!s) return null;
      if (prev && prev.startIndex === s.startIndex) {
        return { ...prev, query: s.query };
      }
      return { startIndex: s.startIndex, query: s.query, selectedIndex: 0 };
    });
  }

  function insertAtMention(replacement: string, mentionStart: number, addTrailingSpace = true) {
    const ta = promptRef.current;
    if (!ta) return;
    const caret = ta.selectionStart ?? 0;
    const before = prompt.slice(0, mentionStart);
    const after = prompt.slice(caret);
    const needsSpace = addTrailingSpace && after.length > 0 && !/^\s/.test(after);
    const insertion = needsSpace ? `${replacement} ` : replacement;
    const next = before + insertion + after;
    setPrompt(next);
    const newCaret = before.length + insertion.length;
    requestAnimationFrame(() => {
      ta.focus();
      ta.setSelectionRange(newCaret, newCaret);
      checkContext();
    });
  }

  function insertMention(refIndex: number) {
    if (!mention) return;
    insertAtMention(`@image${refIndex + 1}`, mention.startIndex);
    setMention(null);
  }

  function insertHistoryEntry(entry: PromptHistoryEntry) {
    // Full-prompt replace, since the suggestion *starts* with the current
    // text by construction — appending wouldn't produce the right result.
    setPrompt(entry.prompt);
    setHistoryMatches([]);
    setHistoryDismissed(true);
    const ta = promptRef.current;
    if (ta) {
      requestAnimationFrame(() => {
        ta.focus();
        const end = entry.prompt.length;
        ta.setSelectionRange(end, end);
      });
    }
  }

  function insertSnippet(snip: Snippet) {
    if (!slash) return;
    insertAtMention(snip.body, slash.startIndex);
    setSlash(null);
  }

  function submit() {
    if (!prompt.trim() || !canStartMore) return;

    const snap = {
      prompt: prompt.trim(),
      image_urls: images.map((i) => i.url),
      mask_url: mask[0]?.url,
      image_size: willUseAuto
        ? ("auto" as const)
        : { width: size.width, height: size.height },
      quality,
      output_format: outputFormat,
      num_images: numImages,
    };

    // Record the prompt before firing the request so the next session's
    // autocomplete sees it immediately. recordPromptUse no-ops on prompts
    // that are too short to be useful — see promptHistory.ts.
    if (promptHistoryEnabled) {
      recordPromptUse(snap.prompt);
    }

    const jobId = startJob({
      kind: hasSource ? "edit" : "generate",
      prompt: snap.prompt,
      count: snap.num_images,
    });

    // Payload captured outside the fetch call so it can be reused if the
    // request fails — the failed card surfaces a "retry" button that
    // re-posts this same body, and an "edit" button that re-hydrates the
    // StudioPanel via the reuse flow.
    const trimmedNegative = negativePromptEnabled
      ? negativePrompt.trim()
      : "";
    const requestBody = {
      prompt: snap.prompt,
      negative_prompt: trimmedNegative.length > 0 ? trimmedNegative : undefined,
      image_urls: snap.image_urls.length > 0 ? snap.image_urls : undefined,
      mask_url: snap.mask_url,
      image_size: snap.image_size,
      quality: snap.quality,
      output_format: snap.output_format,
      num_images: snap.num_images,
      project_id: projectId ?? null,
      // Pass the chosen model id; the route honors it as an override.
      model: modelId,
    };
    const retry = { url: "/api/generate", body: requestBody };
    const reuse = {
      prompt: snap.prompt,
      imageUrls: snap.image_urls.length > 0 ? snap.image_urls : undefined,
      maskUrl: snap.mask_url,
      quality: snap.quality,
      outputFormat: snap.output_format,
      numImages: snap.num_images,
      modelId,
      imageSize: snap.image_size,
    };

    fetch("/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(requestBody),
    })
      .then(async (res) => {
        const json = await res.json().catch(() => ({}));
        if (!res.ok) {
          return endJob(jobId, {
            error: json.error || "failed",
            retry,
            reuse,
          });
        }
        endJob(jobId, { assets: json.assets });
      })
      .catch((e) =>
        endJob(jobId, {
          error: e instanceof Error ? e.message : "failed",
          retry,
          reuse,
        })
      );
  }

  function onKeyDown(e: React.KeyboardEvent) {
    // Slash takes priority when active (more recent trigger).
    if (slash && filteredSnippets.length > 0) {
      if (e.key === "Escape") {
        e.preventDefault();
        setSlash(null);
        return;
      }
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSlash((s) =>
          s ? { ...s, selectedIndex: (s.selectedIndex + 1) % filteredSnippets.length } : s
        );
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setSlash((s) =>
          s
            ? {
                ...s,
                selectedIndex:
                  (s.selectedIndex - 1 + filteredSnippets.length) % filteredSnippets.length,
              }
            : s
        );
        return;
      }
      if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault();
        const choice = filteredSnippets[slash.selectedIndex];
        if (choice) insertSnippet(choice);
        return;
      }
    }
    if (mention && images.length > 0) {
      if (e.key === "Escape") {
        e.preventDefault();
        setMention(null);
        return;
      }
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setMention((m) =>
          m ? { ...m, selectedIndex: (m.selectedIndex + 1) % images.length } : m
        );
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setMention((m) =>
          m
            ? {
                ...m,
                selectedIndex: (m.selectedIndex - 1 + images.length) % images.length,
              }
            : m
        );
        return;
      }
      if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault();
        insertMention(mention.selectedIndex);
        return;
      }
    }
    // Prompt history is lowest-priority — only triggers when neither slash
    // nor mention is active, and only nudges via the dedicated arrow keys
    // so the user can keep typing without fighting it. Plain Enter is
    // intentionally NOT accepted here (it'd intercept new-line insertion).
    if (historyMatches.length > 0 && !slash && !mention) {
      if (e.key === "Escape") {
        e.preventDefault();
        setHistoryDismissed(true);
        return;
      }
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setHistoryIndex((i) => (i + 1) % historyMatches.length);
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setHistoryIndex(
          (i) => (i - 1 + historyMatches.length) % historyMatches.length
        );
        return;
      }
      if (e.key === "Tab") {
        e.preventDefault();
        insertHistoryEntry(historyMatches[historyIndex]);
        return;
      }
    }
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault();
      submit();
    }
  }

  const disabled = !prompt.trim() || !canStartMore;
  const popoverPlacement = variant === "dock" ? "above" : "below";

  if (variant === "dock") {
    return (
      <DockLayout
        prompt={prompt}
        setPrompt={setPrompt}
        promptRef={promptRef}
        checkContext={checkContext}
        onKeyDown={onKeyDown}
        mention={mention}
        setMention={setMention}
        slash={slash}
        setSlash={setSlash}
        filteredSnippets={filteredSnippets}
        insertMention={insertMention}
        insertSnippet={insertSnippet}
        images={images}
        setImages={setImages}
        mask={mask}
        setMask={setMask}
        onDropAsset={onDropAsset}
        hasSource={hasSource}
        availableModels={availableModels}
        modelId={modelId}
        setModelId={setModelId}
        size={size}
        setSize={setSize}
        willUseAuto={willUseAuto}
        matchSourceAspect={matchSourceAspect}
        setMatchSourceAspect={setMatchSourceAspect}
        quality={quality}
        setQuality={setQuality}
        outputFormat={outputFormat}
        setOutputFormat={setOutputFormat}
        numImages={numImages}
        setNumImages={setNumImages}
        onOpenSmartEdit={() => setSmartEditOpen(true)}
        onOpenPaintMask={() => setPaintMaskOpen(true)}
        onOpenSnippets={() => setSnippetsModalOpen(true)}
        negativePrompt={negativePrompt}
        setNegativePrompt={setNegativePrompt}
        negativePromptEnabled={negativePromptEnabled}
        historyMatches={historyMatches}
        historyIndex={historyIndex}
        onHistoryHover={setHistoryIndex}
        onHistoryInsert={insertHistoryEntry}
        submit={submit}
        disabled={disabled}
        canStartMore={canStartMore}
        runningCount={runningCount}
        popoverPlacement={popoverPlacement}
        modals={
          <>
            {smartEditOpen && images[0] && (
              <ObjectEditor
                source={images[0]}
                startJob={startJob}
                endJob={endJob}
                onClose={() => setSmartEditOpen(false)}
              />
            )}
            {snippetsModalOpen && (
              <SnippetsModal
                initialBody={prompt}
                onClose={() => setSnippetsModalOpen(false)}
                onChange={() => setSnippets(listSnippets())}
              />
            )}
            {paintMaskOpen && images[0] && (
              <InpaintBrush
                source={images[0]}
                onClose={() => setPaintMaskOpen(false)}
                onMaskReady={(m) => setMask([m])}
              />
            )}
          </>
        }
      />
    );
  }

  return (
    <div
      className={cn(
        "flex flex-col h-full min-h-0",
        variant === "sidebar" ? "w-[380px]" : "w-full"
      )}
    >
      <div className="flex-1 overflow-y-auto p-5 space-y-5 min-h-0">
        <Section title="prompt">
          <div className="relative">
            <TextArea
              ref={promptRef}
              autoFocus
              value={prompt}
              onChange={(e) => {
                setPrompt(e.target.value);
                requestAnimationFrame(checkContext);
              }}
              onClick={checkContext}
              onKeyUp={(e) => {
                if (
                  e.key === "ArrowLeft" ||
                  e.key === "ArrowRight" ||
                  e.key === "Home" ||
                  e.key === "End"
                ) {
                  checkContext();
                }
              }}
              onBlur={() => {
                setTimeout(() => {
                  setMention(null);
                  setSlash(null);
                }, 0);
              }}
              onKeyDown={onKeyDown}
              placeholder={
                hasSource
                  ? "Describe how to transform the source image(s) — use @image1 to refer to them, / for snippets"
                  : "Describe the image you want — / for snippets…"
              }
              className="min-h-[120px]"
            />
            {mention && (
              <MentionPopover
                refs={images}
                selectedIndex={mention.selectedIndex}
                onSelect={insertMention}
                onHover={(i) =>
                  setMention((m) => (m ? { ...m, selectedIndex: i } : m))
                }
              />
            )}
            {slash && !mention && (
              <SnippetPopover
                matches={filteredSnippets}
                selectedIndex={slash.selectedIndex}
                onSelect={insertSnippet}
                onHover={(i) => setSlash((s) => (s ? { ...s, selectedIndex: i } : s))}
                onManage={() => {
                  setSlash(null);
                  setSnippetsModalOpen(true);
                }}
              />
            )}
            {!slash && !mention && historyMatches.length > 0 && (
              <PromptHistoryPopover
                matches={historyMatches}
                selectedIndex={historyIndex}
                onSelect={insertHistoryEntry}
                onHover={setHistoryIndex}
              />
            )}
          </div>
          <div className="mt-1.5 flex items-center justify-between gap-2">
            <p className="text-[10px] text-[var(--color-muted-dim)]">
              tip: <code className="font-mono text-[var(--color-muted)]">@image1</code> for refs ·{" "}
              <code className="font-mono text-[var(--color-muted)]">/</code> for snippets
              {promptHistoryEnabled && (
                <>
                  {" "}
                  · <code className="font-mono text-[var(--color-muted)]">↑↓</code> recents
                </>
              )}
            </p>
            <button
              type="button"
              onClick={() => setSnippetsModalOpen(true)}
              className="text-[10px] text-[var(--color-muted)] hover:text-[var(--color-fg)] inline-flex items-center gap-1 transition"
              title="manage snippets"
            >
              <BookmarkPlus className="size-3" />
              snippets
            </button>
          </div>
          {negativePromptEnabled && (
            <div className="mt-3">
              <Field
                label="negative prompt"
                hint="model-dependent — most fal models honor it; gpt-image-2 ignores"
              >
                <TextArea
                  value={negativePrompt}
                  onChange={(e) => setNegativePrompt(e.target.value)}
                  placeholder="what to avoid (optional)"
                  className="min-h-[60px]"
                />
              </Field>
            </div>
          )}
        </Section>

        <Section title="reference images" hint={hasSource ? `${images.length}/4` : "optional"}>
          <ImagePicker
            value={images}
            onChange={setImages}
            max={4}
            compact
            onDropAsset={onDropAsset}
          />
          {hasSource && (
            <button
              type="button"
              onClick={() => setSmartEditOpen(true)}
              className="mt-2 w-full inline-flex items-center justify-center gap-1.5 h-8 rounded-md bg-[var(--color-surface)] hover:bg-[var(--color-surface-hover)] border border-[var(--color-border)] hover:border-[var(--color-border-strong)] text-[12px] font-medium text-[var(--color-fg-dim)] hover:text-[var(--color-fg)] transition"
            >
              <MousePointerClick className="size-3.5" />
              smart edit · click an object
            </button>
          )}
        </Section>

        {hasSource && (
          <Section title="mask" hint="optional">
            <ImagePicker
              value={mask}
              onChange={setMask}
              max={1}
              description="white = edit · black = keep"
              compact
            />
            <button
              type="button"
              onClick={() => setPaintMaskOpen(true)}
              className="mt-2 w-full inline-flex items-center justify-center gap-1.5 h-8 rounded-md bg-[var(--color-surface)] hover:bg-[var(--color-surface-hover)] border border-[var(--color-border)] hover:border-[var(--color-border-strong)] text-[12px] font-medium text-[var(--color-fg-dim)] hover:text-[var(--color-fg)] transition"
            >
              <Paintbrush className="size-3.5" />
              paint mask on source
            </button>
          </Section>
        )}

        <Section title="composition">
          <Field label="model" hint={availableModels.length > 1 ? `${availableModels.length} available` : undefined}>
            <ModelPicker
              models={availableModels}
              selectedId={modelId}
              onSelect={setModelId}
            />
          </Field>

          {hasSource && (
            <button
              type="button"
              onClick={() => setMatchSourceAspect((v) => !v)}
              aria-pressed={matchSourceAspect}
              className={cn(
                "w-full flex items-start gap-2.5 text-left px-3 py-2 rounded-md border transition-colors",
                matchSourceAspect
                  ? "border-[var(--color-accent)] bg-[var(--color-accent-dim)]"
                  : "border-[var(--color-border)] hover:border-[var(--color-border-strong)] bg-[var(--color-surface)]"
              )}
            >
              <span
                className={cn(
                  "mt-px size-3.5 rounded-sm grid place-items-center shrink-0 transition-colors",
                  matchSourceAspect
                    ? "bg-[var(--color-accent)] text-[var(--color-fg-on-accent)]"
                    : "border border-[var(--color-border-strong)]"
                )}
                aria-hidden
              >
                {matchSourceAspect && <Check className="size-2.5" strokeWidth={3} />}
              </span>
              <span className="flex-1 min-w-0">
                <span className="block text-[12px] font-medium text-[var(--color-fg)]">
                  match source aspect ratio
                </span>
                <span className="block text-[10.5px] text-[var(--color-muted)] mt-0.5">
                  model picks dimensions from the first reference image
                </span>
              </span>
            </button>
          )}

          <SizePicker value={size} onChange={setSize} disabled={willUseAuto} />

          <Field label="quality">
            <Select
              value={quality}
              onChange={(e) => setQuality(e.target.value as Quality)}
              options={QUALITIES}
            />
          </Field>
        </Section>

        <Section title="output">
          <div className="flex items-end gap-3">
            <Field label="format">
              <Select
                value={outputFormat}
                onChange={(e) => setOutputFormat(e.target.value as OutputFormat)}
                options={OUTPUT_FORMATS}
              />
            </Field>
            <div>
              <div className="text-[11px] font-medium text-[var(--color-fg-dim)] mb-1.5">count</div>
              <Stepper value={numImages} onChange={setNumImages} min={1} max={4} />
            </div>
          </div>
        </Section>
      </div>

      <div className="shrink-0 border-t border-[var(--color-border)] bg-[var(--color-bg)] px-5 py-3 space-y-2">
        <div className="flex items-center justify-between gap-3">
          <span className="text-[11px] text-[var(--color-muted-dim)] flex items-center gap-1.5">
            <Kbd>⌘</Kbd>
            <Kbd>↵</Kbd>
            <span>{canStartMore ? "to queue" : "max 4 running"}</span>
          </span>
          <CostEstimate
            modelId={modelId}
            numImages={numImages}
            width={willUseAuto ? 1024 : size.width}
            height={willUseAuto ? 1024 : size.height}
            quality={quality}
          />
        </div>
        <Button onClick={submit} disabled={disabled} className="w-full">
          <Sparkles className="size-3.5" />
          {runningCount > 0 ? `Generate · ${runningCount} running` : "Generate"}
        </Button>
      </div>

      {smartEditOpen && images[0] && (
        <ObjectEditor
          source={images[0]}
          startJob={startJob}
          endJob={endJob}
          onClose={() => setSmartEditOpen(false)}
        />
      )}

      {snippetsModalOpen && (
        <SnippetsModal
          initialBody={prompt}
          onClose={() => setSnippetsModalOpen(false)}
          onChange={() => setSnippets(listSnippets())}
        />
      )}

      {paintMaskOpen && images[0] && (
        <InpaintBrush
          source={images[0]}
          onClose={() => setPaintMaskOpen(false)}
          onMaskReady={(m) => setMask([m])}
        />
      )}
    </div>
  );
}

// --- dock chip option tables ---------------------------------------------

const TIER_CHIP_OPTIONS = [
  { value: "1k", label: "1K", hint: "1024 px · fast" },
  { value: "2k", label: "2K", hint: "2048 px · balanced" },
  { value: "4k", label: "4K", hint: "3840 px · max" },
] as const;

const ASPECT_RATIO_LABEL: Record<SizeOption["aspectId"], string> = {
  square: "1:1",
  land_4_3: "4:3",
  port_3_4: "3:4",
  land_16_9: "16:9",
  port_9_16: "9:16",
  land_3_2: "3:2",
  port_2_3: "2:3",
};

const ASPECT_ORIENTATION: Record<SizeOption["aspectId"], "square" | "landscape" | "portrait"> = {
  square: "square",
  land_4_3: "landscape",
  port_3_4: "portrait",
  land_16_9: "landscape",
  port_9_16: "portrait",
  land_3_2: "landscape",
  port_2_3: "portrait",
};

const ASPECT_CHIP_OPTIONS = (
  Object.keys(ASPECT_RATIO_LABEL) as SizeOption["aspectId"][]
).map((id) => ({
  value: id,
  label: ASPECT_RATIO_LABEL[id],
  hint: ASPECT_ORIENTATION[id],
}));

const QUALITY_CHIP_OPTIONS = QUALITIES.map((q) => ({
  value: q.value,
  label: titleCase(q.label),
}));

const FORMAT_CHIP_OPTIONS = OUTPUT_FORMATS.map((f) => ({
  value: f.value,
  label: f.label.toUpperCase(),
}));

function titleCase(s: string): string {
  return s.length === 0 ? s : s[0].toUpperCase() + s.slice(1);
}

function aspectIcon(size: SizeOption): React.ReactNode {
  const orientation = ASPECT_ORIENTATION[size.aspectId];
  if (orientation === "square") return <Square className="size-3.5" />;
  if (orientation === "portrait") return <RectangleVertical className="size-3.5" />;
  return <RectangleHorizontal className="size-3.5" />;
}

// Rough token estimate. GPT-style tokenizers average ~4 chars/token for
// English; image-model prompt tokenizers vary but this is the standard
// ballpark people expect when they see a "tokens" counter. Use only as a
// length cue, never for billing.
function estimateTokens(text: string): number {
  if (!text) return 0;
  return Math.ceil(text.length / 4);
}

// Horizontal floating-island layout. The form is laid out as two dense rows:
//   row 1: [refs] [prompt textarea]                    [Generate]
//   row 2: [model] [size] [quality] [format] [count] [icons] [cost] [⌘↵]
// Sized to fill its parent container (the page wraps it at ~90vw).
function DockLayout(props: {
  prompt: string;
  setPrompt: (v: string) => void;
  promptRef: React.RefObject<HTMLTextAreaElement | null>;
  checkContext: () => void;
  onKeyDown: (e: React.KeyboardEvent) => void;
  mention: { startIndex: number; selectedIndex: number } | null;
  setMention: (
    next:
      | { startIndex: number; selectedIndex: number }
      | null
      | ((
          prev: { startIndex: number; selectedIndex: number } | null
        ) => { startIndex: number; selectedIndex: number } | null)
  ) => void;
  slash: { startIndex: number; query: string; selectedIndex: number } | null;
  setSlash: (
    next:
      | { startIndex: number; query: string; selectedIndex: number }
      | null
      | ((
          prev: { startIndex: number; query: string; selectedIndex: number } | null
        ) =>
          | { startIndex: number; query: string; selectedIndex: number }
          | null)
  ) => void;
  filteredSnippets: Snippet[];
  insertMention: (index: number) => void;
  insertSnippet: (snip: Snippet) => void;
  images: PickedImage[];
  setImages: (next: PickedImage[]) => void;
  mask: PickedImage[];
  setMask: (next: PickedImage[]) => void;
  onDropAsset?: (id: string) => void;
  hasSource: boolean;
  availableModels: ReturnType<typeof getModelsForMode>;
  modelId: string;
  setModelId: (id: string) => void;
  size: SizeOption;
  setSize: (s: SizeOption) => void;
  willUseAuto: boolean;
  matchSourceAspect: boolean;
  setMatchSourceAspect: (
    next: boolean | ((prev: boolean) => boolean)
  ) => void;
  quality: Quality;
  setQuality: (q: Quality) => void;
  outputFormat: OutputFormat;
  setOutputFormat: (f: OutputFormat) => void;
  numImages: number;
  setNumImages: (n: number) => void;
  onOpenSmartEdit: () => void;
  onOpenPaintMask: () => void;
  onOpenSnippets: () => void;
  negativePrompt: string;
  setNegativePrompt: (v: string) => void;
  negativePromptEnabled: boolean;
  historyMatches: PromptHistoryEntry[];
  historyIndex: number;
  onHistoryHover: (index: number) => void;
  onHistoryInsert: (entry: PromptHistoryEntry) => void;
  submit: () => void;
  disabled: boolean;
  canStartMore: boolean;
  runningCount: number;
  popoverPlacement: "above" | "below";
  modals: React.ReactNode;
}) {
  const {
    prompt,
    setPrompt,
    promptRef,
    checkContext,
    onKeyDown,
    mention,
    setMention,
    slash,
    setSlash,
    filteredSnippets,
    insertMention,
    insertSnippet,
    images,
    setImages,
    mask,
    setMask,
    onDropAsset,
    hasSource,
    availableModels,
    modelId,
    setModelId,
    size,
    setSize,
    willUseAuto,
    matchSourceAspect,
    setMatchSourceAspect,
    quality,
    setQuality,
    outputFormat,
    setOutputFormat,
    numImages,
    setNumImages,
    onOpenSmartEdit,
    onOpenPaintMask,
    onOpenSnippets,
    negativePrompt,
    setNegativePrompt,
    negativePromptEnabled,
    historyMatches,
    historyIndex,
    onHistoryHover,
    onHistoryInsert,
    submit,
    disabled,
    canStartMore,
    runningCount,
    popoverPlacement,
    modals,
  } = props;

  // Transient state: not persisted because expanding is per-session and
  // tightly coupled to the current prompt being written. Persisting would
  // surprise the user who returned to find their dock taller than expected.
  const [expanded, setExpanded] = useState(false);
  // Inline upload + browse-uploads state, owned here so the dock's action
  // bar can trigger them directly without going through ImagePicker (the
  // sidebar variant still uses ImagePicker normally).
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadingRef, setUploadingRef] = useState(false);
  const [browseOpen, setBrowseOpen] = useState(false);
  const charCount = prompt.length;
  const tokenCount = estimateTokens(prompt);

  // 1..max() values for the "N images" inline setting.
  const numImagesOptions = [
    { value: "1", label: "1 image" },
    { value: "2", label: "2 images" },
    { value: "3", label: "3 images" },
    { value: "4", label: "4 images" },
  ];

  async function handleRefUpload(files: FileList | File[] | null) {
    if (!files) return;
    const list = Array.from(files as FileList);
    if (list.length === 0) return;
    setUploadingRef(true);
    try {
      const next: PickedImage[] = [...images];
      for (const file of list) {
        if (next.length >= 4) break;
        const form = new FormData();
        form.append("file", file);
        const res = await fetch("/api/upload", { method: "POST", body: form });
        if (!res.ok) {
          const j = await res.json().catch(() => ({}));
          throw new Error(j.error || `upload failed (${res.status})`);
        }
        const { url } = (await res.json()) as { url: string };
        next.push({
          url,
          preview: URL.createObjectURL(file),
          name: file.name,
        });
      }
      setImages(next);
    } catch {
      // Surface upload errors via the FailedCard system if needed — for
      // now a silent failure on the dock's inline path is acceptable;
      // the user sees no thumbnail appear and can retry.
    } finally {
      setUploadingRef(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  function removeRef(i: number) {
    const next = images.slice();
    next.splice(i, 1);
    setImages(next);
  }

  return (
    <div
      className="flex flex-col h-full min-h-0 w-full p-4 gap-3"
      onDragOver={(e) => {
        if (e.dataTransfer.types.includes("Files") || e.dataTransfer.types.includes("application/x-te-asset-id")) {
          e.preventDefault();
        }
      }}
      onDrop={(e) => {
        const assetId = e.dataTransfer.getData("application/x-te-asset-id");
        if (assetId && onDropAsset) {
          e.preventDefault();
          onDropAsset(assetId);
          return;
        }
        if (e.dataTransfer.files?.length) {
          e.preventDefault();
          handleRefUpload(e.dataTransfer.files);
        }
      }}
    >
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => handleRefUpload(e.target.files)}
      />

      {/* Top row — only renders when there's something to show: ref
          thumbs on the left and/or the ref-only tool icons on the
          right. Upload + browse buttons moved to the bottom chip row
          alongside the snippets icon; only ref thumbs live up here so
          they sit close to the prompt that mentions them. */}
      {(images.length > 0 || hasSource) && (
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-1.5 flex-wrap min-w-0">
            {images.map((img, i) => (
              <div
                key={i}
                className="group/ref relative size-10 rounded-md overflow-hidden border border-[var(--color-border)] bg-black shrink-0"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={img.preview}
                  alt={img.name}
                  className="w-full h-full object-cover"
                />
                <button
                  type="button"
                  onClick={() => removeRef(i)}
                  className="absolute top-0.5 right-0.5 size-4 rounded grid place-items-center bg-black/70 text-white hover:bg-[var(--color-danger)] opacity-0 group-hover/ref:opacity-100 transition"
                  aria-label="remove reference"
                >
                  <XIcon className="size-2.5" strokeWidth={3} />
                </button>
              </div>
            ))}
          </div>

          {hasSource && (
            <div className="flex items-center gap-0.5 shrink-0">
              <FlatIconButton
                onClick={() => setMatchSourceAspect((v) => !v)}
                title="match source aspect ratio"
                ariaLabel="match source aspect ratio"
                active={matchSourceAspect}
              >
                <Ratio className="size-4" />
              </FlatIconButton>
              <FlatIconButton
                onClick={onOpenSmartEdit}
                title="smart edit · click an object"
                ariaLabel="smart edit"
              >
                <MousePointerClick className="size-4" />
              </FlatIconButton>
              <FlatIconButton
                onClick={onOpenPaintMask}
                title={mask[0] ? "edit mask" : "paint mask on source"}
                ariaLabel="paint mask"
                active={mask.length > 0}
              >
                <Paintbrush className="size-4" />
              </FlatIconButton>
            </div>
          )}
        </div>
      )}

      {/* Prompt textarea — the focal surface. Borderless, transparent,
          sits flush with the dock bg. Generous interior so the user
          feels they've got room to write. Counter + expand sit as
          near-invisible overlays that brighten on hover. */}
      <div className="relative flex-1 min-h-0 group/prompt">
        <TextArea
          ref={promptRef}
          autoFocus
          value={prompt}
          onChange={(e) => {
            setPrompt(e.target.value);
            requestAnimationFrame(checkContext);
          }}
          onClick={checkContext}
          onKeyUp={(e) => {
            if (
              e.key === "ArrowLeft" ||
              e.key === "ArrowRight" ||
              e.key === "Home" ||
              e.key === "End"
            ) {
              checkContext();
            }
          }}
          onBlur={() => {
            setTimeout(() => {
              setMention(null);
              setSlash(null);
            }, 0);
          }}
          onKeyDown={onKeyDown}
          placeholder={
            hasSource
              ? "Describe the transformation — @image1 for refs, / for snippets"
              : "What do you want to create?"
          }
          className={cn(
            "w-full h-full resize-none transition-[min-height] duration-200",
            "!bg-transparent !border-0 !rounded-none !px-0 !py-1 !text-[15px] leading-relaxed",
            "placeholder:text-[var(--color-muted)] focus:!border-0",
            expanded ? "min-h-[260px]" : "min-h-[88px]"
          )}
        />

        {mention && (
          <MentionPopover
            refs={images}
            selectedIndex={mention.selectedIndex}
            onSelect={insertMention}
            onHover={(i) =>
              setMention((m) => (m ? { ...m, selectedIndex: i } : m))
            }
            placement={popoverPlacement}
          />
        )}
        {slash && !mention && (
          <SnippetPopover
            matches={filteredSnippets}
            selectedIndex={slash.selectedIndex}
            onSelect={insertSnippet}
            onHover={(i) =>
              setSlash((s) => (s ? { ...s, selectedIndex: i } : s))
            }
            onManage={() => {
              setSlash(null);
              onOpenSnippets();
            }}
            placement={popoverPlacement}
          />
        )}
        {!slash && !mention && historyMatches.length > 0 && (
          <PromptHistoryPopover
            matches={historyMatches}
            selectedIndex={historyIndex}
            onSelect={onHistoryInsert}
            onHover={onHistoryHover}
            placement={popoverPlacement}
          />
        )}

        {/* Expand toggle — only fully visible on textarea hover/focus
            so the prompt stays clean while idle. */}
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          aria-pressed={expanded}
          title={expanded ? "shrink prompt area" : "expand prompt area"}
          className="absolute top-0 right-0 size-7 grid place-items-center rounded-md text-[var(--color-muted)] hover:text-[var(--color-fg)] hover:bg-[var(--color-surface)] transition-all opacity-0 group-hover/prompt:opacity-100 focus-within/prompt:opacity-100"
        >
          {expanded ? (
            <Minimize2 className="size-3.5" />
          ) : (
            <Maximize2 className="size-3.5" />
          )}
        </button>

        {/* Counter — pointer-events-none so it never blocks the user
            clicking into the textarea. */}
        <span
          className="pointer-events-none absolute bottom-0 right-0 text-[10px] font-mono tabular-nums text-[var(--color-muted-dim)] opacity-0 group-hover/prompt:opacity-100 focus-within/prompt:opacity-100 transition-opacity"
          title={`~${tokenCount} approximate tokens · ${charCount} characters`}
        >
          {charCount} · ~{tokenCount}t
        </span>
      </div>

      {/* Bottom row — chip row on the left, big Generate button on the
          right. Generate is taller than the chip row so it visually
          anchors the dock; align items to the bottom so the chips sit
          on the same baseline as the button's bottom edge. */}
      <div className="flex items-end justify-between gap-3">
        <div className="flex items-center gap-1.5 flex-wrap min-w-0 pb-0.5">
          <FlatIconButton
            onClick={() => fileInputRef.current?.click()}
            title="upload reference image"
            ariaLabel="upload reference"
            disabled={uploadingRef || images.length >= 4}
          >
            {uploadingRef ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <ImagePlus className="size-4" />
            )}
          </FlatIconButton>
          <FlatIconButton
            onClick={() => setBrowseOpen(true)}
            title="browse previous uploads"
            ariaLabel="browse uploads"
            disabled={images.length >= 4}
          >
            <FolderOpen className="size-4" />
          </FlatIconButton>
          <div className="min-w-0 max-w-[220px]">
            <ModelPicker
              models={availableModels}
              selectedId={modelId}
              onSelect={setModelId}
              placement="above"
            />
          </div>
          <DockChip
            value={quality}
            label={titleCase(quality)}
            options={QUALITY_CHIP_OPTIONS}
            onSelect={(v) => setQuality(v as Quality)}
            ariaLabel="quality"
          />
          <DockChip
            value={size.tier}
            label={size.tier.toUpperCase()}
            options={TIER_CHIP_OPTIONS}
            onSelect={(t) => {
              const tier = t as ResolutionTier;
              const sameAspect = SIZE_PRESETS[tier].find(
                (s) => s.aspectId === size.aspectId
              );
              setSize(sameAspect ?? defaultSizeFor(tier));
            }}
            ariaLabel="resolution"
            disabled={willUseAuto}
          />
          <DockChip
            value={size.aspectId}
            label={
              willUseAuto ? "match" : ASPECT_RATIO_LABEL[size.aspectId]
            }
            options={ASPECT_CHIP_OPTIONS}
            onSelect={(aspId) => {
              const next = SIZE_PRESETS[size.tier].find(
                (s) => s.aspectId === aspId
              );
              if (next) setSize(next);
            }}
            ariaLabel="aspect ratio"
            disabled={willUseAuto}
          />
          <DockChip
            value={outputFormat}
            label={outputFormat.toUpperCase()}
            options={FORMAT_CHIP_OPTIONS}
            onSelect={(v) => setOutputFormat(v as OutputFormat)}
            ariaLabel="output format"
          />
          <DockChip
            value={String(numImages)}
            label={`×${numImages}`}
            options={numImagesOptions}
            onSelect={(v) => setNumImages(Number(v))}
            ariaLabel="image count"
          />
          <FlatIconButton
            onClick={onOpenSnippets}
            title="manage snippets"
            ariaLabel="snippets"
          >
            <BookmarkPlus className="size-4" />
          </FlatIconButton>
        </div>

        <button
          type="button"
          onClick={submit}
          disabled={disabled}
          className={cn(
            "shrink-0 min-h-[72px] px-6 rounded-2xl",
            "bg-[var(--color-accent)] text-[var(--color-fg-on-accent)]",
            "shadow-[inset_0_1px_0_rgba(255,255,255,0.15)]",
            "transition-all duration-150",
            "hover:bg-[var(--color-accent-hover)] hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.25),0_8px_24px_-8px_var(--color-accent)]",
            "active:scale-[0.98]",
            "disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-[var(--color-accent)]",
            "inline-flex flex-col items-center justify-center gap-0.5"
          )}
          title={canStartMore ? "Generate (⌘ ↵)" : "max 4 running"}
        >
          <span className="inline-flex items-center gap-1.5 text-[14px] font-semibold tracking-tight">
            <Sparkles className="size-4" />
            {runningCount > 0 ? `Queue · ${runningCount}` : "Generate"}
          </span>
          <span className="text-[10px] font-medium opacity-80">
            <CostEstimate
              modelId={modelId}
              numImages={numImages}
              width={willUseAuto ? 1024 : size.width}
              height={willUseAuto ? 1024 : size.height}
              quality={quality}
            />
          </span>
        </button>
      </div>

      {browseOpen && (
        <UploadsLibraryModal
          onClose={() => setBrowseOpen(false)}
          onPick={(picks) => {
            const room = 4 - images.length;
            setImages([...images, ...picks.slice(0, room)]);
          }}
          slotsAvailable={4 - images.length}
        />
      )}

      {modals}
    </div>
  );
}

// Flat icon-only action-bar button. No border, no bg by default; hover
// lifts a subtle surface tint. Active state uses an accent-tinted
// background for sticky toggles. Designed for the dock's bottom row
// where chrome-less icons are the right aesthetic.
function FlatIconButton({
  active,
  onClick,
  title,
  ariaLabel,
  disabled,
  children,
}: {
  active?: boolean;
  onClick: () => void;
  title: string;
  ariaLabel: string;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      aria-label={ariaLabel}
      aria-pressed={active || undefined}
      className={cn(
        "size-8 grid place-items-center rounded-full transition-colors disabled:opacity-40 disabled:cursor-not-allowed",
        active
          ? "text-[var(--color-accent)] bg-[var(--color-accent-dim)]"
          : "text-[var(--color-muted)] hover:text-[var(--color-fg)] hover:bg-[var(--color-surface)]"
      )}
    >
      {children}
    </button>
  );
}

// Wraps a horizontal sequence of dock controls in a single bordered
// surface — the chips inside lose their individual borders and become a
// segmented strip with hairlines between them. Two visual benefits: less
// border noise in row 2, and the strip reads as one related cluster
// instead of a string of disconnected pills.
function SegmentedGroup({
  ariaLabel,
  children,
}: {
  ariaLabel: string;
  children: React.ReactNode;
}) {
  return (
    <div
      role="group"
      aria-label={ariaLabel}
      className="inline-flex items-stretch rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] overflow-hidden"
    >
      {children}
    </div>
  );
}

// Internal divider for SegmentedGroup. `strong` bumps the contrast for
// semantic breaks (e.g. toggle vs launcher trio).
function SegmentedDivider({ strong = false }: { strong?: boolean }) {
  return (
    <span
      aria-hidden
      className={cn(
        "w-px self-stretch shrink-0",
        strong ? "bg-[var(--color-border-strong)]" : "bg-[var(--color-border)]"
      )}
    />
  );
}

// Icon-only button designed to sit inside a SegmentedGroup. Borderless +
// transparent bg by default; active state lifts to accent-dim. The
// optional `hasIndicator` pip flags this as a "launcher" (opens a new
// surface) vs a sticky toggle.
function SegmentedIconButton({
  active,
  onClick,
  title,
  ariaLabel,
  hasIndicator,
  children,
}: {
  active?: boolean;
  onClick: () => void;
  title: string;
  ariaLabel: string;
  hasIndicator?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      aria-label={ariaLabel}
      aria-pressed={active || undefined}
      className={cn(
        "h-9 w-9 grid place-items-center transition-colors relative",
        active
          ? "bg-[var(--color-accent-dim)] text-[var(--color-fg)]"
          : "text-[var(--color-muted)] hover:text-[var(--color-fg)] hover:bg-[var(--color-surface-hover)]"
      )}
    >
      {children}
      {hasIndicator && (
        <span
          aria-hidden
          className="absolute top-1.5 right-1.5 size-1 rounded-full bg-[var(--color-muted-dim)] opacity-60"
        />
      )}
    </button>
  );
}

function DockIconButton({
  active,
  onClick,
  title,
  ariaLabel,
  children,
}: {
  active?: boolean;
  onClick: () => void;
  title: string;
  ariaLabel: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      aria-label={ariaLabel}
      aria-pressed={active || undefined}
      className={cn(
        "size-9 shrink-0 grid place-items-center rounded-md border transition-colors",
        active
          ? "border-[var(--color-accent)] bg-[var(--color-accent-dim)] text-[var(--color-fg)]"
          : "border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-muted)] hover:text-[var(--color-fg)] hover:border-[var(--color-border-strong)]"
      )}
    >
      {children}
    </button>
  );
}
