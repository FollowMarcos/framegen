"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ImageIcon,
  AlertCircle,
  Columns,
  Trash2,
  X as XIcon,
  Image as ImgIcon,
} from "lucide-react";
import { Shell } from "@/components/Shell";
import { AssetCard, AssetSkeleton } from "@/components/AssetCard";
import { FailedCard } from "@/components/FailedCard";
import { CompareView } from "@/components/CompareView";
import { Lightbox } from "@/components/Lightbox";
import { CreditBalance } from "@/components/CreditBalance";
import { FeaturePresetWizard } from "@/components/FeaturePresetWizard";
import { OutpaintModal } from "@/components/OutpaintModal";
import { SettingsModal } from "@/components/SettingsModal";
import { UpscaleModal } from "@/components/UpscaleModal";
import { prepareReuse, type StudioPrefill } from "@/lib/reuse";
import { findSize } from "@/lib/sizes";
import { DEFAULT_SETTINGS, useSettings } from "@/lib/settings";
import {
  ActiveTagFilters,
  LibraryHeaderControls,
  PROJECT_ALL,
  PROJECT_UNSORTED,
  type ActiveProject,
} from "@/components/LibraryToolbar";
import { LibraryViewControls } from "@/components/LibraryViewControls";
import { SessionCost } from "@/components/SessionCost";
import { StudioPanel } from "@/components/panels/StudioPanel";
import type { PickedImage } from "@/components/ImagePicker";
import type { StoredAsset } from "@/lib/storage";
import type { Project } from "@/lib/projects";
import { priceForImage } from "@/lib/pricing";
import { cn } from "@/lib/utils";

export const MAX_CONCURRENT = 4;
export const MAX_REFERENCES = 4;

export const DRAG_ASSET_MIME = "application/x-te-asset-id";

export type Job = {
  id: string;
  kind: "generate" | "edit";
  prompt: string;
  expectedCount: number;
  startedAt: number;
};

// Opaque retry payload captured at submit time so a failed job can be
// re-run without the user re-entering the form. The shape is intentionally
// generic — endpoint + request body — so it covers generate, edit, smart
// edit, and upscale uniformly. Lives on FailedJob; never persisted.
export type JobRetry = {
  url: string;
  body: unknown;
};

// Reuse payload — used by the "Edit" action on a failed card to repopulate
// the StudioPanel with the prompt/size/refs from the failed attempt so the
// user can tweak before retrying. Defined here so callers don't need to
// import StudioPrefill.
export type JobReuse = {
  prompt: string;
  imageUrls?: string[];
  maskUrl?: string;
  quality?: string;
  outputFormat?: string;
  numImages?: number;
  modelId?: string;
  imageSize?: { width: number; height: number } | "auto";
};

export type StartJob = (opts: {
  kind: "generate" | "edit";
  prompt: string;
  count: number;
  projectId?: string | null;
}) => string;

export type EndJob = (
  jobId: string,
  result: {
    assets?: StoredAsset[];
    error?: string;
    retry?: JobRetry;
    reuse?: JobReuse;
  }
) => void;

export type FailedJob = {
  id: string;
  kind: "generate" | "edit" | "upscale";
  prompt: string;
  error: string;
  expectedCount: number;
  failedAt: number;
  retry?: JobRetry;
  reuse?: JobReuse;
};

export type AddReferenceFromAsset = (asset: StoredAsset) => Promise<"added" | "full" | "duplicate" | "error">;

type SessionCostState = { total: number; knownCount: number; unknownCount: number };

