import { randomUUID } from "node:crypto";
import { readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import ffmpeg from "fluent-ffmpeg";
import ffmpegPath from "ffmpeg-static";
import { AppError } from "../errors.js";

if (ffmpegPath) ffmpeg.setFfmpegPath(ffmpegPath);

/** Convert any audio format ffmpeg understands to 16 kHz mono 16-bit PCM WAV. */
export async function toWav16kMono(input: Buffer): Promise<Buffer> {
  const id = randomUUID();
  const inPath = join(tmpdir(), `saathi-${id}.in`);
  const outPath = join(tmpdir(), `saathi-${id}.wav`);
  await writeFile(inPath, input);
  try {
    await new Promise<void>((resolve, reject) =>
      ffmpeg(inPath).audioChannels(1).audioFrequency(16000).audioCodec("pcm_s16le").format("wav")
        .on("error", reject).on("end", () => resolve()).save(outPath),
    );
    return await readFile(outPath);
  } catch {
    throw new AppError(415, "bad_audio", "Could not decode audio");
  } finally {
    await Promise.all([rm(inPath, { force: true }), rm(outPath, { force: true })]);
  }
}
