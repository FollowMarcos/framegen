"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { CreditBalance } from "@/components/CreditBalance";
import { Shell } from "@/components/Shell";
import {
  DashboardNav,
  type DashboardSection,
} from "@/components/dashboard/DashboardNav";
import { OverviewSection } from "@/components/dashboard/OverviewSection";
import { ModelsSection } from "@/components/dashboard/ModelsSection";
import { UploadsSection } from "@/components/dashboard/UploadsSection";
import { EditsSection } from "@/components/dashboard/EditsSection";
import { TrashSection } from "@/components/dashboard/TrashSection";
import { DocsSection } from "@/components/dashboard/DocsSection";
import type { StoredAsset } from "@/lib/storage";
import type { Project } from "@/lib/projects";

const VALID_SECTIONS: readonly DashboardSection[] = [
  "overview",
  "models",
  "uploads",
  "edits",
  "trash",
  "docs",
];

export default function DashboardPage() {
  // useSearchParams forces this page off the static prerender path, so
  // it must sit inside a Suspense boundary. Same pattern as the editor
  // entry route.
  return (
    <Suspense fallback={null}>
      <DashboardInner />
    </Suspense>
  );
}

function DashboardInner() {
  const params = useSearchParams();
  // Honour ?section=<id> on first load so deep-links (e.g. the editor's
  // back arrow → /dashboard?section=edits) land on the right tab.
  // After mount the user drives the section via the nav, so we keep
  // local state authoritative rather than wiring two-way URL sync.
  const initialSection: DashboardSection = (() => {
    const raw = params.get("section");
    return raw && (VALID_SECTIONS as readonly string[]).includes(raw)
      ? (raw as DashboardSection)
      : "overview";
  })();
  const [section, setSection] = useState<DashboardSection>(initialSection);
  const [assets, setAssets] = useState<StoredAsset[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);

  const refresh = useCallback(async () => {
    const [a, p] = await Promise.all([
      fetch("/api/generations", { cache: "no-store" }).then((r) => r.json()).catch(() => ({})),
      fetch("/api/projects", { cache: "no-store" }).then((r) => r.json()).catch(() => ({})),
    ]);
    setAssets(a.assets ?? []);
    setProjects(p.projects ?? []);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return (
    <Shell
      sidebar={<DashboardNav active={section} onChange={setSection} />}
      meta={<CreditBalance />}
    >
      {/* All sections render full-width so dense content (stats grids, model
          cards, code blocks) can spread out on wide monitors. Each section is
          responsible for its own internal width caps where line-length
          readability matters (e.g. the docs prose column). */}
      <div className="p-8">
        {section === "overview" && <OverviewSection assets={assets} projects={projects} />}
        {section === "models" && <ModelsSection />}
        {section === "uploads" && <UploadsSection />}
        {section === "edits" && <EditsSection />}
        {section === "trash" && <TrashSection />}
        {section === "docs" && <DocsSection />}
      </div>
    </Shell>
  );
}