export default function Page() {
  const [assets, setAssets] = useState<StoredAsset[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [failedJobs, setFailedJobs] = useState<FailedJob[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [openAsset, setOpenAsset] = useState<StoredAsset | null>(null);
  const [references, setReferences] = useState<PickedImage[]>([]);
  const [addingRefIds, setAddingRefIds] = useState<Set<string>>(new Set());
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [sessionCost, setSessionCost] = useState<SessionCostState>({
    total: 0,
    knownCount: 0,
    unknownCount: 0,
  });
  const [activeProject, setActiveProject] = useState<ActiveProject>(PROJECT_ALL);
  const [searchQuery, setSearchQuery] = useState("");
  const [tagFilters, setTagFilters] = useState<string[]>([]);
  const [compareIds, setCompareIds] = useState<string[] | null>(null);
  const [outpaintAsset, setOutpaintAsset] = useState<StoredAsset | null>(null);
  const [upscaleAsset, setUpscaleAsset] = useState<StoredAsset | null>(null);
  const [upscaleBusyId, setUpscaleBusyId] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  // When non-null, SettingsModal opens scrolled to that tab. Used by the
  // first-run wizard's "Custom" option to drop the user straight into the
  // Features list.
  const [settingsInitialTab, setSettingsInitialTab] = useState<string | null>(null);
  const { settings, update: updateSettings } = useSettings();
  const [studioPrefill, setStudioPrefill] = useState<StudioPrefill | null>(null);
  const [reuseLoadingId, setReuseLoadingId] = useState<string | null>(null);

  const refreshLibrary = useCallback(async () => {
    try {
      const res = await fetch("/api/generations", { cache: "no-store" });
      const json = await res.json();
      setAssets((current) => {
        const incoming: StoredAsset[] = json.assets ?? [];
        if (
          incoming.length === current.length &&
          incoming.every((a, i) => a.id === current[i]?.id)
        ) {
          return current;
        }
        return incoming;
      });
    } catch {
      // ignore
    }
  }, []);

  const refreshProjects = useCallback(async () => {
    try {
      const res = await fetch("/api/projects", { cache: "no-store" });
      const json = await res.json();
      setProjects(json.projects ?? []);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      await Promise.all([refreshLibrary(), refreshProjects()]);
      if (!cancelled) setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [refreshLibrary, refreshProjects]);

  useEffect(() => {
    function onFocus() {
      refreshLibrary();
      refreshProjects();
    }
    function onVisibility() {
      if (document.visibilityState === "visible") {
        refreshLibrary();
        refreshProjects();
      }
    }
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [refreshLibrary, refreshProjects]);

  // If the active project gets deleted under us, fall back to "all".
  useEffect(() => {
    if (
      activeProject !== PROJECT_ALL &&
      activeProject !== PROJECT_UNSORTED &&
      !projects.some((p) => p.id === activeProject)
    ) {
      setActiveProject(PROJECT_ALL);
    }
  }, [projects, activeProject]);

  const startJob: StartJob = (opts) => {
    const id =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    setJobs((prev) => [
      ...prev,
      {
        id,
        kind: opts.kind,
        prompt: opts.prompt,
        expectedCount: opts.count,
        startedAt: Date.now(),
      },
    ]);
    return id;
  };

  const endJob: EndJob = (jobId, result) => {
    // Capture the originating job (needed for the failed card's prompt /
    // count) inside the setJobs updater so we read the latest jobs state.
    // Assigning to an outer-scope variable is technically impure, but it's
    // *idempotent* — React 19 strict-mode double-invocation just writes the
    // same value twice. The real fix is keeping `setFailedJobs` OUT of this
    // updater: calling it from inside `setJobs` made strict mode queue the
    // failed-card add twice, producing the "two children with the same key"
    // warning.
    let original: Job | undefined;
    setJobs((prev) => {
      if (result.error) {
        original = prev.find((j) => j.id === jobId);
      }
      return prev.filter((j) => j.id !== jobId);
    });
    if (result.error && original) {
      const failedJob: FailedJob = {
        id: jobId,
        kind: original.kind,
        prompt: original.prompt,
        error: result.error,
        expectedCount: original.expectedCount,
        failedAt: Date.now(),
        retry: result.retry,
        reuse: result.reuse,
      };
      // Dedupe defensively — if endJob ever gets called twice for the same
      // jobId (stale Promise chains, retry races) we don't want to render
      // two cards with the same key.
      setFailedJobs((fs) =>
        fs.some((j) => j.id === jobId) ? fs : [...fs, failedJob]
      );
    }
    if (result.assets) {
      setAssets((prev) => [...result.assets!, ...prev]);
      let added = 0;
      let known = 0;
      let unknown = 0;
      for (const a of result.assets) {
        const q = (a.extras as Record<string, unknown> | undefined)?.quality;
        const price = priceForImage(a.width, a.height, typeof q === "string" ? q : undefined);
        if (price === null) unknown += 1;
        else {
          added += price;
          known += 1;
        }
      }
      setSessionCost((prev) => ({
        total: prev.total + added,
        knownCount: prev.knownCount + known,
        unknownCount: prev.unknownCount + unknown,
      }));
    }
  };

  function dismissFailedJob(jobId: string) {
    setFailedJobs((prev) => prev.filter((j) => j.id !== jobId));
  }

  function retryFailedJob(jobId: string) {
    const failed = failedJobs.find((j) => j.id === jobId);
    if (!failed || !failed.retry) return;
    dismissFailedJob(jobId);
    const newId = startJob({
      kind: failed.kind === "upscale" ? "edit" : failed.kind,
      prompt: failed.prompt,
      count: failed.expectedCount,
    });
    const { url, body } = failed.retry;
    fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
      .then(async (res) => {
        const json = await res.json().catch(() => ({}));
        if (!res.ok) {
          return endJob(newId, {
            error: json.error || "failed",
            retry: failed.retry,
            reuse: failed.reuse,
          });
        }
        // /api/upscale returns { asset } (singular); others return { assets }.
        const assets = json.assets ?? (json.asset ? [json.asset] : []);
        endJob(newId, { assets });
      })
      .catch((e) =>
        endJob(newId, {
          error: e instanceof Error ? e.message : "failed",
          retry: failed.retry,
          reuse: failed.reuse,
        })
      );
  }

  function editFailedJob(jobId: string) {
    const failed = failedJobs.find((j) => j.id === jobId);
    if (!failed || !failed.reuse) return;
    const r = failed.reuse;
    const size =
      r.imageSize && r.imageSize !== "auto"
        ? findSize(r.imageSize.width, r.imageSize.height) ?? undefined
        : undefined;
    setStudioPrefill({
      token: Date.now(),
      prompt: r.prompt,
      size,
      matchSourceAspect: r.imageSize === "auto" ? true : undefined,
      quality: (r.quality as "auto" | "low" | "medium" | "high" | undefined) ?? undefined,
    });
    dismissFailedJob(jobId);
  }

  async function handleDelete(id: string) {
    const prev = assets;
    setAssets(prev.filter((a) => a.id !== id));
    setSelectedIds((s) => {
      if (!s.has(id)) return s;
      const next = new Set(s);
      next.delete(id);
      return next;
    });
    const res = await fetch(`/api/generations?id=${encodeURIComponent(id)}`, {
      method: "DELETE",
    });
    if (!res.ok) setAssets(prev);
  }

  async function handleBulkDelete() {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    const prev = assets;
    setAssets(prev.filter((a) => !selectedIds.has(a.id)));
    setSelectedIds(new Set());
    await Promise.allSettled(
      ids.map((id) =>
        fetch(`/api/generations?id=${encodeURIComponent(id)}`, { method: "DELETE" })
      )
    );
  }

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  // Flip an asset's `favorited` flag. Optimistic — the UI updates first,
  // and a PATCH /api/generations syncs the sidecar JSON. On failure we
  // roll back and surface the error in the banner.
  async function handleToggleFavorite(asset: StoredAsset) {
    const nextFavorited = !asset.favorited;
    setAssets((prev) =>
      prev.map((a) =>
        a.id === asset.id ? { ...a, favorited: nextFavorited } : a
      )
    );
    try {
      const res = await fetch("/api/generations", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: asset.id, favorited: nextFavorited }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || "favorite failed");
      }
    } catch (e) {
      // Roll back
      setAssets((prev) =>
        prev.map((a) =>
          a.id === asset.id ? { ...a, favorited: !nextFavorited } : a
        )
      );
      setError(e instanceof Error ? e.message : "favorite failed");
    }
  }

  const addReferenceFromAsset: AddReferenceFromAsset = async (asset) => {
    if (references.length >= MAX_REFERENCES) return "full";
    if (references.some((r) => r.preview === asset.url)) return "duplicate";

    setAddingRefIds((prev) => {
      const next = new Set(prev);
      next.add(asset.id);
      return next;
    });

    try {
      const blobRes = await fetch(asset.url);
      if (!blobRes.ok) throw new Error("could not load image bytes");
      const blob = await blobRes.blob();
      const file = new File([blob], asset.fileName, {
        type: blob.type || asset.contentType || "image/png",
      });
      const form = new FormData();
      form.append("file", file);
      const upRes = await fetch("/api/upload", { method: "POST", body: form });
      if (!upRes.ok) {
        const j = await upRes.json().catch(() => ({}));
        throw new Error(j.error || `upload failed (${upRes.status})`);
      }
      const { url } = (await upRes.json()) as { url: string };

      let result: "added" | "full" = "added";
      setReferences((prev) => {
        if (prev.length >= MAX_REFERENCES) {
          result = "full";
          return prev;
        }
        if (prev.some((r) => r.preview === asset.url)) return prev;
        return [...prev, { url, preview: asset.url, name: asset.fileName }];
      });
      return result;
    } catch (e) {
      setError(e instanceof Error ? e.message : "could not add as reference");
      return "error";
    } finally {
      setAddingRefIds((prev) => {
        const next = new Set(prev);
        next.delete(asset.id);
        return next;
      });
    }
  };

  async function addSelectedAsReferences() {
    const ids = Array.from(selectedIds);
    const slotsLeft = MAX_REFERENCES - references.length;
    if (slotsLeft <= 0 || ids.length === 0) return;
    const toAdd = assets.filter((a) => ids.includes(a.id)).slice(0, slotsLeft);
    for (const a of toAdd) {
      await addReferenceFromAsset(a);
    }
    setSelectedIds(new Set());
  }

  async function updateAssetMeta(
    id: string,
    patch: { tags?: string[]; projectId?: string | null }
  ) {
    // Optimistic update so the UI reflects immediately.
    setAssets((prev) =>
      prev.map((a) => (a.id === id ? { ...a, ...patch } : a))
    );
    if (openAsset?.id === id) {
      setOpenAsset((curr) => (curr ? { ...curr, ...patch } : curr));
    }
    try {
      const res = await fetch("/api/generations", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, ...patch }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || "update failed");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "update failed");
      // Re-sync from server to undo the optimistic patch on failure.
      refreshLibrary();
    }
  }

  // --- Project CRUD ---------------------------------------------------------
  async function handleCreateProject(name: string) {
    const res = await fetch("/api/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      setError(j.error || "could not create project");
      return;
    }
    const { project } = (await res.json()) as { project: Project };
    setProjects((prev) => [...prev, project].sort((a, b) => a.name.localeCompare(b.name)));
    setActiveProject(project.id);
  }

  async function handleRenameProject(id: string, name: string) {
    const res = await fetch("/api/projects", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, name }),
    });
    if (!res.ok) return;
    setProjects((prev) =>
      prev.map((p) => (p.id === id ? { ...p, name } : p)).sort((a, b) => a.name.localeCompare(b.name))
    );
  }

  async function handleDeleteProject(id: string) {
    await fetch(`/api/projects?id=${encodeURIComponent(id)}`, { method: "DELETE" });
    setProjects((prev) => prev.filter((p) => p.id !== id));
    if (activeProject === id) setActiveProject(PROJECT_ALL);
  }

  // --- Reuse ----------------------------------------------------------------
  // Loads an existing asset's prompt, size, quality, and references back into
  // the studio panel. The asset's persisted source images are re-uploaded to
  // fal storage so they're usable in a new generation immediately.
  async function handleReuse(asset: StoredAsset) {
    if (reuseLoadingId) return;
    setReuseLoadingId(asset.id);
    setOpenAsset(null);
    try {
      const prepared = await prepareReuse(asset);
      setReferences(prepared.references);
      setStudioPrefill({ token: Date.now(), ...prepared.prefill });
    } catch (e) {
      setError(e instanceof Error ? e.message : "reuse failed");
    } finally {
      setReuseLoadingId(null);
    }
  }

  // --- Variations -----------------------------------------------------------
  // "More like this" — re-queue a generation with the same prompt + model +
  // size + quality. References and masks are intentionally *not* carried
  // over: re-uploading source files for every variation click would be slow
  // and surprising. Users who want references re-attached should use Reuse
  // instead, which prepares the studio panel and lets them tweak first.
  async function handleVariation(asset: StoredAsset) {
    if (!canStartMore) {
      setError("max 4 generations running — wait for one to finish");
      return;
    }
    const extras = (asset.extras ?? {}) as Record<string, unknown>;
    const quality =
      typeof extras.quality === "string" ? (extras.quality as string) : "high";
    const imageSize =
      extras.image_size && typeof extras.image_size === "object"
        ? (extras.image_size as { width: number; height: number })
        : asset.width && asset.height
          ? { width: asset.width, height: asset.height }
          : { width: 1024, height: 1024 };

    const requestBody = {
      prompt: asset.prompt,
      image_size: imageSize,
      quality,
      output_format: "png",
      num_images: 1,
      project_id: asset.projectId ?? null,
      model: asset.model,
    };
    const retry = { url: "/api/generate", body: requestBody };

    const jobId = startJob({
      kind: "generate",
      prompt: `Variation · ${asset.prompt}`,
      count: 1,
    });

    fetch("/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(requestBody),
    })
      .then(async (res) => {
        const json = await res.json().catch(() => ({}));
        if (!res.ok) {
          endJob(jobId, { error: json.error || "variation failed", retry });
        } else {
          endJob(jobId, { assets: json.assets });
        }
      })
      .catch((e) =>
        endJob(jobId, {
          error: e instanceof Error ? e.message : "variation failed",
          retry,
        })
      );
  }

  // --- Upscale --------------------------------------------------------------
  async function runUpscale(asset: StoredAsset, modelId: string, factor: number) {
    setUpscaleBusyId(asset.id);
    setUpscaleAsset(null);
    const jobId = startJob({
      kind: "edit",
      prompt: `Upscale ${factor}× · ${asset.prompt}`,
      count: 1,
    });
    const requestBody = { id: asset.id, model: modelId, factor };
    const retry = { url: "/api/upscale", body: requestBody };
    try {
      const res = await fetch("/api/upscale", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
      });
      const json = await res.json();
      if (!res.ok) {
        endJob(jobId, { error: json.error || "upscale failed", retry });
      } else {
        endJob(jobId, { assets: [json.asset] });
      }
    } catch (e) {
      endJob(jobId, {
        error: e instanceof Error ? e.message : "upscale failed",
        retry,
      });
    } finally {
      setUpscaleBusyId(null);
    }
  }

  // --- Filtering ------------------------------------------------------------
  const filteredAssets = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const favoritesOnly = settings.libraryFavoritesOnly ?? false;
    const filtered = assets.filter((a) => {
      if (activeProject === PROJECT_UNSORTED) {
        if (a.projectId) return false;
      } else if (activeProject !== PROJECT_ALL) {
        if (a.projectId !== activeProject) return false;
      }
      if (favoritesOnly && !a.favorited) return false;
      if (q && !a.prompt.toLowerCase().includes(q)) return false;
      if (tagFilters.length > 0) {
        const t = a.tags ?? [];
        if (!tagFilters.every((f) => t.includes(f))) return false;
      }
      return true;
    });

    // Sort respects the user's saved preference. The default (and prior
    // behavior) is "newest first"; storage.ts already returns assets in
    // newest-first order so that branch is a no-op.
    const sort = settings.librarySort ?? "newest";
    const sorted = [...filtered];
    switch (sort) {
      case "oldest":
        sorted.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
        break;
      case "prompt-az":
        sorted.sort((a, b) =>
          a.prompt.localeCompare(b.prompt, undefined, { sensitivity: "base" })
        );
        break;
      case "prompt-za":
        sorted.sort((a, b) =>
          b.prompt.localeCompare(a.prompt, undefined, { sensitivity: "base" })
        );
        break;
      case "model":
        sorted.sort(
          (a, b) =>
            a.model.localeCompare(b.model) ||
            b.createdAt.localeCompare(a.createdAt)
        );
        break;
      case "newest":
      default:
        // Already newest-first from listAssets; sort defensively in case
        // future endpoints return a different ordering.
        sorted.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
        break;
    }
    return sorted;
  }, [
    assets,
    activeProject,
    searchQuery,
    tagFilters,
    settings.libraryFavoritesOnly,
    settings.librarySort,
  ]);

  // --- Pagination -----------------------------------------------------------
  // visibleCount caps how many filtered assets we actually render. We bump it
  // when an IntersectionObserver sentinel scrolls into view. Resets to one
  // page whenever the active filter or page size changes.
  const pageSize = settings.pageSize;
  const [visibleCount, setVisibleCount] = useState<number>(
    pageSize === 0 ? Number.POSITIVE_INFINITY : pageSize
  );
  useEffect(() => {
    setVisibleCount(pageSize === 0 ? Number.POSITIVE_INFINITY : pageSize);
  }, [pageSize, activeProject, searchQuery, tagFilters]);

  const renderedAssets = useMemo(
    () =>
      Number.isFinite(visibleCount)
        ? filteredAssets.slice(0, visibleCount)
        : filteredAssets,
    [filteredAssets, visibleCount]
  );
  const hasMore = renderedAssets.length < filteredAssets.length;

  const sentinelRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || !hasMore || pageSize === 0) return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setVisibleCount((n) =>
              Number.isFinite(n) ? n + pageSize : n
            );
          }
        }
      },
      { rootMargin: "300px" }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [hasMore, pageSize, filteredAssets.length]);

  // --- Tag click on a card adds it as a filter (handled inside AssetCard later if we wire it). ---
  function addTagFilter(tag: string) {
    setTagFilters((prev) => (prev.includes(tag) ? prev : [...prev, tag]));
  }

  function removeTagFilter(tag: string) {
    setTagFilters((prev) => prev.filter((t) => t !== tag));
  }

  const canStartMore = jobs.length < MAX_CONCURRENT;
  const runningCount = jobs.length;
  const referencesFull = references.length >= MAX_REFERENCES;

  const pendingSlots = useMemo(
    () =>
      jobs.flatMap((j) =>
        Array.from({ length: j.expectedCount }, (_, i) => ({
          key: `${j.id}-${i}`,
          jobId: j.id,
          prompt: j.prompt,
          startedAt: j.startedAt,
        }))
      ),
    [jobs]
  );

  const handleDropAsset = useCallback(
    (id: string) => {
      const a = assets.find((x) => x.id === id);
      if (a) addReferenceFromAsset(a);
    },
    [assets, addReferenceFromAsset]
  );

  // Active project for new generations: only when a real project is selected.
  const newGenProjectId =
    activeProject === PROJECT_ALL || activeProject === PROJECT_UNSORTED
      ? null
      : activeProject;

  const menuLayout = settings.menuLayout ?? DEFAULT_SETTINGS.menuLayout;
  const dockMode = menuLayout === "dock";

  // Tracks the live height of the floating dock so the library can reserve
  // matching bottom padding. The dock can shrink or grow on demand (e.g. when
  // the user toggles the prompt expand button), so a static value would
  // either leave a gap or cover cards.
  const dockRef = useRef<HTMLDivElement>(null);
  const [dockHeight, setDockHeight] = useState(220);
  useEffect(() => {
    if (!dockMode) {
      setDockHeight(220);
      return;
    }
    const el = dockRef.current;
    if (!el) return;
    const update = () => setDockHeight(el.clientHeight + 40);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [dockMode]);

  const studioPanel = useMemo(
    () => (
      <StudioPanel
        startJob={startJob}
        endJob={endJob}
        canStartMore={canStartMore}
        runningCount={runningCount}
        references={references}
        onReferencesChange={setReferences}
        onDropAsset={handleDropAsset}
        projectId={newGenProjectId}
        prefill={studioPrefill}
        variant={dockMode ? "dock" : "sidebar"}
      />
    ),
    [canStartMore, runningCount, references, handleDropAsset, newGenProjectId, studioPrefill, dockMode]
  );

  const selectionMode = selectedIds.size > 0;

  return (
    <>
      <Shell
        sidebar={dockMode ? null : studioPanel}
        onOpenSettings={() => setSettingsOpen(true)}
        meta={
          <>
            <CreditBalance />
            <SessionCost
              totalUSD={sessionCost.total}
              knownCount={sessionCost.knownCount}
              unknownCount={sessionCost.unknownCount}
            />
          </>
        }
        toolbar={
          <div className="flex items-center gap-3 min-w-0">
            <LibraryStatus
              loading={loading}
              filtered={filteredAssets.length}
              total={assets.length}
              runningCount={runningCount}
            />
            <LibraryHeaderControls
              projects={projects}
              activeProject={activeProject}
              onChangeProject={setActiveProject}
              onCreateProject={handleCreateProject}
              onRenameProject={handleRenameProject}
              onDeleteProject={handleDeleteProject}
              search={searchQuery}
              onSearchChange={setSearchQuery}
            />
          </div>
        }
      >
        <div
          className={cn(
            "p-8",
            !dockMode && (selectionMode ? "pb-36" : "pb-24")
          )}
          style={dockMode ? { paddingBottom: `${dockHeight}px` } : undefined}
        >
          {error && (
            <div
              role="alert"
              className="mb-6 flex items-start gap-2.5 rounded-lg border border-[var(--color-danger)]/30 bg-[var(--color-danger)]/5 px-3.5 py-2.5"
            >
              <AlertCircle className="size-4 text-[var(--color-danger)] shrink-0 mt-0.5" />
              <p className="flex-1 min-w-0 text-[12px] text-[var(--color-fg-dim)] break-words">
                {error}
              </p>
              <button
                onClick={() => setError(null)}
                className="text-[11px] text-[var(--color-muted)] hover:text-[var(--color-fg)] shrink-0"
              >
                dismiss
              </button>
            </div>
          )}

          {tagFilters.length > 0 && (
            <div className="mb-3">
              <ActiveTagFilters
                tagFilters={tagFilters}
                onRemoveTag={removeTagFilter}
                onClearTags={() => setTagFilters([])}
              />
            </div>
          )}

          <div className="mb-5">
            <LibraryViewControls
              sort={settings.librarySort ?? DEFAULT_SETTINGS.librarySort}
              onSortChange={(next) => updateSettings({ librarySort: next })}
              favoritesOnly={settings.libraryFavoritesOnly ?? false}
              onFavoritesToggle={() =>
                updateSettings({
                  libraryFavoritesOnly: !settings.libraryFavoritesOnly,
                })
              }
              gridCols={settings.libraryGridCols ?? DEFAULT_SETTINGS.libraryGridCols}
              onGridColsChange={(next) => updateSettings({ libraryGridCols: next })}
            />
          </div>

          {loading ? (
            <Grid cols={settings.libraryGridCols ?? DEFAULT_SETTINGS.libraryGridCols}>
              {Array.from({ length: 8 }).map((_, i) => (
                <AssetSkeleton key={i} />
              ))}
            </Grid>
          ) : filteredAssets.length === 0 && pendingSlots.length === 0 && failedJobs.length === 0 ? (
            <EmptyState filtered={assets.length > 0} />
          ) : (
            <>
              <Grid cols={settings.libraryGridCols ?? DEFAULT_SETTINGS.libraryGridCols}>
                {failedJobs.map((fj) => (
                  <FailedCard
                    key={fj.id}
                    job={fj}
                    onRetry={retryFailedJob}
                    onEdit={editFailedJob}
                    onDelete={dismissFailedJob}
                  />
                ))}
                {pendingSlots.map((slot) => (
                  <AssetSkeleton key={slot.key} prompt={slot.prompt} startedAt={slot.startedAt} />
                ))}
                {renderedAssets.map((a) => (
                  <AssetCard
                    key={a.id}
                    asset={a}
                    onDelete={handleDelete}
                    onOpen={(asset) => (selectionMode ? toggleSelect(asset.id) : setOpenAsset(asset))}
                    onUseAsReference={addReferenceFromAsset}
                    refLoading={addingRefIds.has(a.id)}
                    refsFull={referencesFull}
                    selected={selectedIds.has(a.id)}
                    selectionMode={selectionMode}
                    onToggleSelect={toggleSelect}
                    onTagClick={addTagFilter}
                    onReuse={handleReuse}
                    reuseLoading={reuseLoadingId === a.id}
                    onVariation={handleVariation}
                    onToggleFavorite={handleToggleFavorite}
                  />
                ))}
              </Grid>
              {hasMore && (
                <div ref={sentinelRef} className="mt-6 grid place-items-center text-[11px] text-[var(--color-muted)]">
                  <span className="inline-flex items-center gap-2 px-3 py-2 rounded-md bg-[var(--color-surface)] border border-[var(--color-border)]">
                    <span className="size-3 rounded-full border-2 border-[var(--color-border-strong)] border-t-[var(--color-accent)] animate-spin" />
                    loading more · {renderedAssets.length} of {filteredAssets.length}
                  </span>
                </div>
              )}
            </>
          )}
        </div>
      </Shell>

      {dockMode && (
        <div
          ref={dockRef}
          aria-label="studio dock"
          className="fixed bottom-4 left-1/2 -translate-x-1/2 w-[min(820px,90vw)] z-30 max-h-[calc(100vh-7rem)] rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-elevated)] shadow-2xl flex flex-col"
        >
          {studioPanel}
        </div>
      )}

      {selectionMode && (
        <SelectionBar
          count={selectedIds.size}
          referencesFull={referencesFull}
          canCompare={selectedIds.size >= 2 && selectedIds.size <= 4}
          onClear={() => setSelectedIds(new Set())}
          onDelete={handleBulkDelete}
          onAddAsReferences={addSelectedAsReferences}
          onCompare={() => {
            setCompareIds(Array.from(selectedIds));
            setSelectedIds(new Set());
          }}
          positionClass={dockMode ? "top-16" : undefined}
        />
      )}

      {compareIds && (
        <CompareView
          assets={assets.filter((a) => compareIds.includes(a.id))}
          onClose={() => setCompareIds(null)}
        />
      )}

      {outpaintAsset && (
        <OutpaintModal
          asset={outpaintAsset}
          startJob={startJob}
          endJob={endJob}
          onClose={() => setOutpaintAsset(null)}
        />
      )}

      {upscaleAsset && (
        <UpscaleModal
          asset={upscaleAsset}
          onClose={() => setUpscaleAsset(null)}
          onConfirm={(modelId, factor) => runUpscale(upscaleAsset, modelId, factor)}
        />
      )}

      {settingsOpen && (
        <SettingsModal
          settings={settings}
          onChange={updateSettings}
          onClose={() => {
            setSettingsOpen(false);
            setSettingsInitialTab(null);
          }}
          libraryCount={assets.length}
          initialTab={settingsInitialTab ?? undefined}
        />
      )}

      <FeaturePresetWizard
        onOpenSettings={() => {
          setSettingsInitialTab("features");
          setSettingsOpen(true);
        }}
      />



      <Lightbox
        asset={openAsset}
        assets={filteredAssets}
        onClose={() => setOpenAsset(null)}
        onDelete={handleDelete}
        onNavigate={setOpenAsset}
        onUseAsReference={addReferenceFromAsset}
        refLoadingId={openAsset && addingRefIds.has(openAsset.id) ? openAsset.id : null}
        refsFull={referencesFull}
        projects={projects}
        onUpdateMeta={updateAssetMeta}
        onUpscale={(a) => {
          setOpenAsset(null);
          setUpscaleAsset(a);
        }}
        onOutpaint={(a) => {
          setOpenAsset(null);
          setOutpaintAsset(a);
        }}
        busyUpscaleId={upscaleBusyId}
        onReuse={handleReuse}
        reuseLoadingId={reuseLoadingId}
      />
    </>
  );
}

