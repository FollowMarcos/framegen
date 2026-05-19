// Parses theme files in the design.md format (https://designdotmd.directory)
// and maps their semantic color tokens to this app's internal CSS variables.
//
// The format is a markdown file with a YAML frontmatter block. We only parse
// the slice of YAML we care about (top-level metadata + the `colors:` map);
// `typography`, `rounded`, `spacing`, and `components` are ignored — the app
// has its own type scale and component styles. This keeps the parser tiny and
// dependency-free without sacrificing drop-in compatibility for color tokens.

export interface DesignMd {
  name: string;
  description: string;
  version?: string;
  colors: Record<string, string>;
}

export interface Theme {
  id: string;
  name: string;
  description: string;
  type: "dark" | "light";
  source?: string;
  vars: Record<string, string>;
}

// ---- frontmatter parsing -------------------------------------------------

const FRONTMATTER_RE = /^---\r?\n([\s\S]*?)\r?\n---/;

export function parseDesignMd(src: string): DesignMd {
  const match = src.match(FRONTMATTER_RE);
  if (!match) throw new Error("design.md: missing YAML frontmatter");

  const top: Record<string, string> = {};
  const colors: Record<string, string> = {};

  let inColors = false;
  let colorsIndent = -1;

  for (const raw of match[1].split(/\r?\n/)) {
    if (!raw.trim() || raw.trim().startsWith("#")) continue;
    const indent = raw.length - raw.trimStart().length;
    const line = raw.trimStart();

    if (inColors) {
      if (indent <= colorsIndent) {
        inColors = false;
      } else {
        const kv = line.match(/^([\w-]+)\s*:\s*(.+?)\s*$/);
        if (kv) colors[kv[1]] = unquote(kv[2]);
        continue;
      }
    }

    if (indent !== 0) continue;
    const kv = line.match(/^([\w-]+)\s*:\s*(.*)$/);
    if (!kv) continue;
    const [, key, val] = kv;
    if (key === "colors") {
      inColors = true;
      colorsIndent = indent;
    } else if (val.trim()) {
      top[key] = unquote(val.trim());
    }
  }

  return {
    name: top.name || "Unnamed",
    description: top.description || "",
    version: top.version,
    colors,
  };
}

function unquote(s: string): string {
  if (
    (s.startsWith('"') && s.endsWith('"')) ||
    (s.startsWith("'") && s.endsWith("'"))
  ) {
    return s.slice(1, -1);
  }
  return s;
}

// ---- color math ----------------------------------------------------------

interface Rgb {
  r: number;
  g: number;
  b: number;
}

function hexToRgb(hex: string): Rgb {
  let h = hex.replace("#", "").trim();
  if (h.length === 3) {
    h = h
      .split("")
      .map((c) => c + c)
      .join("");
  }
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
  };
}

function rgbToHex({ r, g, b }: Rgb): string {
  const x = (n: number): string =>
    Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, "0");
  return `#${x(r)}${x(g)}${x(b)}`;
}

function relativeLuminance({ r, g, b }: Rgb): number {
  const channel = (v: number): number => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

function mix(a: string, b: string, t: number): string {
  const ra = hexToRgb(a);
  const rb = hexToRgb(b);
  return rgbToHex({
    r: ra.r + (rb.r - ra.r) * t,
    g: ra.g + (rb.g - ra.g) * t,
    b: ra.b + (rb.b - ra.b) * t,
  });
}

function withAlpha(hex: string, a: number): string {
  const { r, g, b } = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${a})`;
}

// ---- token mapping -------------------------------------------------------

// Maps design.md's semantic palette (primary/secondary/tertiary/neutral/surface)
// onto our usage-oriented CSS variables. The five required colors are enough
// to derive every variable the app uses; intermediate tints (surface-hover,
// border, fg-dim, etc.) are computed by mixing toward the opposite end of the
// light/dark axis. Pass `on-primary` to override the on-accent foreground.
export function themeFromDesignMd(id: string, src: string): Theme {
  const md = parseDesignMd(src);
  const c = md.colors;

  const primary = c.primary || "#000000";
  const secondary = c.secondary || c.primary || "#666666";
  const tertiary = c.tertiary || c.primary || "#a78bfa";
  const neutral = c.neutral || "#ffffff";
  const surface = c.surface || c.neutral || "#ffffff";

  const isLight = relativeLuminance(hexToRgb(neutral)) > 0.5;
  const type: "dark" | "light" = isLight ? "light" : "dark";

  const accentHover = isLight
    ? mix(tertiary, "#000000", 0.14)
    : mix(tertiary, "#ffffff", 0.18);

  // Use on-primary if provided, else auto-pick based on accent luminance so
  // text on the primary button stays legible regardless of theme contrast.
  const onAccent =
    c["on-primary"] ||
    (relativeLuminance(hexToRgb(tertiary)) > 0.55 ? "#000000" : "#ffffff");

  // `surface` may equal `neutral` in some themes (Pastel Candy does this).
  // When that happens we synthesize a slightly elevated surface so cards and
  // modals don't disappear into the page background.
  const elevated = surface !== neutral ? surface : mix(neutral, primary, 0.04);

  const vars: Record<string, string> = {
    "--color-bg": neutral,
    "--color-bg-elevated": elevated,
    "--color-surface": mix(neutral, primary, isLight ? 0.05 : 0.06),
    "--color-surface-hover": mix(neutral, primary, 0.1),
    "--color-border": mix(neutral, primary, isLight ? 0.12 : 0.14),
    "--color-border-strong": mix(neutral, primary, isLight ? 0.22 : 0.24),
    "--color-fg": primary,
    "--color-fg-dim": mix(primary, neutral, 0.2),
    "--color-muted": secondary,
    "--color-muted-dim": mix(secondary, neutral, 0.45),
    "--color-accent": tertiary,
    "--color-accent-hover": accentHover,
    "--color-accent-dim": withAlpha(tertiary, 0.12),
    "--color-fg-on-accent": onAccent,
    "--color-success": isLight ? "#10b981" : "#34d399",
    "--color-danger": isLight ? "#ef4444" : "#f87171",
  };

  return {
    id,
    name: md.name,
    description: md.description,
    type,
    source: md.version ? `design.md ${md.version}` : "design.md",
    vars,
  };
}
