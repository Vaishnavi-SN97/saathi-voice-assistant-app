// Draws FAKE sample documents (clearly watermarked) into server/assets/demo-docs. Deterministic; safe to re-run.
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import { breakAadhaar, fakeAadhaar, renderCard, type Person } from "./lib/fake-docs.js";

const OUT = join(dirname(fileURLToPath(import.meta.url)), "..", "assets", "demo-docs");

export const FAKE_AADHAAR = fakeAadhaar("23456789012");
export const FAKE_AADHAAR_BAD = breakAadhaar(FAKE_AADHAAR);

const person: Person = {
  name: "Ramesh Shetty", dob: "1950-03-15", dobPrinted: "15/03/1950",
  aadhaar: FAKE_AADHAAR, pan: "ABCPS1234F", ifsc: "SDBK0001234", account: "0012345678",
};

function write(rel: string, img: Buffer) {
  const file = join(OUT, rel);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, img);
  console.log(`${rel}  ${(img.length / 1024).toFixed(0)} KB`);
}

write("clean/aadhaar.jpg", await renderCard("aadhaar", person));
write("clean/pan.jpg", await renderCard("pan", person, "RAMESH SHETTY"));
write("clean/passbook.jpg", await renderCard("passbook", person, "Mr Ramesh Shetty"));
// Name variant: PAN carries a middle initial -> NAME_SPELLED_DIFFERENTLY (warn)
write("name-variant/aadhaar.jpg", await renderCard("aadhaar", person));
write("name-variant/pan.jpg", await renderCard("pan", person, "RAMESH K SHETTY"));
write("name-variant/passbook.jpg", await renderCard("passbook", person, "Mr Ramesh Shetty"));
// Blurry Aadhaar -> PHOTO_BLURRY
write("blurry-aadhaar.jpg", await sharp(await renderCard("aadhaar", person)).blur(9).jpeg({ quality: 80 }).toBuffer());
// Aadhaar whose last digit is wrong (checksum fails) -> AADHAAR_INVALID
write("invalid-aadhaar.jpg", await renderCard("aadhaar", { ...person, aadhaar: FAKE_AADHAAR_BAD }));

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
