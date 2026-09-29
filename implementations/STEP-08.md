# Step 8 — ITM and Business Analytics market-alignment report

Status: implemented and verified on 2026-09-29.

## Purpose

SyllabusCheck now provides a focused report for Information Technology and Management (ITM) and Business Analytics (BA). It separates collected market evidence from curriculum evidence and does not present curriculum alignment as a guarantee of employment.

## Report contents

- What was collected: source, description-backed sample size, locations and collection timestamps.
- Key ITM and BA job families based on explicit title rules.
- Skills explicitly present in job descriptions, counted at most once per job.
- Skill demand share within each program sample.
- Best matching uploaded course and covered/partial/missing status when syllabus evidence exists.
- A market-weighted curriculum score using covered=1, partial=0.5 and missing=0.
- Priority curriculum actions derived from high-frequency missing skills.
- Data-quality labels and limitations.

## Pilot data

The focused importer collected five pages from the Arbeitnow public API and retained only listings with full descriptions whose titles matched the documented ITM or BA role families. The initial hosted pilot contains 18 jobs and 78 job-skill links. It is labeled `pilot` because fewer than 30 jobs qualify, and its geography is primarily European rather than Dallas/US.

Skill extraction is deterministic and description-only. A maintained pattern dictionary recognizes named tools, technical skills, analysis methods, delivery practices and professional competencies. It never adds likely skills based only on a title.

## Verification

- Five backend unit tests pass.
- Python compilation passes.
- Frontend TypeScript and production build pass.
- Authenticated endpoint returns 18 description-backed jobs: 10 ITM and 8 BA.
- Report page returns HTTP 200.
- With zero uploaded syllabi, both programs return `not_assessed` and a null curriculum score.
- The importer uses schema-qualified, idempotent upserts and verified database TLS.

## Required next evidence

Upload and parse the applicable ITM and BA syllabi before interpreting curriculum alignment. Add US/Dallas sources and multiple collection dates before using the job distribution for program decisions. Individual student readiness still requires resume, project, experience and preference evidence; this report currently measures curriculum preparation only.
