import "dotenv/config";
import { z } from "zod";

const bool = (def: string) => z.string().default(def).transform((v) => v.trim() === "true" || v.trim() === "1");

// Names follow SPEC.md. JSON_LIMIT is an extra optional knob.
const schema = z.object({
  PORT: z.coerce.number().default(8080),
  CORS_ORIGINS: z.string().default("http://localhost:5173"),
  PUBLIC_API_URL: z.string().default("http://localhost:8080"),
  JSON_LIMIT: z.string().default("1mb"),
  SARVAM_API_KEY: z.string().optional(),
  GEMINI_API_KEY: z.string().optional(),
  GEMINI_API_KEY_BACKUP: z.string().optional(),
  GEMINI_MODEL: z.string().optional(),
  FIREBASE_PROJECT_ID: z.string().default("saathi-f5b30"),
  FIREBASE_CLIENT_EMAIL: z.string().optional(),
  FIREBASE_PRIVATE_KEY: z.string().optional().transform((v) => v?.replace(/\\n/g, "\n")),
  TWILIO_ACCOUNT_SID: z.string().optional(),
  TWILIO_AUTH_TOKEN: z.string().optional(),
  TWILIO_WHATSAPP_FROM: z.string().optional(),
  /**
   * Seeded demo applications carry made-up phone numbers, so they are never messaged.
   * Put YOUR OWN number here (10 digits, joined to the Twilio sandbox) to receive their updates while demonstrating.
   */
  DEMO_WHATSAPP_TO: z.string().optional(),
  NOTIFY_MODE: z.enum(["direct", "off"]).default("direct"),
  MOCK_AI: bool("false"),
  QR_JWT_SECRET: z.string().default("dev-only-secret-change-me"),
  BASELINE_MANUAL_MINUTES: z.coerce.number().default(30),
  /** Retention: days an unfinished application may sit idle before it is deleted. RETENTION=off disables the scheduled cleanup. */
  RETENTION_DAYS: z.coerce.number().default(7),
  RETENTION: z.enum(["on", "off"]).default("on"),
});

export type Env = z.infer<typeof schema>;
export const loadEnv = (src: NodeJS.ProcessEnv = process.env): Env => schema.parse(src);
