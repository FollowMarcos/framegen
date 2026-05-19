import type { AdjustmentStack } from "./types";

// Builds a CSS `filter` string that approximates the adjustment stack for
// the live canvas preview. CSS filters cover ~70% of the lightroom basics
// out of the box; the high-fidelity version (curves-quality highlights /
// shadows) would need a WebGL shader pass and is deliberately deferred —
// the v1 contract is that what you see at export time matches what
// stage.toDataURL() captured, so the same CSS filter is baked into the
// flattened PNG and there's no preview/export drift.
//
// Mapping rationale:
//   exposure   → brightness (1 + x), x ∈ [-1, 1] → 0..2
//   contrast   → contrast   (1 + x)
//   saturation → saturate   (1 + x)
//   vibrance   → folded into saturate at half weight (CSS has no
//                vibrance — saturate at lower amplitude is the closest
//                cheap approximation; users get a usable knob without us
//                pretending to ship real vibrance)
//   temperature/tint → hue-rotate; warm = +deg, cool = -deg (rough but
//                directionally correct for the casual "warmer / cooler"
//                use case)
//   highlights/shadows → small contrast nudge; not a true tone curve.
//   sharpen    → handled separately via a Konva filter on the node, since
//                CSS has no convolution filter.
export function buildCssFilter(adj: AdjustmentStack): string {
  const parts: string[] = [];

  const brightness = 1 + adj.exposure;
  if (brightness !== 1) parts.push(`brightness(${brightness.toFixed(3)})`);

  // Highlights brighten the top end, shadows lift the bottom; both nudge
  // contrast slightly to give the user feedback that the slider does
  // something. Approximation only.
  const contrast = 1 + adj.contrast + adj.highlights * 0.2 - adj.shadows * 0.2;
  if (contrast !== 1) parts.push(`contrast(${contrast.toFixed(3)})`);

  const saturate = 1 + adj.saturation + adj.vibrance * 0.5;
  if (saturate !== 1) parts.push(`saturate(${saturate.toFixed(3)})`);

  const hueDeg = adj.temperature * 20 + adj.tint * 20;
  if (hueDeg !== 0) parts.push(`hue-rotate(${hueDeg.toFixed(1)}deg)`);

  return parts.join(" ") || "none";
}

// True if the stack has any visible effect — used to skip filter work in
// the canvas when the user hasn't touched anything yet.
export function isIdentity(adj: AdjustmentStack): boolean {
  return (
    adj.exposure === 0 &&
    adj.contrast === 0 &&
    adj.highlights === 0 &&
    adj.shadows === 0 &&
    adj.saturation === 0 &&
    adj.vibrance === 0 &&
    adj.temperature === 0 &&
    adj.tint === 0 &&
    adj.sharpen === 0 &&
    adj.rotate === 0
  );
}
