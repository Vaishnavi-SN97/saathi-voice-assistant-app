import type { ErrorRequestHandler } from "express";
import { ZodError } from "zod";

export class AppError extends Error {
  constructor(public status: number, public code: string, message?: string) {
    super(message ?? code);
  }
}

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof AppError) return void res.status(err.status).json({ error: err.message, code: err.code });
  if (err instanceof ZodError) return void res.status(400).json({ error: "Invalid request", code: "bad_request" });
  if (err?.code === "LIMIT_FILE_SIZE") return void res.status(413).json({ error: "File too large", code: "too_large" });
  if (err?.name === "MulterError") return void res.status(400).json({ error: "Bad upload", code: "bad_upload" });
  if (err?.type === "entity.too.large") return void res.status(413).json({ error: "Payload too large", code: "too_large" });
  console.error(err);
  res.status(500).json({ error: "Internal error", code: "internal" });
};
