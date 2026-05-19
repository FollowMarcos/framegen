// Published per-image USD prices for the canonical GPT Image 2 sizes.
// Only these exact dimensions have authoritative pricing; everything else
// returns null. We use this purely to estimate the session running total.

type PricedQuality = "low" | "medium" | "high";

const PRICE_USD: Record<string, Record<PricedQuality, number>> = {
  "1024x768":  { low: 0.011, medium: 0.043, high: 0.151 },
  "1024x1024": { low: 0.015, medium: 0.061, high: 0.219 },
  "1024x1536": { low: 0.018, medium: 0.054, high: 0.178 },
  "1920x1080": { low: 0.017, medium: 0.053, high: 0.158 },
  "2560x1440": { low: 0.019, medium: 0.068, high: 0.234 },
  "3840x2160": { low: 0.024, medium: 0.113, high: 0.413 },
};

export function priceForImage(
  width: number | undefined,
  height: number | undefined,
  quality: string | undefined
): number | null {
  if (!width || !height || !quality) return null;
  const row = PRICE_USD[`${width}x${height}`];
  if (!row) return null;
  if (quality === "low" || quality === "medium" || quality === "high") {
    return row[quality];
  }
  return null;
}

export function formatUSD(amount: number): string {
  // Zero gets the compact "$0" rather than "$0.0000" — looks calm in the
  // session-cost chip and reads correctly when the value really is zero.
  if (amount === 0) return "$0";
  if (amount < 0.01) return `$${amount.toFixed(4)}`;
  if (amount < 1) return `$${amount.toFixed(3)}`;
  return `$${amount.toFixed(2)}`;
}
