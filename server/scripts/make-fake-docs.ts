// Draws FAKE sample documents (clearly watermarked) into server/assets/demo-docs. Deterministic; safe to re-run.
// Each card carries a QR code with its fields: the MOCK_AI reader decodes that; real Gemini reads the printed text.
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import QRCode from "qrcode";
import sharp from "sharp";
import { verhoeffCheckDigit } from "../src/services/validators.js";

const OUT = join(dirname(fileURLToPath(import.meta.url)), "..", "assets", "demo-docs");

const base11 = "23456789012";
export const FAKE_AADHAAR = base11 + verhoeffCheckDigit(base11);
export const FAKE_AADHAAR_BAD = FAKE_AADHAAR.slice(0, 11) + String((Number(FAKE_AADHAAR[11]) + 1) % 10);

const person = { name: "Ramesh Shetty", dob: "1950-03-15", dobPrinted: "15/03/1950", pan: "ABCPS1234F", ifsc: "SDBK0001234", account: "0012345678" };

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");
const spaced = (n: string) => n.replace(/(\d{4})(?=\d)/g, "$1 ");

interface Card { kind: "aadhaar" | "pan" | "passbook"; color: string; title: string; lines: [string, string][]; qr: Record<string, string> }

function svg(c: Card) {
  const rows = c.lines
    .map(([k, v], i) => `<text x="50" y="${215 + i * 78}" font-size="22" fill="#5a6470">${esc(k)}</text><text x="50" y="${248 + i * 78}" font-size="38" font-weight="bold" fill="#111">${esc(v)}</text>`)
    .join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="630">
  <rect width="1000" height="630" rx="26" fill="#fbfaf5"/>
  <rect width="1000" height="130" rx="26" fill="${c.color}"/><rect y="90" width="1000" height="40" fill="${c.color}"/>
  <text x="50" y="82" font-size="46" font-weight="bold" fill="#fff" font-family="Arial, sans-serif">${esc(c.title)}</text>
  <g font-family="Arial, sans-serif">${rows}</g>
  <text x="50" y="605" font-size="22" font-weight="bold" fill="#c0392b" font-family="Arial, sans-serif">FAKE SAMPLE FOR DEMO. NOT A REAL DOCUMENT.</text>
  <text x="640" y="205" font-size="20" fill="#5a6470" font-family="Arial, sans-serif">Scan to verify (sample)</text>
</svg>`;
}

async function render(c: Card): Promise<Buffer> {
  const qr = await QRCode.toBuffer(JSON.stringify({ t: c.kind, ...c.qr }), { type: "png", width: 300, margin: 2, errorCorrectionLevel: "M" });
  return sharp(Buffer.from(svg(c))).composite([{ input: qr, left: 650, top: 250 }]).flatten({ background: "#ffffff" }).jpeg({ quality: 88 }).toBuffer();
}

const aadhaar = (num: string, name = person.name): Card => ({
  kind: "aadhaar", color: "#d35400", title: "AADHAAR (SAMPLE)",
  lines: [["Name", name], ["Date of Birth", person.dobPrinted], ["Aadhaar number", spaced(num)]],
  qr: { n: name, d: person.dob, x: num },
});
const pan = (name: string): Card => ({
  kind: "pan", color: "#1f3a5f", title: "PERMANENT ACCOUNT NUMBER (SAMPLE)",
  lines: [["Name", name], ["Date of Birth", person.dobPrinted], ["PAN", person.pan]],
  qr: { n: name, d: person.dob, x: person.pan },
});
const passbook = (name: string): Card => ({
  kind: "passbook", color: "#0e7c86", title: "SAATHI DEMO BANK (SAMPLE)",
  lines: [["Account holder", name], ["IFSC", person.ifsc], ["Account number", person.account]],
  qr: { n: name, i: person.ifsc },
});

async function write(rel: string, card: Card, post?: (b: Buffer) => Promise<Buffer>) {
  let img = await render(card);
  if (post) img = await post(img);
  const file = join(OUT, rel);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, img);
  console.log(`${rel}  ${(img.length / 1024).toFixed(0)} KB`);
}

await write("clean/aadhaar.jpg", aadhaar(FAKE_AADHAAR));
await write("clean/pan.jpg", pan("RAMESH SHETTY"));
await write("clean/passbook.jpg", passbook("Mr Ramesh Shetty"));
// Name variant: PAN carries a middle initial -> NAME_SPELLED_DIFFERENTLY (warn)
await write("name-variant/aadhaar.jpg", aadhaar(FAKE_AADHAAR));
await write("name-variant/pan.jpg", pan("RAMESH K SHETTY"));
await write("name-variant/passbook.jpg", passbook("Mr Ramesh Shetty"));
// Blurry Aadhaar -> PHOTO_BLURRY
await write("blurry-aadhaar.jpg", aadhaar(FAKE_AADHAAR), (b) => sharp(b).blur(9).jpeg({ quality: 80 }).toBuffer());
// Aadhaar whose last digit is wrong (checksum fails) -> AADHAAR_INVALID
await write("invalid-aadhaar.jpg", aadhaar(FAKE_AADHAAR_BAD));

writeFileSync(
  join(OUT, "README.md"),
  `# Demo documents (all FAKE)

Person: ${person.name}, born ${person.dobPrinted}. Use these answers in the interview: full name "${person.name}", date of birth ${person.dobPrinted}.

- clean/: aadhaar, pan, passbook that all agree -> readiness 100, no problems
- name-variant/: PAN shows "RAMESH K SHETTY" -> NAME_SPELLED_DIFFERENTLY (warning)
- blurry-aadhaar.jpg -> PHOTO_BLURRY
- invalid-aadhaar.jpg -> AADHAAR_INVALID (checksum fails)

Regenerate: \`npm run make-docs\` (in server/).
`,
);
