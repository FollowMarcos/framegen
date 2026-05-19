"use client";

import { MODELS } from "@/lib/fal";
import { listCustomModels } from "@/lib/customModels";

// A generation model is either the built-in GPT Image 2 default for a given
// mode, or a custom user-added model. The studio panel shows all applicable
// options for the current mode (text-to-image vs image-edit) in a single
// picker.

export type GenerationModelKind = "image-gen" | "image-edit";

export type GenerationModel = {
  id: string;
  kind: GenerationModelKind;
  name: string;
  description: string;
  isBuiltIn: boolean;
};

const BUILT_INS: GenerationModel[] = [
  // GPT Image 2 — OpenAI's image model. Default in both modes.
  {
    id: MODELS.image,
    kind: "image-gen",
    name: "GPT Image 2",
    description: "OpenAI text-to-image. Default for prompts without references.",
    isBuiltIn: true,
  },
  {
    id: MODELS.imageEdit,
    kind: "image-edit",
    name: "GPT Image 2 · edit",
    description: "OpenAI image-edit. Default when references are attached.",
    isBuiltIn: true,
  },

  // Nano Banana 2 — Google Gemini 2.5 Flash Image via fal. Fast, cheap,
  // generally weaker on fine detail than GPT Image 2 high quality but a
  // good default when iterating prompts at speed.
  {
    id: MODELS.nanoBanana2,
    kind: "image-gen",
    name: "Nano Banana 2",
    description: "Google Gemini 2.5 Flash image — fast and cheap. Good for iteration.",
    isBuiltIn: true,
  },
  {
    id: MODELS.nanoBanana2Edit,
    kind: "image-edit",
    name: "Nano Banana 2 · edit",
    description: "Gemini 2.5 Flash image, edit mode. Accepts reference images + a prompt.",
    isBuiltIn: true,
  },

  // Nano Banana Pro — higher-quality variant of the same family. Slower
  // and pricier per call but better on detail-heavy prompts.
  {
    id: MODELS.nanoBananaPro,
    kind: "image-gen",
    name: "Nano Banana Pro",
    description: "Pro Nano Banana — slower than v2 but stronger on detail.",
    isBuiltIn: true,
  },
  {
    id: MODELS.nanoBananaProEdit,
    kind: "image-edit",
    name: "Nano Banana Pro · edit",
    description: "Pro Nano Banana, edit mode. References + prompt at higher quality.",
    isBuiltIn: true,
  },

  // Seedream — ByteDance's unified text-to-image / image-edit family.
  // Three generations available: v4, v4.5, and v5 Lite. All three expose
  // both modes via distinct endpoints, so they appear as paired entries
  // here just like the OpenAI + Nano Banana families.
  {
    id: MODELS.seedream4,
    kind: "image-gen",
    name: "Seedream 4",
    description: "ByteDance unified image gen + edit, v4.",
    isBuiltIn: true,
  },
  {
    id: MODELS.seedream4Edit,
    kind: "image-edit",
    name: "Seedream 4 · edit",
    description: "ByteDance Seedream v4, edit mode.",
    isBuiltIn: true,
  },
  {
    id: MODELS.seedream45,
    kind: "image-gen",
    name: "Seedream 4.5",
    description: "ByteDance Seedream v4.5 — refined over v4.",
    isBuiltIn: true,
  },
  {
    id: MODELS.seedream45Edit,
    kind: "image-edit",
    name: "Seedream 4.5 · edit",
    description: "ByteDance Seedream v4.5, edit mode.",
    isBuiltIn: true,
  },
  {
    id: MODELS.seedream5Lite,
    kind: "image-gen",
    name: "Seedream 5 Lite",
    description: "ByteDance Seedream v5 Lite — newer generation, lightweight tier.",
    isBuiltIn: true,
  },
  {
    id: MODELS.seedream5LiteEdit,
    kind: "image-edit",
    name: "Seedream 5 Lite · edit",
    description: "ByteDance Seedream v5 Lite, edit mode with multi-image inputs.",
    isBuiltIn: true,
  },
];

export function getAllGenerationModels(): GenerationModel[] {
  const custom = listCustomModels()
    .filter((m) => m.kind === "image-gen" || m.kind === "image-edit")
    .map<GenerationModel>((m) => ({
      id: m.id,
      kind: m.kind as GenerationModelKind,
      name: m.name,
      description: m.description,
      isBuiltIn: false,
    }));
  return [...BUILT_INS, ...custom];
}

export function getModelsForMode(hasReferences: boolean): GenerationModel[] {
  return getAllGenerationModels().filter((m) =>
    hasReferences ? m.kind === "image-edit" : m.kind === "image-gen"
  );
}

export function getDefaultModelId(hasReferences: boolean): string {
  return hasReferences ? MODELS.imageEdit : MODELS.image;
}
