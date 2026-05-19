"use client";

import { useEffect, useState } from "react";
import { Download, Info, Loader2, Plus, Trash2 } from "lucide-react";
import { Button, Field, NumberInput, Select, TextArea, TextInput } from "@/components/fields";
import { cn } from "@/lib/utils";
import {
  CUSTOM_MODEL_KIND_LABELS,
  CUSTOM_MODEL_KIND_NOTES,
  type CustomModel,
  type CustomModelKind,
  addCustomModel,
  listCustomModels,
  removeCustomModel,
} from "@/lib/customModels";
import { fetchPrices } from "@/lib/pricingApi";

const KINDS: CustomModelKind[] = ["upscale", "image-gen", "image-edit", "video"];

export function ModelsSection() {
  const [models, setModels] = useState<CustomModel[]>([]);
  const [adding, setAdding] = useState(false);

  function refresh() {
    setModels(listCustomModels());
  }

  useEffect(refresh, []);

  return (
    <div className="space-y-6">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-[17px] font-semibold tracking-tight">Models</h1>
          <p className="text-[12px] text-[var(--color-muted)] mt-1">
            Built-in models are defined in code. You can register additional fal models here
            without rebuilding — pick the kind, paste the id, fill in pricing.
          </p>
        </div>
        {!adding && (
          <Button size="sm" onClick={() => setAdding(true)}>
            <Plus className="size-3.5" />
            add model
          </Button>
        )}
      </header>

      {adding && (
        <AddModelForm
          onCancel={() => setAdding(false)}
          onSaved={() => {
            setAdding(false);
            refresh();
          }}
        />
      )}

      {KINDS.map((kind) => {
        const list = models.filter((m) => m.kind === kind);
        return (
          <KindGroup
            key={kind}
            kind={kind}
            models={list}
            onRemove={(id) => {
              removeCustomModel(id);
              refresh();
            }}
          />
        );
      })}
    </div>
  );
}

