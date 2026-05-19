import type { Aspect } from "./aspects";

// Renders the source image into a fresh canvas. Two modes:
//   - Fixed aspect: cover-fit into the preset's width × height,
//     centring the crop on the long edge.
//   - Original aspect: render at the image's natural dimensions
//     with no crop — the default, and what most users expect for
//     "post this generation as-is".
//
// In both cases the CSS filter is baked into the pixels via
// ctx.filter, so the downloaded PNG matches the preview byte-for-byte.
export async function renderPostBlob({
  imageUrl,
  aspect,
  filter,
  type = "image/png",
}: {
  imageUrl: string;
  aspect: Aspect;
  filter: string;
  type?: "image/png" | "image/jpeg";
}): Promise<Blob> {
  const img = await loadImage(imageUrl);

  const targetW = aspect.width ?? img.naturalWidth;
  const targetH = aspect.height ?? img.naturalHeight;

  const canvas = document.createElement("canvas");
  canvas.width = targetW;
  canvas.height = targetH;

  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas 2d context unavailable");

  // ctx.filter is the standardised way to bake CSS filter strings
  // into a draw call. Broadly supported (Chrome / Firefox / Safari).
  // "none" no-ops, so we can pass it through unconditionally.
  ctx.filter = filter;

  if (!aspect.width || !aspect.height) {
    // Original mode — draw the image 1:1 with no crop.
    ctx.drawImage(img, 0, 0, targetW, targetH);
  } else {
    // Cover-fit: pick the scale so the image fills the target box,
    // then offset to centre the cropped portion. Mirrors CSS
    // object-fit: cover so the modal preview and the rendered
    // output stay aligned.
    const scale = Math.max(targetW / img.naturalWidth, targetH / img.naturalHeight);
    const drawW = img.naturalWidth * scale;
    const drawH = img.naturalHeight * scale;
    const dx = (targetW - drawW) / 2;
    const dy = (targetH - drawH) / 2;
    ctx.drawImage(img, dx, dy, drawW, drawH);
  }

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (b) => {
        if (b) resolve(b);
        else reject(new Error("canvas.toBlob returned null"));
      },
      type,
      type === "image/jpeg" ? 0.92 : undefined
    );
  });
}

// Triggers a browser download from a Blob — used by the modal's
// "Download" button.
export function downloadBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Revoke after a tick so the click handler is done with the URL.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// Returns true if the current browser exposes the Web Share API with
// file support. Plain `navigator.share` exists on iOS/Android but not
// always with files; `canShare` lets us check first so the button can
// hide on platforms where sharing a file would silently fail.
export function canShareFiles(): boolean {
  if (typeof navigator === "undefined") return false;
  if (!("share" in navigator)) return false;
  if (typeof navigator.canShare !== "function") return false;
  try {
    return navigator.canShare({
      files: [new File([new Blob()], "probe.png", { type: "image/png" })],
    });
  } catch {
    return false;
  }
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new window.Image();
    // Same-origin so toBlob doesn't get tainted by a cross-origin
    // pixel. Generations and uploads both live under /generations/...
    // on the same host, so this never actually hits a CORS preflight
    // in the current app.
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`failed to load ${url}`));
    img.src = url;
  });
}
