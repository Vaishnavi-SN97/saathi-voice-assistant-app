import { Router } from "express";
import type { Ctx } from "../app.js";
import { AppError } from "../errors.js";

export const mediaRouter = ({ media }: Ctx) =>
  Router().get("/:id", async (req, res, next) => {
    try {
      const id = String(req.params.id);
      if (!media.verifyToken(id, String(req.query.token ?? ""))) throw new AppError(401, "bad_media_token", "Invalid or expired token");
      const m = await media.get(id);
      if (!m) throw new AppError(404, "not_found", "Media not found");
      res.type(m.mime).set("Cache-Control", "private, max-age=3600").send(m.data);
    } catch (e) { next(e); }
  });
