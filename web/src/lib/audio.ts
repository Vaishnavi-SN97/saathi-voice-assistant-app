import { useSyncExternalStore } from "react";
import { absUrl } from "./api";

/* ==========================================================================
   Playback
   Mobile browsers (iOS Safari above all) only let a page play sound from an
   <audio> element that the person has already started once, inside a real tap.
   Fetching the sentence from /tts is an await, and by the time it resolves the
   tap is over, so a freshly created Audio() is refused and the app goes silent.
   The cure: ONE element, started during the first tap with a silent clip. After
   that it may be given new sources and played at any time.
   ========================================================================== */

/** 0.05 s of silence: starting this inside a tap is what unlocks the element. */
const SILENCE =
  "data:audio/wav;base64,UklGRkQDAABXQVZFZm10IBAAAAABAAEAQB8AAIA+AAACABAAZGF0YSADAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA==";

let element: HTMLAudioElement | null = null;
let unlocked = false;

const audioElement = () => (element ??= Object.assign(new Audio(), { preload: "auto" as const }));

/** Thrown when the browser refuses to play without a fresh tap. */
export class AudioBlockedError extends Error {
  constructor() {
    super("The browser blocked audio until the person taps the page");
  }
}

/** Start the shared element inside a user gesture so later playback is allowed. Safe to call repeatedly. */
export function unlockAudio(): void {
  if (unlocked) return;
  const a = audioElement();
  a.src = SILENCE;
  a.muted = true;
  a.play()
    .then(() => {
      a.pause();
      a.currentTime = 0;
      a.muted = false;
      unlocked = true;
      stopListening();
    })
    .catch(() => {
      a.muted = false; // not a tap after all; try again on the next one
    });
}

const EVENTS = ["pointerdown", "touchend", "click", "keydown"] as const;
const onFirstTap = () => unlockAudio();
function stopListening() {
  for (const ev of EVENTS) document.removeEventListener(ev, onFirstTap, true);
}
if (typeof document !== "undefined") {
  for (const ev of EVENTS) document.addEventListener(ev, onFirstTap, true);
}

/* ---------- what is waiting to be heard ---------- */

export interface PendingAudio { url: string; text: string }
let pending: PendingAudio | null = null;
const watchers = new Set<() => void>();
const announce = () => watchers.forEach((w) => w());

const subscribe = (w: () => void) => { watchers.add(w); return () => void watchers.delete(w); };

/** The sentence the browser refused to play, so a screen can offer a Replay button next to the text. */
export const useBlockedAudio = (): PendingAudio | null => useSyncExternalStore(subscribe, () => pending, () => null);

export function clearBlockedAudio() {
  if (!pending) return;
  pending = null;
  announce();
}

export function stopAudio() {
  if (element) {
    element.pause();
    element.src = "";
  }
}

/**
 * Plays server audio on the shared element. Resolves when it ends.
 * Throws AudioBlockedError if the browser refuses; the sentence is then remembered for a Replay button.
 */
export function playUrl(url: string, text = ""): Promise<void> {
  const a = audioElement();
  a.pause();
  a.src = absUrl(url);
  a.currentTime = 0;
  return new Promise<void>((resolve, reject) => {
    a.onended = () => resolve();
    a.onerror = () => reject(new Error("audio failed to load"));
    a.play()
      .then(() => {
        if (pending) clearBlockedAudio();
        unlocked = true;
      })
      .catch((e: unknown) => {
        if (e instanceof DOMException && e.name === "NotAllowedError") {
          pending = { url, text };
          announce();
          reject(new AudioBlockedError());
        } else reject(e as Error);
      });
  });
}

/** Replay from a button press (a real gesture), which also unlocks the element for later. */
export async function replayBlocked(): Promise<void> {
  const item = pending;
  if (!item) return;
  clearBlockedAudio();
  await playUrl(item.url, item.text).catch(() => undefined);
}

/* ==========================================================================
   Recording (microphone)
   ========================================================================== */

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
