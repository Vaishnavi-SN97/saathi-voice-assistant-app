import { absUrl } from "./api";

let current: HTMLAudioElement | null = null;

export function stopAudio() {
  if (current) {
    current.pause();
    current = null;
  }
}

/** Plays server audio (resolves when it ends). Rejects if the browser blocks autoplay or the file fails. */
export function playUrl(url: string): Promise<void> {
  stopAudio();
  const audio = new Audio(absUrl(url));
  current = audio;
  return new Promise((resolve, reject) => {
    audio.onended = () => resolve();
    audio.onerror = () => reject(new Error("audio failed"));
    audio.play().catch(reject);
  });
}

export interface RecordingHandle {
  /** Stop early (tap to stop). */
  stop: () => void;
  /** Resolves with the audio once stopped (by tap or by the time limit). */
  done: Promise<Blob>;
}

export const canRecord = () => typeof navigator !== "undefined" && !!navigator.mediaDevices?.getUserMedia && typeof MediaRecorder !== "undefined";

/**
 * MediaRecorder with a live level meter and a hard time limit.
 * Throws if the microphone is blocked or unavailable.
 */
export async function startRecording(opts: { maxMs: number; onLevel: (level: number) => void; onTick: (elapsedMs: number) => void }): Promise<RecordingHandle> {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
  const recorder = new MediaRecorder(stream);
  const chunks: Blob[] = [];
  recorder.ondataavailable = (e) => e.data.size && chunks.push(e.data);

  // Level meter: RMS of the time-domain signal, 0..1
  const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  const ac = new Ctx();
  const analyser = ac.createAnalyser();
  analyser.fftSize = 512;
  ac.createMediaStreamSource(stream).connect(analyser);
  const buf = new Uint8Array(analyser.fftSize);

  const started = performance.now();
  let raf = 0;
  const loop = () => {
    analyser.getByteTimeDomainData(buf);
    let sum = 0;
    for (const v of buf) sum += ((v - 128) / 128) ** 2;
    opts.onLevel(Math.min(1, Math.sqrt(sum / buf.length) * 4));
    opts.onTick(performance.now() - started);
    raf = requestAnimationFrame(loop);
  };
  raf = requestAnimationFrame(loop);

  let finish: (b: Blob) => void;
  const done = new Promise<Blob>((r) => (finish = r));
  const timer = window.setTimeout(() => stop(), opts.maxMs);

  function stop() {
    if (recorder.state === "inactive") return;
    recorder.stop();
  }
  recorder.onstop = () => {
    window.clearTimeout(timer);
    cancelAnimationFrame(raf);
    opts.onLevel(0);
    stream.getTracks().forEach((t) => t.stop());
    void ac.close();
    finish(new Blob(chunks, { type: recorder.mimeType || "audio/webm" }));
  };
  recorder.start();
  return { stop, done };
}

/** File extension for the multipart upload (the server converts any format with ffmpeg). */
export const audioExt = (mime: string) => (mime.includes("mp4") ? "m4a" : mime.includes("ogg") ? "ogg" : mime.includes("wav") ? "wav" : "webm");
