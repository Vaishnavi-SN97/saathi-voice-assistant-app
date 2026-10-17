// Scans the repository for secrets. Never prints a secret: only file, line and which rule matched.
//   npm run secret-scan               -> files in the working tree that git tracks or would track (not ignored)
//   npm run secret-scan -- --history  -> also every commit on every branch (git log -p)
// Two kinds of checks: (1) well-known key formats, (2) the EXACT values found in server/.env and web/.env on this machine.
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const git = (...args) => execFileSync("git", ["-C", root, ...args], { encoding: "utf8", maxBuffer: 512 * 1024 * 1024 });

const RULES = [
  // (the documentation placeholder "-----BEGIN PRIVATE KEY-----\n...\n-----END..." is not a key)
  ["private key block", /-----BEGIN [A-Z ]*PRIVATE KEY-----(?!\\n\.\.\.)/],
  ["Google API key", /AIza[0-9A-Za-z_-]{35}/],
  ["Gemini key (AQ.)", /\bAQ\.Ab8[0-9A-Za-z_-]{20,}/],
  ["Sarvam key", /\bsk_[A-Za-z0-9]{2,12}_[A-Za-z0-9]{20,}/],
  ["Twilio account SID", /\bAC[0-9a-f]{32}\b/],
  ["GitHub token", /\bgh[pousr]_[A-Za-z0-9]{30,}/],
  ["Slack token", /\bxox[baprs]-[A-Za-z0-9-]{10,}/],
  ["assigned secret", /\b[A-Z0-9_]*(SECRET|TOKEN|API_KEY|PASSWORD|PRIVATE_KEY)\s*=\s*["']?[A-Za-z0-9/+_.\-]{24,}/],
];
const SKIP_EXT = /\.(jpe?g|png|gif|webp|ico|woff2?|ttf|otf|pdf|lock)$/i;
// .env.example is deliberately NOT skipped: a filled-in example file is the usual way a real key gets committed.
const SKIP_FILE = /(^|\/)(package-lock\.json|pnpm-lock\.yaml)$/;
/** Names whose value must be blank in an example file. */
const SECRET_NAME = /(KEY|SECRET|TOKEN|PASSWORD|SID|CREDENTIAL|PRIVATE)/;
const PUBLIC_NAME = /^(VITE_API_URL|VITE_FIREBASE_AUTH_DOMAIN|VITE_FIREBASE_PROJECT_ID|PUBLIC_API_URL|CORS_ORIGINS|FIREBASE_PROJECT_ID|GEMINI_MODEL|NOTIFY_MODE|MOCK_AI|PORT|BASELINE_MANUAL_MINUTES|RETENTION|RETENTION_DAYS|TWILIO_WHATSAPP_FROM)$/;

// exact local secrets
const secrets = [];
for (const f of ["server/.env", "web/.env"]) {
  const p = join(root, f);
  if (!existsSync(p)) continue;
  for (const line of readFileSync(p, "utf8").split(/\r?\n/)) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)$/.exec(line);
    if (!m) continue;
    const name = m[1];
    let v = m[2].trim().replace(/^["']|["']$/g, "");
    if (/^(PORT|MOCK_AI|NOTIFY_MODE|BASELINE_MANUAL_MINUTES|CORS_ORIGINS|PUBLIC_API_URL|FIREBASE_PROJECT_ID|GEMINI_MODEL|VITE_FIREBASE_AUTH_DOMAIN|VITE_FIREBASE_PROJECT_ID|VITE_API_URL|TWILIO_WHATSAPP_FROM|RETENTION.*)$/.test(name)) continue; // not secret
    if (name === "FIREBASE_PRIVATE_KEY") {
      const body = v.replace(/\\n/g, "\n").replace(/-----[A-Z ]+-----/g, "").replace(/\s+/g, "");
      if (body.length > 60) secrets.push([name + " (body)", body.slice(40, 100)]);
      continue;
    }
    if (v.length >= 12) secrets.push([name, v]);
  }
}

const hits = [];
const scanText = (label, text) => {
  const lines = text.split("\n");
  lines.forEach((line, i) => {
    for (const [rule, re] of RULES) if (re.test(line)) hits.push(`${label}:${i + 1}  matches "${rule}"`);
    for (const [name, v] of secrets) if (line.includes(v)) hits.push(`${label}:${i + 1}  contains the exact value of ${name} from a local .env`);
  });
  // private key body may be on one escaped line: search the flattened text too
  const flat = text.replace(/\\n/g, "").replace(/\s+/g, "");
  for (const [name, v] of secrets) if (name.endsWith("(body)") && flat.includes(v)) hits.push(`${label}  contains the FIREBASE private key body`);
};

/** An example file must show the shape, never a value: a filled-in one is how a real key usually gets committed. */
const scanExample = (label, text) => {
  text.split("\n").forEach((line, i) => {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*["']?(.*?)["']?\s*$/.exec(line);
    if (!m) return;
    const [, name, value] = m;
    if (!value || PUBLIC_NAME.test(name) || value.startsWith("http") || value.startsWith("-----BEGIN")) return;
    if (SECRET_NAME.test(name)) hits.push(`${label}:${i + 1}  ${name} has a value; an example file must leave it blank`);
  });
};

const files = git("ls-files", "--cached", "--others", "--exclude-standard").split("\n").filter(Boolean);
let scanned = 0;
for (const f of files) {
  if (SKIP_EXT.test(f) || SKIP_FILE.test(f)) continue;
  const p = join(root, f);
  if (!existsSync(p) || statSync(p).size > 2_000_000) continue;
  const text = readFileSync(p, "utf8");
  scanText(f, text);
  if (/\.env\.example$/.test(f)) scanExample(f, text);
  scanned++;
}

let commits = 0;
if (process.argv.includes("--history")) {
  commits = git("rev-list", "--all", "--count").trim() * 1;
  const log = git("log", "-p", "--all", "--no-color", "--format=commit %h", "--", ".", ":(exclude)*.jpg", ":(exclude)*.png", ":(exclude)*package-lock.json", ":(exclude)*pnpm-lock.yaml");
  let commit = "?";
  log.split("\n").forEach((line, i) => {
    if (line.startsWith("commit ")) return void (commit = line.slice(7));
    if (!line.startsWith("+") || line.startsWith("+++")) return;
    for (const [rule, re] of RULES) if (re.test(line)) hits.push(`history ${commit} (log line ${i}): "${rule}"`);
    for (const [name, v] of secrets) if (line.includes(v)) hits.push(`history ${commit} (log line ${i}): exact value of ${name}`);
  });
}

// Files fail the scan. Findings in old commits are reported but only fail with --strict-history
// (removing them needs a history rewrite + force push, which is the owner's call).
const inFiles = hits.filter((h) => !h.startsWith("history "));
const inHistory = hits.filter((h) => h.startsWith("history "));
if (inHistory.length) console.warn(`History findings (already committed; informational):\n${[...new Set(inHistory)].join("\n")}\n`);
if (inFiles.length || (inHistory.length && process.argv.includes("--strict-history"))) {
  console.error(`SECRETS FOUND (${inFiles.length} in files):\n` + [...new Set(inFiles)].join("\n"));
  process.exit(1);
}
console.log(`secret scan clean: ${scanned} files${commits ? `, ${commits} commits of history` : ""}, ${RULES.length} key formats, ${secrets.length} local secret values checked`);
