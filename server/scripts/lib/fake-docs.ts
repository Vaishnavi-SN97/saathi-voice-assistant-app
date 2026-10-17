// FAKE sample documents (clearly watermarked). Shared by make-fake-docs.ts (demo images on disk) and seed.ts (demo applications).
// Each card carries a QR code with its fields: the MOCK_AI reader decodes that; real Gemini reads the printed text.
import QRCode from "qrcode";
import sharp from "sharp";
import { verhoeffCheckDigit } from "../../src/services/validators.js";

export interface Person {
  name: string; // as printed on Aadhaar / passbook
  dob: string; // ISO
  dobPrinted: string; // dd/mm/yyyy
  aadhaar: string; // 12 digits, valid checksum unless made invalid on purpose
  pan: string;
  ifsc: string;
  account: string;
}

/** A valid Aadhaar-style number (first digit 2-9, Verhoeff check digit) from 11 base digits. */
export const fakeAadhaar = (base11: string) => base11 + verhoeffCheckDigit(base11);
/** The same number with a wrong last digit: fails the checksum. */
export const breakAadhaar = (n: string) => n.slice(0, 11) + String((Number(n[11]) + 1) % 10);

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

/** Card for one person. `printedName` overrides the name on this card (e.g. "RAMESH K SHETTY" on the PAN). */
export function renderCard(kind: Card["kind"], p: Person, printedName?: string): Promise<Buffer> {
  if (kind === "aadhaar") {
    const name = printedName ?? p.name;
    return render({ kind, color: "#d35400", title: "AADHAAR (SAMPLE)", lines: [["Name", name], ["Date of Birth", p.dobPrinted], ["Aadhaar number", spaced(p.aadhaar)]], qr: { n: name, d: p.dob, x: p.aadhaar } });
  }
  if (kind === "pan") {
    const name = printedName ?? p.name.toUpperCase();
    return render({ kind, color: "#1f3a5f", title: "PERMANENT ACCOUNT NUMBER (SAMPLE)", lines: [["Name", name], ["Date of Birth", p.dobPrinted], ["PAN", p.pan]], qr: { n: name, d: p.dob, x: p.pan } });
  }
  const name = printedName ?? `Mr ${p.name}`;
  return render({ kind, color: "#0e7c86", title: "SAATHI DEMO BANK (SAMPLE)", lines: [["Account holder", name], ["IFSC", p.ifsc], ["Account number", p.account]], qr: { n: name, i: p.ifsc } });
}
