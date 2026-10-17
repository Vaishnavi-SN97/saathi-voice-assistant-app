import "dotenv/config";
import { z } from "zod";

const schema = z.object({
  PORT: z.coerce.number().default(3001),
  CORS_ORIGINS: z.string().default("http://localhost:5173,http://localhost:8443"),
  JSON_LIMIT: z.string().default("1mb"),
  MOCK_AI: z.string().default("true").transform((v) => v === "true" || v === "1"),
  JWT_SECRET: z.string().default("dev-only-secret-change-me"),
  FIREBASE_PROJECT_ID: z.string().optional(),
  FIREBASE_SERVICE_ACCOUNT_JSON: z.string().optional(),
  GEMINI_API_KEY: z.string().optional(),
  SARVAM_API_KEY: z.string().optional(),
});

export type Env = z.infer<typeof schema>;
export const loadEnv = (src: NodeJS.ProcessEnv = process.env): Env => schema.parse(src);
