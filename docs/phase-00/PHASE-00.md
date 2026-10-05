# Phase 0 — Baseline inventory and architecture decisions

**Status:** Complete pending owner review. Phase 1 has **not** been started.
**Date:** 2026-10-05 · **Branch:** `claude/student-career-intelligence-arch-krjgkl` (base `4b79aae`)

## Scope

Inventory what exists, record what is verified and what is not, and propose ten architecture decisions. No application code, migrations, or configuration were changed.

## What changed

Documentation only:

| File | Change |
|---|---|
| `docs/phase-00/BASELINE-INVENTORY.md` | New. Full inventory (21 sections) |
| `docs/adr/README.md`, `docs/adr/0001…0010-*.md` | New. Ten proposed ADRs |
| `docs/phase-00/PHASE-00.md` | New. This document |
| `NEXT-STEPS-END-TO-END-ROADMAP.md` | **New.** It was required reading but did not exist |
| `README.md` | Added documentation links and a capability-status table |
| `events.jsonl` | Appended a `phase_0_inventory_complete` event |
| `registry.json` | Added a `program_phases` record for Phase 0 |

## Why

The prompt requires an evidence-based baseline before any build work, and requires that planned architecture not be presented as finished functionality.

## Security implications

None introduced (no code or config changed). The inventory surfaces 17 risks. The ones that need a decision before the phases that touch them:

- **R-1 (High): unauthenticated mutation endpoints** in SyllabusCheck `jobs.py` (four routes, one of which queues up to 5,000 paid LLM jobs). Not fixed in this phase.
- **R-2 (High): owner-level database role** used by the runtime and Celery tasks.
- **R-3 (High): dependency advisories**, including `python-multipart` on the future resume-upload path.
- **R-4: email confirmation is off** in the checked-in Auth config; the product requires verified accounts.

## Database changes

None.

## Verification performed

All executed in this session unless noted.

| Check | Result |
|---|---|
| Replay of all 8 migrations on PostgreSQL 16.14 + pgvector (scratch stand-ins for Supabase `storage`/`extensions` schemas) | All apply |
| Catalog + prerequisite import re-derived from source files | 188 prerequisites loaded, 14 rejected — matches STEP-06 |
| 4 SQL assertion files (identity, application data, import reconciliation, runtime adapters) | All pass |
| RLS enablement across the 27 base tables | All enabled; none `FORCE`d |
| Grants listing for `anon`/`authenticated` | Reviewed; findings R-9, and JSOM admin writes denied |
| `pytest` SyllabusCheck | 7 passed |
| JSOM and SyllabusCheck signup-role tests | **Fail** (stale after STEP-04) |
| Schema-migration test | 2 pass, **1 fail** (stale head revision) |
| JSOM backend syntax check, both frontend production builds | Pass |
| `npm audit`, `pip-audit` (direct pins) | 23 npm and 39 Python advisories |
| Pattern-based secret scan | No private keys, tokens, or API keys found; scan is not exhaustive |

## Results

- The Supabase schema, RLS, and catalog import are **real and reproduce locally**.
- The legacy applications have **drifted** from the Supabase schema: JSOM admin routes reference tables that do not exist in the runtime search path, the SyllabusCheck coverage engine **is not in the repository** (gitignored by the rule `coverage/`), three regression tests are failing, and the only CI workflow is inert.
- Nothing required for the student workflow (profile, resume, matching, recommendation, roadmap, MCP, agents, Security Agent, unified portal) exists. Everything after the catalog and planner basics is **Planned**.

## Known limitations of this phase

1. **Not run against the hosted project.** Statements about the hosted database and Storage policy behavior come from STEP-xx documents. I replaced Supabase Storage with a scratch stub locally, so **storage policies were not exercised.**
2. **Platform.** The prompt's macOS path and `run-local.sh` could not be used here (zsh, Keychain, Homebrew). The launcher, TLS check, and HTTP smoke test are unrun.
3. **SyllabusCheck backend not started**: ML dependencies not installed and `services.coverage` is missing.
4. **Not reviewed:** `Progress_logs.docx`, `SyllabusCheck_AI_(4).pptx`, and the two generated market DOCX reports (binary documents). The registry's `agent-01` deliverable lives outside this repository and was not available.
5. `pip-audit` covered only directly pinned Python packages; transitive dependencies were not audited. The secret scan is regex-based.
6. Risk severities are my assessment, not an independent review.

## Rollback procedure

Documentation only. `git revert` the Phase 0 commit, or delete `docs/` and `NEXT-STEPS-END-TO-END-ROADMAP.md` and restore the three edited files from `4b79aae`. No data or infrastructure was touched. The scratch local PostgreSQL used for verification lives outside the repository and was discarded with the session.

## Decisions requested from you

1. **Approve, amend, or reject** each of ADR-0001…0010 (all "Proposed").
2. **R-1 timing.** The four unauthenticated SyllabusCheck routes are the most urgent finding. The phase order puts hardening later. Do you want a targeted fix included in Phase 1, or handled in the phase that touches those routes? (Recommendation: Phase 1, as a security fix with tests, because it is small and the routes can queue paid LLM work today.)
3. **Environment.** This work ran in a Linux container clone, not at your macOS path. Should later phases continue here, or do you want them applied to your local checkout?
4. **Owner inputs** listed under "Open questions" in each ADR. The ones that gate early phases: hosting target and budget (ADR-0002/0010), email-confirmation setting in the hosted project (R-4), and who approves syllabus-to-skill evidence (ADR-0006, Phase 7).
5. **Legacy demo data.** Should `password123` demo credentials and the login-page hint be removed in Phase 3 (recommended)?

## Next proposed phase — Phase 1: portable root developer commands and aggregate health checks

Proposed scope (for your approval; not started):

- Root `package.json`/`Makefile` with portable commands (`install`, `lint`, `test`, `build`, `db:*`, `health`) that run on Linux, macOS, and CI without Keychain or zsh.
- Aggregate health check script covering both APIs and the Supabase connection, with clear pass/fail output.
- Repair the three stale tests (T2–T4) so the signup-role and migration-chain guards actually run; add the SQL assertion replay (local Postgres + Supabase stand-in) as a repeatable test.
- Move the CI workflow to the repository root with **no automatic deployment**; add dependency-audit and secret-scan jobs.
- Restore the missing coverage engine only if the source can be located; otherwise record it as Blocked (needs your input).
- Optionally (decision 2): authenticate the four exposed SyllabusCheck routes with tests.

Out of scope for Phase 1: hosted HTTP smoke and TLS (Phase 2), the portal (Phase 3), and any profile/resume work.
