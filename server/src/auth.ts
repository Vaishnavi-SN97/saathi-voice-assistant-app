import type { NextFunction, Request, Response } from "express";
import { AppError } from "./errors.js";

export type Role = "customer" | "banker";
export interface AuthUser { uid: string; role: Role; anonymous: boolean }
export type TokenVerifier = (idToken: string) => Promise<AuthUser>;

declare global {
  namespace Express {
    interface Request { user?: AuthUser }
  }
}

export const requireAuth = (verify: TokenVerifier) => async (req: Request, _res: Response, next: NextFunction) => {
  try {
    const m = /^Bearer (.+)$/.exec(req.header("authorization") ?? "");
    if (!m) throw new AppError(401, "unauthenticated", "Missing bearer token");
    try {
      req.user = await verify(m[1]);
    } catch {
      throw new AppError(401, "unauthenticated", "Invalid token");
    }
    next();
  } catch (e) {
    next(e);
  }
};

export const requireRole = (role: Role) => (req: Request, _res: Response, next: NextFunction) =>
  req.user?.role === role ? next() : next(new AppError(403, "forbidden", `Requires role ${role}`));
