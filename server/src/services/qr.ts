import { randomUUID } from "node:crypto";
import jwt from "jsonwebtoken";
import QRCode from "qrcode";
import { AppError } from "../errors.js";

export const QR_TTL_DAYS = 3;

export interface QrIssue { token: string; jti: string; expiresAt: string; png: Buffer }

/** SPEC: JWT {aid, jti} HS256 with QR_JWT_SECRET, 3-day expiry, QR image via qrcode. The QR encodes the token. */
export async function issueQr(secret: string, appId: string): Promise<QrIssue> {
  const jti = randomUUID();
  const token = jwt.sign({ aid: appId, typ: "qr" }, secret, { algorithm: "HS256", expiresIn: `${QR_TTL_DAYS}d`, jwtid: jti });
  const { exp } = jwt.decode(token) as { exp: number };
  const png = await QRCode.toBuffer(token, { type: "png", width: 480, margin: 2, errorCorrectionLevel: "M" });
  return { token, jti, expiresAt: new Date(exp * 1000).toISOString(), png };
}

export function verifyQrToken(secret: string, token: string): { aid: string; jti: string } {
  try {
    const p = jwt.verify(token, secret, { algorithms: ["HS256"] }) as { aid?: string; jti?: string; typ?: string };
    if (p.typ !== "qr" || !p.aid || !p.jti) throw new Error("not a QR token");
    return { aid: p.aid, jti: p.jti };
  } catch (e) {
    const expired = (e as Error).name === "TokenExpiredError";
    throw new AppError(expired ? 410 : 401, expired ? "qr_expired" : "qr_invalid", expired ? "This QR code has expired" : "Invalid QR code");
  }
}
