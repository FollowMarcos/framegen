"use client";

import { cn } from "@/lib/utils";
import { ChevronDown } from "lucide-react";

export const QUALITIES = [
  { value: "high", label: "high" },
  { value: "medium", label: "medium" },
  { value: "low", label: "low" },
  { value: "auto", label: "auto" },
];

export const OUTPUT_FORMATS = [
  { value: "png", label: "png" },
  { value: "jpeg", label: "jpeg" },
  { value: "webp", label: "webp" },
];

export function Section({
  title,
  children,
  hint,
}: {
  title?: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-3">
      {title && (
        <div className="flex items-baseline justify-between">
          <h3 className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--color-muted)]">
            {title}
          </h3>
          {hint && <span className="text-[10px] text-[var(--color-muted-dim)]">{hint}</span>}
        </div>
      )}
      {children}
    </section>
  );
}

export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <div className="flex items-baseline justify-between mb-1.5">
        <span className="text-[11px] font-medium text-[var(--color-fg-dim)]">{label}</span>
        {hint && <span className="text-[10px] text-[var(--color-muted-dim)]">{hint}</span>}
      </div>
      {children}
    </label>
  );
}

const inputBase =
  "w-full rounded-md bg-[var(--color-surface)] border border-[var(--color-border)] px-2.5 py-1.5 text-[13px] text-[var(--color-fg)] placeholder:text-[var(--color-muted-dim)] outline-none transition-colors hover:border-[var(--color-border-strong)]";

export function TextArea({
  ref,
  className,
  ...rest
}: React.TextareaHTMLAttributes<HTMLTextAreaElement> & {
  ref?: React.Ref<HTMLTextAreaElement>;
}) {
  return (
    <textarea
      ref={ref}
      {...rest}
      className={cn(inputBase, "min-h-24 leading-relaxed resize-y py-2", className)}
    />
  );
}

export function TextInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={cn(inputBase, props.className)} />;
}

export function Select(
  props: React.SelectHTMLAttributes<HTMLSelectElement> & {
    options: { value: string; label: string }[] | readonly { value: string; label: string }[];
  }
) {
  const { options, className, ...rest } = props;
  return (
    <div className="relative">
      <select
        {...rest}
        className={cn(inputBase, "appearance-none pr-8 cursor-pointer", className)}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 size-3.5 text-[var(--color-muted)]" />
    </div>
  );
}

export function NumberInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      type="number"
      {...props}
      className={cn(inputBase, "[appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none", props.className)}
    />
  );
}

export function Stepper({
  value,
  onChange,
  min = 1,
  max = 4,
}: {
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
}) {
  return (
    <div className="inline-flex items-stretch rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] overflow-hidden">
      <button
        type="button"
        onClick={() => onChange(Math.max(min, value - 1))}
        disabled={value <= min}
        className="w-7 text-[13px] text-[var(--color-muted)] hover:text-[var(--color-fg)] hover:bg-[var(--color-surface-hover)] disabled:opacity-30 disabled:cursor-not-allowed transition"
      >
        −
      </button>
      <div className="w-8 grid place-items-center text-[13px] font-mono tabular-nums border-x border-[var(--color-border)]">
        {value}
      </div>
      <button
        type="button"
        onClick={() => onChange(Math.min(max, value + 1))}
        disabled={value >= max}
        className="w-7 text-[13px] text-[var(--color-muted)] hover:text-[var(--color-fg)] hover:bg-[var(--color-surface-hover)] disabled:opacity-30 disabled:cursor-not-allowed transition"
      >
        +
      </button>
    </div>
  );
}

export function Button({
  loading,
  variant = "primary",
  size = "md",
  children,
  className,
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  loading?: boolean;
  variant?: "primary" | "secondary" | "ghost";
  size?: "sm" | "md";
}) {
  // Coerce to a real boolean. Without this, `loading || rest.disabled` can
  // evaluate to undefined/null which React renders as a missing attribute —
  // and form-filler browser extensions sometimes inject `disabled` themselves
  // between SSR and hydration, producing a noisy mismatch.
  const isDisabled = Boolean(loading || rest.disabled);
  const base = "inline-flex items-center justify-center gap-1.5 rounded-md font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed";
  const sizes = {
    sm: "h-7 px-2.5 text-[12px]",
    md: "h-9 px-4 text-[13px]",
  };
  const variants = {
    primary: [
      "bg-[var(--color-accent)] text-[var(--color-fg-on-accent)]",
      "hover:bg-[var(--color-accent-hover)] hover:text-[var(--color-fg-on-accent)]",
      "active:bg-[var(--color-accent)] active:text-[var(--color-fg-on-accent)]",
    ].join(" "),
    secondary:
      "bg-[var(--color-surface)] text-[var(--color-fg)] border border-[var(--color-border)] hover:bg-[var(--color-surface-hover)] hover:border-[var(--color-border-strong)]",
    ghost:
      "text-[var(--color-muted)] hover:text-[var(--color-fg)] hover:bg-[var(--color-surface)]",
  };
  return (
    <button
      {...rest}
      disabled={isDisabled}
      suppressHydrationWarning
      className={cn(base, sizes[size], variants[variant], className)}
    >
      {loading ? (
        <>
          <span className="size-1.5 rounded-full bg-current animate-pulse" />
          working
        </>
      ) : (
        children
      )}
    </button>
  );
}

export function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="inline-flex items-center px-1 h-4 rounded text-[10px] font-mono text-[var(--color-muted)] bg-[var(--color-bg)] border border-[var(--color-border)]">
      {children}
    </kbd>
  );
}
