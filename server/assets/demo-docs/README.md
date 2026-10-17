# Demo documents (all FAKE)

Person: Ramesh Shetty, born 15/03/1950. Use these answers in the interview: full name "Ramesh Shetty", date of birth 15/03/1950.

- clean/: aadhaar, pan, passbook that all agree -> readiness 100, no problems
- name-variant/: PAN shows "RAMESH K SHETTY" -> NAME_SPELLED_DIFFERENTLY (warning)
- blurry-aadhaar.jpg -> PHOTO_BLURRY
- invalid-aadhaar.jpg -> AADHAAR_INVALID (checksum fails)

Regenerate: `npm run make-docs` (in server/).
