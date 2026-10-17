import { PDFDocument, rgb, StandardFonts, type PDFFont, type PDFPage } from "pdf-lib";
import { form } from "../form.js";

const FOOTER = "Prepared by Saathi. Pending bank verification and customer signature.";

// pdf-lib's built-in fonts only cover WinAnsi: replace anything else so drawing never throws.
export const safe = (s: unknown) => String(s ?? "").replace(/[^\x20-\x7E -ÿ]/g, "?");

const answer = (app: Record<string, any>, id: string): string => {
  const a = app.answers?.[id];
  if (!a) return "";
  const f = form.fields.find((x) => x.id === id);
  if (f?.type === "choice") return f.options?.find((o) => o.value === a.value)?.label.en ?? String(a.value);
  if (f?.type === "yesno") return a.value ? "Yes" : "No";
  if (f?.type === "date") {
    const [y, m, d] = String(a.value).split("-");
    return `${d}/${m}/${y}`; // dd/mm/yyyy
  }
  // English transliteration for names / addresses (SPEC); the typed or spoken value if none.
  return String(a.valueEn ?? a.value ?? "");
};

function wrap(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const lines: string[] = [];
  let line = "";
  for (const word of safe(text).split(/\s+/)) {
    const next = line ? `${line} ${word}` : word;
    if (font.widthOfTextAtSize(next, size) > maxWidth && line) { lines.push(line); line = word; } else line = next;
  }
  if (line) lines.push(line);
  return lines.length ? lines : [""];
}

/**
 * Clean savings-account form in English. Every value is drawn as one text run (so it can be read back by tests).
 * `signaturePng` is embedded once the customer has signed at the branch.
 */
export async function fillAccountForm(appId: string, app: Record<string, any>, opts: { signaturePng?: Buffer } = {}): Promise<Buffer> {
  const pdf = await PDFDocument.create();
  pdf.setTitle("Savings Account Application");
  pdf.setProducer("Saathi");
  const page: PDFPage = pdf.addPage([595, 842]);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const teal = rgb(0.055, 0.486, 0.525), navy = rgb(0.122, 0.227, 0.373), grey = rgb(0.4, 0.43, 0.47);
  const left = 50;
  let y = 842;

  page.drawRectangle({ x: 0, y: 842 - 90, width: 595, height: 90, color: teal });
  page.drawText("Savings Account Application Form", { x: left, y: 842 - 45, size: 22, font: bold, color: rgb(1, 1, 1) });
  page.drawText("Prepared with the Saathi voice assistant", { x: left, y: 842 - 68, size: 11, font, color: rgb(1, 1, 1) });
  y = 842 - 125;

  page.drawText(safe(`Application ID: ${appId}`), { x: left, y, size: 9, font, color: grey });
  page.drawText(safe(`Date prepared: ${new Date().toISOString().slice(0, 10)}`), { x: 360, y, size: 9, font, color: grey });
  y -= 30;

  const section = (title: string) => {
    page.drawText(title, { x: left, y, size: 13, font: bold, color: navy });
    page.drawLine({ start: { x: left, y: y - 5 }, end: { x: 545, y: y - 5 }, thickness: 1, color: teal });
    y -= 28;
  };
  const row = (label: string, value: string) => {
    page.drawText(safe(label), { x: left, y, size: 10, font, color: grey });
    const lines = wrap(value || "-", bold, 12, 330);
    for (const l of lines) { page.drawText(l, { x: 200, y, size: 12, font: bold, color: rgb(0.07, 0.07, 0.07) }); y -= 17; }
    y -= 6;
  };

  section("Applicant details");
  row("Full name", answer(app, "full_name"));
  row("Date of birth", answer(app, "dob"));
  row("Mobile number", answer(app, "mobile"));
  row("Address", answer(app, "address"));
  row("Occupation", answer(app, "occupation"));
  y -= 6;

  section("Nominee");
  row("Nominee name", answer(app, "nominee_name"));
  row("Relationship", answer(app, "nominee_relation"));
  row("WhatsApp updates", answer(app, "notify_consent"));
  y -= 6;

  section("Documents checked by Saathi");
  const d = app.documents ?? {};
  row("Aadhaar", d.aadhaar ? `XXXX XXXX ${d.aadhaar.aadhaarLast4 ?? "----"} (${d.aadhaar.valid ? "number valid" : "needs checking"})` : "Not provided");
  row("PAN", d.pan ? `${d.pan.fields?.pan ?? "-"} (${d.pan.valid ? "valid" : "needs checking"})` : "Not provided");
  row("Bank IFSC (passbook)", d.passbook ? `${d.passbook.fields?.ifsc ?? "-"} (${d.passbook.valid ? "valid" : "needs checking"})` : "Not provided");
  if (app.readiness?.score !== undefined) row("Readiness score", `${app.readiness.score} / 100`);
  y -= 10;

  section("Signature");
  page.drawText("Customer signature:", { x: left, y, size: 10, font, color: grey });
  page.drawRectangle({ x: 200, y: y - 50, width: 230, height: 62, borderColor: grey, borderWidth: 1 });
  if (opts.signaturePng) {
    const img = await pdf.embedPng(opts.signaturePng);
    const scale = Math.min(222 / img.width, 54 / img.height);
    page.drawImage(img, { x: 204, y: y - 46, width: img.width * scale, height: img.height * scale });
  }
  page.drawText(opts.signaturePng ? "Signed at branch" : "To be signed at the branch", { x: 440, y: y - 20, size: 9, font, color: grey });

  page.drawLine({ start: { x: left, y: 60 }, end: { x: 545, y: 60 }, thickness: 0.5, color: grey });
  page.drawText(FOOTER, { x: left, y: 45, size: 9, font, color: grey });

  return Buffer.from(await pdf.save({ useObjectStreams: false }));
}
