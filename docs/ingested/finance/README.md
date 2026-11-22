# Finance corpus

Run `npm run corpus` to download public README / CONTRIBUTING / SECURITY docs of open-source
finance projects into subfolders here (each file carries a `source:` URL header).

Add regulatory and standards material **manually** as `.md` files under `regulatory/`
(e.g. summaries or excerpts of PCI DSS, PSD2, GDPR, SOX, or your local regulator's guidelines).
Always keep the source URL and date at the top of each file. Do not paste text you cannot cite.

Only documented public practices are reported. The corpus does not claim that undocumented
internal practices do not exist. Downloaded content is git-ignored; commit `regulatory/` files only
if their license allows redistribution.

## domain-notes/
Short general engineering-practice notes written for this project (payments, KYC/fraud, lending, reporting/audit).
They are **not** regulatory or authoritative sources: they make retrieval relevant for the demo scenarios and every
file says so in its header. Replace or extend them with cited material. Anything jurisdiction-specific is left to
`NEEDS-VALIDATION`.
