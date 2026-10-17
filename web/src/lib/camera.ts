export type CameraFailure = "denied" | "unsupported" | "unavailable";

export class CameraError extends Error {
  constructor(public reason: CameraFailure) {
    super(reason);
  }
}

/** Rear camera if there is one. Needs https (or localhost); otherwise the file picker is the way in. */
export async function openCamera(): Promise<MediaStream> {
  if (!navigator.mediaDevices?.getUserMedia) throw new CameraError("unsupported");
  try {
    return await navigator.mediaDevices.getUserMedia({
      video: { facingMode: { ideal: "environment" }, width: { ideal: 1920 }, height: { ideal: 1080 } },
      audio: false,
    });
  } catch (e) {
    const name = (e as DOMException).name;
    throw new CameraError(name === "NotAllowedError" || name === "SecurityError" ? "denied" : "unavailable");
  }
}

export const stopStream = (s: MediaStream | null) => s?.getTracks().forEach((t) => t.stop());

export const bitmapFromVideo = (v: HTMLVideoElement) => createImageBitmap(v);
export const bitmapFromFile = (f: Blob) => createImageBitmap(f);

/** Re-encode as JPEG (long side <= maxSide) so uploads stay small and always in a format the server reads. */
export function toJpeg(img: ImageBitmap, maxSide = 1920, quality = 0.9): Promise<Blob> {
  const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(img.width * scale);
  canvas.height = Math.round(img.height * scale);
  canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("encode failed"))), "image/jpeg", quality),
  );
}
