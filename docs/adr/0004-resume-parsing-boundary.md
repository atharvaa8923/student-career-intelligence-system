# ADR-0004 — Resume parsing boundary

**Status:** Proposed

## Context

No resume service exists in this repository (the earlier TXT-only prototype lives elsewhere and is not imported). Today's syllabus upload parses PDF/DOCX **inside the FastAPI process** (`pdfplumber`, `python-docx`) after a temp-file write. `python-multipart 0.0.9` has multiple published advisories (R-3), and it sits directly on the upload path. Resumes contain highly sensitive personal data and are attacker-controlled input. (Inventory §4.2, §16, §18.)

## Decision

Treat parsing as an **untrusted-input boundary** with these layers:

1. **Intake (API process).** Authenticated user only; accept `multipart` with a strict size cap (proposed 5 MiB; owner to confirm); validate extension ∈ {pdf, docx}, declared MIME, **file signature** (`%PDF-` header; DOCX = ZIP with `[Content_Types].xml` and `word/document.xml`), and for DOCX a decompressed-size and member-count limit (zip-bomb guard). Reject before any parser runs. Write the bytes only to the private `resumes` bucket at `resumes/<auth_uid>/<resume_id>/<version>.<ext>`; store SHA-256, size, and a `quarantined` status. The API never parses.
2. **Queue.** Intake enqueues a `resume.parse` task (ADR-0003) carrying `resume_id` only.
3. **Parser worker (separate process/container).** Runs with: no outbound network, read-only root filesystem, non-root user, CPU/memory/time limits (proposed 30 s wall clock, 512 MiB), a hard page cap, and a **subprocess per file** so a crash or hang kills only that job. Parsers are pinned and minimal (PDF: text extraction only; **no** JavaScript/embedded-file/form execution; DOCX: read XML parts; **no** macros, external links, or OLE resolution; DOCM/DOC rejected).
4. **Output.** The worker writes *structured candidates* (skills, projects, experience, education, certifications) each with **source text spans** and a parser version into `profile.*` tables via a narrow worker role. It does not write evidence strength as final; `skill_evidence` rows start as `unreviewed` until the student confirms (Phase 5).
5. **No third-party processing by default.** Resume text is **not** sent to an external LLM or API. If an LLM is later proposed, it requires a separate ADR, an explicit per-student consent event, a data-processing review, and redaction.
6. **Retention and deletion.** Raw file and any full extracted text are retained only as long as the student keeps the resume version or the retention setting allows (default proposed: 12 months after last activity; owner to confirm). Deletion removes the Storage object, extracted text, derived evidence, and enqueues tombstone audit metadata (no content).

Rejection and failure records go to `private.import_rejections` / `processing_errors` with a **reason code only** — never excerpts of the resume.

## Alternatives considered

| Option | Why not chosen |
|---|---|
| Parse inside the API process (as syllabus upload does) | A parser exploit or hang takes down the API that holds the user's token and DB connection |
| Hosted resume-parsing API | Sends sensitive student content to a third party; fails data-minimization without legal review |
| LLM extraction by default | Non-deterministic, external disclosure, no spans guarantee, poor reproducibility |
| Accept DOC/RTF/TXT too | Larger attack surface; DOC (OLE) is the riskiest format. Revisit only on demand |

## Consequences

- Upload → "ready to review" is asynchronous; the UI shows processing state.
- A test corpus of malicious/unsupported files must be maintained (synthetic only, generated at test time, not stored with personal data).

## Security and privacy notes

- Satisfies the prompt's validation list (extension, MIME, signature, size) and bounded execution.
- Resume text and extracted spans are **never** logged, put in agent events, in security findings, or in screenshots.
- Signed download URLs, if used, are short-lived (proposed ≤ 60 s) and issued only after an ownership check; Phase 4 tests expiry.
- Upgrade `python-multipart` (≥ 0.0.31 per audit) before the intake route exists.

## Verification required before acceptance

- Test corpus: wrong extension, mismatched MIME, truncated PDF, encrypted PDF, PDF with JavaScript, polyglot file, DOCX with external relationships, DOCX zip bomb, oversize file, empty file → all rejected or parsed safely with no network call.
- Parser timeout test kills the subprocess and marks the task `failed`.
- Cross-account test: Student B cannot read A's object or parsed rows.

## Open questions for the owner

1. Size cap, retention default, and whether DOC/RTF/TXT are required.
2. Is any external AI processing of resume content ever acceptable for this product? (Default: no.)
