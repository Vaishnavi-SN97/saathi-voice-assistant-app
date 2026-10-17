// Builds production env files from your local ones, WITHOUT printing any value, ready to paste into the hosts.
//   npm run prod-env -- --api https://your-api.up.railway.app --web https://your-app.vercel.app
// Writes (both are git-ignored):
//   server/.env.production   -> Railway: service > Variables > RAW Editor > paste the whole file
//   web/.env.production      -> Vercel:  project > Settings > Environment Variables > paste the whole file into the first field
// Changes made on top of your local files: MOCK_AI=false, PUBLIC_API_URL / CORS_ORIGINS / VITE_API_URL from the arguments,
// NOTIFY_MODE kept, QR_JWT_SECRET generated if you do not have one. Everything else is copied as is.
import { randomBytes } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const arg = (name) => { const i = process.argv.indexOf(`--${name}`); return i > 0 ? process.argv[i + 1] : undefined; };
const api = arg("api")?.replace(/\/$/, ""), web = arg("web")?.replace(/\/$/, "");
if (!api || !web || !/^https:\/\//.test(api) || !/^https:\/\//.test(web)) {
  console.error("Usage: npm run prod-env -- --api https://your-api-host --web https://your-web-host   (both must be https)");
  process.exit(2);
}

function read(file) {
  const out = new Map();
  if (!existsSync(file)) return out;
  for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)$/.exec(line);
    if (m && !out.has(m[1])) out.set(m[1], m[2].trim());
  }
  return out;
}
const write = (file, map) => writeFileSync(file, [...map].map(([k, v]) => `${k}=${v}`).join("\n") + "\n");

const server = read(join(root, "server", ".env"));
if (!server.size) { console.error("server/.env not found: nothing to build from."); process.exit(1); }
const notes = [];
const set = (map, k, v, why) => { map.set(k, v); notes.push(`${k}: ${why}`); };

set(server, "MOCK_AI", "false", "real Sarvam + Gemini");
set(server, "PUBLIC_API_URL", api, "from --api");
set(server, "CORS_ORIGINS", web, "from --web");
if (!server.get("QR_JWT_SECRET")) set(server, "QR_JWT_SECRET", randomBytes(32).toString("hex"), "generated (it did not exist)");
server.delete("PORT"); // the host sets PORT itself
write(join(root, "server", ".env.production"), server);

const webEnv = read(join(root, "web", ".env"));
set(webEnv, "VITE_API_URL", api, "from --api");
write(join(root, "web", ".env.production"), webEnv);

const missingServer = ["SARVAM_API_KEY", "GEMINI_API_KEY", "FIREBASE_CLIENT_EMAIL", "FIREBASE_PRIVATE_KEY", "QR_JWT_SECRET"].filter((k) => !(server.get(k) ?? "").replace(/^["']|["']$/g, ""));
const missingWeb = ["VITE_FIREBASE_API_KEY", "VITE_FIREBASE_AUTH_DOMAIN", "VITE_FIREBASE_PROJECT_ID", "VITE_FIREBASE_APP_ID"].filter((k) => !(webEnv.get(k) ?? ""));
console.log(`server/.env.production: ${server.size} variables (names: ${[...server.keys()].join(", ")})`);
console.log(`web/.env.production:    ${webEnv.size} variables (names: ${[...webEnv.keys()].join(", ")})`);
console.log("Changed: " + notes.join("; "));
if (!server.get("TWILIO_WHATSAPP_FROM")) console.log("Note: TWILIO_WHATSAPP_FROM is empty, so WhatsApp messages will be skipped (everything else works).");
if (missingServer.length) console.log(`WARNING: empty in server/.env: ${missingServer.join(", ")}`);
if (missingWeb.length) console.log(`WARNING: empty in web/.env (the web app cannot sign in without them): ${missingWeb.join(", ")}`);
console.log("Values were not printed. Paste the files into the hosts' variable editors, then delete them if you like (they are git-ignored).");
