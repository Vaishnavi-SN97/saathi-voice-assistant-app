import { Router } from "express";
import type { Ctx } from "../app.js";
import { AppError } from "../errors.js";

export const filesRouter = ({ store, files }: Ctx) =>
  Router().get("/:appId/:kind", async (req, res, next) => {
    try {
      const appId = String(req.params.appId), kind = String(req.params.kind);
      const app = await store.get(`applications/${appId}`);
      if (!app) throw new AppError(404, "not_found", "Application not found");
      const u = req.user!;
      if (u.role !== "banker" && app.ownerUid !== u.uid) throw new AppError(403, "forbidden", "Not your application");
      const f = await files.get(appId, kind);
      if (!f) throw new AppError(404, "not_found", "File not found");
      res.type(f.mime).set("Cache-Control", "private, no-store").send(f.data);
    } catch (e) { next(e); }
  });