function Grid({
  children,
  cols,
}: {
  children: React.ReactNode;
  // User-controlled column count from the library toolbar. Falls back to
  // 5 if omitted, clamped to the same [2, 7] range the slider uses.
  cols?: number;
}) {
  const targetCols = Math.max(2, Math.min(7, cols ?? 5));
  return (
    <div
      className="grid gap-3"
      style={{
        gridTemplateColumns: `repeat(${targetCols}, minmax(0, 1fr))`,
      }}
    >
      {children}
    </div>
  );
}

function EmptyState({ filtered }: { filtered: boolean }) {
  return (
    <div className="rounded-xl border border-dashed border-[var(--color-border)] py-20 grid place-items-center text-center">
      <div className="size-10 rounded-full bg-[var(--color-surface)] grid place-items-center mb-3">
        <ImageIcon className="size-4 text-[var(--color-muted)]" />
      </div>
      <p className="text-[13px] font-medium">
        {filtered ? "No images match" : "No images yet"}
      </p>
      <p className="text-[11px] text-[var(--color-muted)] mt-1">
        {filtered ? (
          "Try clearing the search, tags, or project filter."
        ) : (
          <>
            Describe what you want in the panel and press{" "}
            <kbd className="font-mono text-[10px] px-1 py-0.5 rounded bg-[var(--color-surface)] border border-[var(--color-border)]">
              ⌘ ↵
            </kbd>
          </>
        )}
      </p>
    </div>
  );
}

