"use client";

// react-konva touches `window` at module evaluation, so the editor shell
// has to be dynamic-imported with `ssr: false` to avoid an SSR crash on
// /editor and /editor/[id]. This thin file is the public surface; the
// shell itself lives in EditorShell.tsx.

import dynamic from "next/dynamic";

export const EditorMount = dynamic(
  () => import("./EditorShell").then((m) => m.EditorShell),
  { ssr: false, loading: () => <EditorLoading /> }
);

function EditorLoading() {
  return (
    <div className="h-screen w-screen grid place-items-center bg-[var(--color-bg)] text-[var(--color-muted)] text-[12px]">
      Loading editor…
    </div>
  );
}
