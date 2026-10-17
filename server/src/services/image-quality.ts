import sharp from "sharp";

/** Variance of the Laplacian on a 640 px greyscale copy: low = blurry. */
export async function laplacianVariance(img: Buffer): Promise<number> {
  const { data } = await sharp(img)
    .rotate()
    .resize({ width: 640, withoutEnlargement: true })
    .grayscale()
    .convolve({ width: 3, height: 3, kernel: [0, 1, 0, 1, -4, 1, 0, 1, 0], scale: 1, offset: 128 })
    .raw()
    .toBuffer({ resolveWithObject: true });
  let sum = 0, sumSq = 0;
  for (const v of data) { const d = v - 128; sum += d; sumSq += d * d; }
  const n = data.length;
  return sumSq / n - (sum / n) ** 2;
}

/** Server-side backstop; the phone also checks before uploading (P8). */
export const BLUR_THRESHOLD = 12;
export const isBlurry = async (img: Buffer) => (await laplacianVariance(img)) < BLUR_THRESHOLD;