// Compact library status indicator for the top bar: shows the filtered /
// total asset count and a running-batches accent when generations are in
// flight. Replaces the page-level "Library" heading + count line.
function LibraryStatus({
  loading,
  filtered,
  total,
  runningCount,
}: {
  loading: boolean;
  filtered: number;
  total: number;
  runningCount: number;
}) {
  return (
    <div className="hidden md:flex items-baseline gap-2 shrink-0">
      <span className="text-[12px] font-semibold tracking-tight text-[var(--color-fg)]">
        Library
      </span>
      <span className="text-[11px] font-mono tabular-nums text-[var(--color-muted)]">
        {loading ? "loading…" : `${filtered}/${total}`}
      </span>
      {runningCount > 0 && (
        <span className="text-[11px] font-mono tabular-nums text-[var(--color-accent)]">
          · {runningCount} running
        </span>
      )}
    </div>
  );
}

function SelectionBar({
  count,
  referencesFull,
  canCompare,
  onClear,
  onDelete,
  onAddAsReferences,
  onCompare,
  positionClass,
}: {
  count: number;
  referencesFull: boolean;
  canCompare: boolean;
  onClear: () => void;
  onDelete: () => void;
  onAddAsReferences: () => void;
  onCompare: () => void;
  // Override default `bottom-4` — used in dock mode where the floating
  // studio dock owns the bottom of the viewport, so this bar moves to
  // the top instead of fighting for the same z-index slot.
  positionClass?: string;
}) {
  return (
    <div
      role="region"
      aria-label="selection actions"
      className={cn(
        "fixed left-1/2 -translate-x-1/2 z-40 animate-in",
        positionClass ?? "bottom-2"
      )}
    >
      <div className="flex items-center gap-2 px-3 py-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-elevated)] shadow-2xl">
        <span className="text-[12px] font-medium px-1.5">{count} selected</span>
        <span className="w-px h-5 bg-[var(--color-border)]" />
        <button
          type="button"
          onClick={onCompare}
          disabled={!canCompare}
          className="inline-flex items-center gap-1.5 h-8 px-2.5 rounded-md text-[12px] font-medium hover:bg-[var(--color-surface)] disabled:opacity-40 disabled:cursor-not-allowed transition"
          title={canCompare ? "compare side-by-side" : "select 2–4 to compare"}
        >
          <Columns className="size-3.5" />
          compare
        </button>
        <button
          type="button"
          onClick={onAddAsReferences}
          disabled={referencesFull}
          className="inline-flex items-center gap-1.5 h-8 px-2.5 rounded-md text-[12px] font-medium text-[var(--color-accent)] hover:bg-[var(--color-accent)]/15 disabled:opacity-40 disabled:cursor-not-allowed transition"
          title={referencesFull ? "max 4 references" : "add as references"}
        >
          <ImgIcon className="size-3.5" />
          use as references
        </button>
        <button
          type="button"
          onClick={onDelete}
          className="inline-flex items-center gap-1.5 h-8 px-2.5 rounded-md text-[12px] font-medium text-[var(--color-danger)] hover:bg-[var(--color-danger)]/10 transition"
        >
          <Trash2 className="size-3.5" />
          delete
        </button>
        <span className="w-px h-5 bg-[var(--color-border)]" />
        <button
          type="button"
          onClick={onClear}
          className="size-8 rounded-md grid place-items-center text-[var(--color-muted)] hover:text-[var(--color-fg)] hover:bg-[var(--color-surface)] transition"
          aria-label="clear selection"
          title="clear (Esc)"
        >
          <XIcon className="size-3.5" />
        </button>
      </div>
    </div>
  );
}