function KindGroup({
  kind,
  models,
  onRemove,
}: {
  kind: CustomModelKind;
  models: CustomModel[];
  onRemove: (id: string) => void;
}) {
  return (
    <section>
      <div className="flex items-baseline justify-between mb-1.5">
        <h2 className="text-[12px] font-semibold tracking-tight">{CUSTOM_MODEL_KIND_LABELS[kind]}</h2>
        <span className="text-[10px] text-[var(--color-muted-dim)]">{models.length} custom</span>
      </div>
      <div className="flex items-start gap-2 text-[11px] text-[var(--color-muted)] mb-3 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2">
        <Info className="size-3.5 text-[var(--color-muted)] shrink-0 mt-0.5" />
        <p className="leading-snug">{CUSTOM_MODEL_KIND_NOTES[kind]}</p>
      </div>

      {models.length === 0 ? (
        <p className="text-[11px] text-[var(--color-muted-dim)] italic">none yet</p>
      ) : (
        <ul className="space-y-1.5">
          {models.map((m) => (
            <li
              key={m.id}
              className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] p-2.5 flex items-start gap-2"
            >
              <div className="flex-1 min-w-0">
                <div className="text-[12px] font-medium text-[var(--color-fg)]">{m.name}</div>
                <div className="text-[10px] font-mono text-[var(--color-muted)] truncate">{m.id}</div>
                <div className="text-[11px] text-[var(--color-muted)] mt-1 leading-snug">{m.description}</div>
                <div className="text-[10px] font-mono text-[var(--color-muted-dim)] mt-1">
                  {m.pricing.kind === "per_mp"
                    ? `$${m.pricing.usdPerMP.toFixed(3)} / megapixel`
                    : `$${m.pricing.usdPerSecond.toFixed(5)} / sec · ~${m.pricing.estimateSeconds}s`}
                </div>
              </div>
              <button
                onClick={() => onRemove(m.id)}
                className="size-6 grid place-items-center rounded text-[var(--color-muted)] hover:text-[var(--color-danger)] hover:bg-[var(--color-surface)] shrink-0 transition"
                aria-label="remove"
                title="remove"
              >
                <Trash2 className="size-3" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function AddModelForm({ onCancel, onSaved }: { onCancel: () => void; onSaved: () => void }) {
  const [kind, setKind] = useState<CustomModelKind>("upscale");
  const [id, setId] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [pricingKind, setPricingKind] = useState<"per_mp" | "per_second">("per_mp");
  const [pricePerMP, setPricePerMP] = useState(0.03);
  const [pricePerSec, setPricePerSec] = useState(0.001);
  const [estSec, setEstSec] = useState(10);
  const [error, setError] = useState<string | null>(null);
  const [fetchingPrice, setFetchingPrice] = useState(false);
  const [priceFetchHint, setPriceFetchHint] = useState<string | null>(null);

  // Pulls the model's published unit_price + unit from fal and pre-fills the
  // pricing inputs. The user can override before saving.
  async function autoFetchPrice() {
    const trimmed = id.trim();
    if (!trimmed) {
      setPriceFetchHint("paste a fal model id first");
      return;
    }
    setFetchingPrice(true);
    setPriceFetchHint(null);
    try {
      const m = await fetchPrices([trimmed]);
      const p = m.get(trimmed);
      if (!p) {
        setPriceFetchHint("fal didn't return pricing for that id");
        return;
      }
      if (p.unit === "megapixel") {
        setPricingKind("per_mp");
        setPricePerMP(p.unit_price);
        setPriceFetchHint(`fetched · $${p.unit_price} / megapixel`);
      } else if (p.unit === "image") {
        setPricingKind("per_mp");
        setPricePerMP(p.unit_price);
        setPriceFetchHint(`fetched · $${p.unit_price} / image (stored as per-MP)`);
      } else if (p.unit === "second") {
        setPricingKind("per_second");
        setPricePerSec(p.unit_price);
        setPriceFetchHint(`fetched · $${p.unit_price} / sec`);
      } else {
        setPriceFetchHint(`unsupported unit: ${p.unit} — enter manually`);
      }
    } catch (e) {
      setPriceFetchHint(e instanceof Error ? e.message : "fetch failed");
    } finally {
      setFetchingPrice(false);
    }
  }

  function submit() {
    if (!id.trim() || !name.trim()) {
      setError("id and name are required");
      return;
    }
    try {
      addCustomModel({
        id: id.trim(),
        kind,
        name: name.trim(),
        description: description.trim() || "Custom model.",
        qualityHint: "balanced",
        factor: kind === "upscale" ? { allowed: [2, 4], default: 2 } : undefined,
        pricing:
          pricingKind === "per_mp"
            ? { kind: "per_mp", usdPerMP: pricePerMP }
            : {
                kind: "per_second",
                usdPerSecond: pricePerSec,
                estimateSeconds: estSec,
              },
      });
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : "could not add model");
    }
  }

  return (
    <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-4 space-y-3">
      <div className="text-[12px] font-medium">Add a custom model</div>

      <div className="grid grid-cols-2 gap-3">
        <Field label="kind">
          <Select
            value={kind}
            onChange={(e) => setKind(e.target.value as CustomModelKind)}
            options={KINDS.map((k) => ({ value: k, label: CUSTOM_MODEL_KIND_LABELS[k] }))}
          />
        </Field>
        <Field label="display name">
          <TextInput
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="My Model"
          />
        </Field>
      </div>

      <Field label="fal model id" hint="e.g. fal-ai/some-upscaler">
        <div className="flex items-center gap-2">
          <TextInput
            value={id}
            onChange={(e) => setId(e.target.value)}
            placeholder="fal-ai/…"
          />
          <button
            type="button"
            onClick={autoFetchPrice}
            disabled={fetchingPrice || !id.trim()}
            className="shrink-0 inline-flex items-center gap-1.5 h-8 px-2.5 rounded-md bg-[var(--color-surface)] hover:bg-[var(--color-surface-hover)] border border-[var(--color-border)] hover:border-[var(--color-border-strong)] text-[12px] font-medium text-[var(--color-fg-dim)] hover:text-[var(--color-fg)] disabled:opacity-50 disabled:cursor-not-allowed transition"
            title="fetch this model's published pricing from fal"
          >
            {fetchingPrice ? <Loader2 className="size-3.5 animate-spin" /> : <Download className="size-3.5" />}
            fetch pricing
          </button>
        </div>
        {priceFetchHint && (
          <p className="mt-1 text-[10px] text-[var(--color-muted)] font-mono">{priceFetchHint}</p>
        )}
      </Field>

      <Field label="description">
        <TextArea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="One-line description shown in the picker."
          className="min-h-[60px]"
        />
      </Field>

      <div className="grid grid-cols-3 gap-3">
        <Field label="pricing">
          <Select
            value={pricingKind}
            onChange={(e) => setPricingKind(e.target.value as "per_mp" | "per_second")}
            options={[
              { value: "per_mp", label: "per megapixel" },
              { value: "per_second", label: "per second" },
            ]}
          />
        </Field>
        {pricingKind === "per_mp" ? (
          <Field label="USD / MP">
            <NumberInput
              step="0.001"
              min={0}
              value={pricePerMP}
              onChange={(e) => setPricePerMP(Number(e.target.value) || 0)}
            />
          </Field>
        ) : (
          <>
            <Field label="USD / sec">
              <NumberInput
                step="0.0001"
                min={0}
                value={pricePerSec}
                onChange={(e) => setPricePerSec(Number(e.target.value) || 0)}
              />
            </Field>
            <Field label="typical sec">
              <NumberInput
                step="1"
                min={1}
                value={estSec}
                onChange={(e) =>
                  setEstSec(Math.max(1, Math.round(Number(e.target.value) || 10)))
                }
              />
            </Field>
          </>
        )}
      </div>

      <p
        className={cn(
          "text-[11px] leading-snug rounded-md border px-3 py-2",
          "border-[var(--color-border)] text-[var(--color-muted)] bg-[var(--color-bg-elevated)]"
        )}
      >
        <strong className="text-[var(--color-fg-dim)]">heads up</strong> · {CUSTOM_MODEL_KIND_NOTES[kind]}
      </p>

      {error && <p className="text-[11px] text-[var(--color-danger)]">{error}</p>}

      <div className="flex justify-end gap-2">
        <Button variant="secondary" size="sm" onClick={onCancel}>
          cancel
        </Button>
        <Button size="sm" onClick={submit} disabled={!id.trim() || !name.trim()}>
          save model
        </Button>
      </div>
    </div>
  );
}
