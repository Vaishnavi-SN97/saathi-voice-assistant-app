/**
 * On-phone blur check: variance of the Laplacian of a greyscale copy scaled to 640 px wide.
 * Below BLUR_THRESHOLD a photo is judged blurry (a warning, never a hard block).
 *
 * Calibrate with real phone photos: open the camera screen with ?debug=1 to see each photo's measured value.
 * The server measures the same way (server/src/services/image-quality.ts, its own BLUR_THRESHOLD, shown in debug too).
 * The sharp fake demo cards measure ~1500 and a heavy blur ~3.
 */
export const BLUR_THRESHOLD = 12;

const WIDTH = 640;

export function laplacianVariance(img: ImageBitmap): number {
  const scale = Math.min(1, WIDTH / img.width);
  const w = Math.max(3, Math.round(img.width * scale));
  const h = Math.max(3, Math.round(img.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return Infinity; // cannot measure: treat as sharp
  ctx.drawImage(img, 0, 0, w, h);
  const { data } = ctx.getImageData(0, 0, w, h);

  const g = new Float32Array(w * h);
  for (let i = 0; i < g.length; i++) g[i] = 0.299 * data[i * 4] + 0.587 * data[i * 4 + 1] + 0.114 * data[i * 4 + 2];

  let sum = 0, sumSq = 0, n = 0;
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      const lap = g[i - w] + g[i + w] + g[i - 1] + g[i + 1] - 4 * g[i];
      sum += lap;
      sumSq += lap * lap;
      n++;
    }
  }
  const mean = sum / n;
  return sumSq / n - mean * mean;
}

export const isBlurry = (variance: number) => variance < BLUR_THRESHOLD;
