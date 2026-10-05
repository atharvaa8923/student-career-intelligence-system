# Phase 1 — Portable root commands, aggregate health checks, and urgent fixes

**Status:** Complete — awaiting owner review before Phase 2.
**Date:** 2026-10-05 · **Branch:** `claude/student-career-intelligence-arch-krjgkl`
**Decisions applied:** ADR-0001…0010 approved by the owner on 2026-10-05. The owner granted full access ("allow everything") and approved reuse of the upstream SyllabusCheck coverage engine.

## Scope

1. Portable developer commands and aggregate health checks (no macOS/Keychain dependency).
2. Repair the stale regression tests found in Phase 0 (T2–T4).
3. Root CI with no deployment.
4. Urgent security fixes from the inventory that touch only existing code: R-1, R-3, R-5.
5. Restore the missing coverage engine (inventory §4.3, D-9).

Out of scope: hosted smoke test and TLS (Phase 2), runtime database roles (Phase 2), portal (Phase 3).

## What changed

| Area | Change |
|---|---|
| **R-1 / R-5 auth** | `api/routes/jobs.py`: `trigger-keyword-extraction`, `reparse-all`, `recompute-coverage-all`, `reparse-empty` now require `require_admin` (four had **no** authentication). `api/routes/keywords.py`: `classify-subdomains`, `backfill-embeddings` changed from any user to admin only |
| Dead legacy auth | Deleted `core/auth.py` (local JWT/bcrypt), `api/routes/google_auth.py` (unmounted), `frontend/src/pages/OAuthCallback.tsx` (unrouted) |
| **R-3 Python deps** | Removed `python-jose`, `authlib`, `bcrypt` (unused). Upgraded `fastapi` 0.111.0→0.142.2, `python-multipart` 0.0.9→0.0.32, `pydantic` 2.7.4→2.13.5, `pydantic-settings` 2.3.4→2.15.0, `python-dotenv` 1.0.1→1.2.2. Added `email-validator==2.3.0` (was a transitive dependency of FastAPI 0.111; `EmailStr` in the auth routes needs it) |
| **R-3 Node deps** | JSOM backend: removed unused `uuid`, `jsonwebtoken`, `bcryptjs`; `express` 4.21.2→4.22.3, `express-validator` 7.2.1→7.3.2, `morgan` 1.10.0→1.12.1. Both frontends: `npm audit fix` (non-breaking lockfile updates) |
| Coverage engine | Restored `backend/services/coverage/{__init__,engine,gap_analyzer}.py` unmodified from upstream commit `7aa7a18`, with `PROVENANCE.md` (hashes, license note, limitations). Root `.gitignore` rule `coverage/` anchored so it no longer hides source |
| Tests | Repaired `signup-roles.cjs`, `test_signup_roles.py`, `test_schema_migrations.py`. New `implementations/tests/test_route_authorization.py` (static, stdlib) and `syllabus-check/backend/tests/test_http_authorization.py` (real app over HTTP) |
| Tooling | Root `Makefile`; `scripts/db-replay-test.sh`, `scripts/health.sh`, `scripts/secret-scan.sh`, `scripts/dev-up.sh`; root `.env.example`; test-only `supabase-foundation/tests/supabase_platform_stub.sql` |
| CI | New root `.github/workflows/ci.yml`: lint + unit + secret scan, SQL replay, legacy migrations, backend HTTP tests, two frontend builds, report-only dependency audit. **No deploy step, no secrets.** Deleted the inert nested `syllabus-check/.github/workflows/ci.yml`, which contained automatic Railway/Vercel deploys |

## Why

Phase 0 found four unauthenticated mutation routes (one can queue up to 5,000 paid LLM jobs), 62 dependency advisories, three failing guard tests, a CI file GitHub never ran, a macOS-only launcher, and a coverage engine missing from git.

## Security implications

- R-1/R-5 closed for the listed routes. Admin routes that use `get_db` now run under the admin's transaction-local identity (`SET LOCAL ROLE authenticated`), so they see only rows RLS allows that admin, instead of running with the connection owner's privileges. A cross-user re-parse is therefore no longer possible from these routes; a privileged worker path is a Phase 2/ADR-0010 item.
- Advisories: Python direct pins **39 → 1**; JSOM backend **9 → 0**; JSOM frontend **5 → 4**; SyllabusCheck frontend **9 → 2**.
- The restored coverage engine opens its own connection and bypasses request identity (R-2). It is legacy faculty-tool code and must not feed student recommendations (ADR-0006). See its `PROVENANCE.md`.
- The upstream coverage code has **no license**. Reuse was approved by the repository owner; confirm with the upstream author before any public or commercial distribution.

## Database changes

None. The test-only platform stub is never applied to Supabase.

## Verification performed (this session)

| Check | Result |
|---|---|
| `test_route_authorization.py` (static) | 3/3 pass; **fails 10 checks on the pre-fix code** |
| `test_http_authorization.py` (real FastAPI app, TestClient) | 37 anonymous → 401 checks + 8 non-admin → 403 checks pass; **8 fail on the pre-fix `jobs.py`** (anonymous calls reached the DB and queue) |
| SyllabusCheck pytest on upgraded stack | **52 passed** |
| Multipart upload on `python-multipart` 0.0.32 | `.exe` → 400 "Unsupported file type", no file → 422 |
| App import on FastAPI 0.142.2 / pydantic 2.13.5 | 38 OpenAPI paths |
| JSOM signup tests | 2/2 pass |
| SyllabusCheck signup tests | 3/3 pass |
| Legacy migration tests on pydantic 2.13.5 | 3/3 pass (local PG 16 + pgvector) |
| `scripts/db-replay-test.sh` | PASS; **exit 1** when a migration disables RLS on `planner.students`; drops its database either way |
| `scripts/secret-scan.sh` | Clean; **detects a planted key** |
| `scripts/health.sh` | PASS / WARN / FAIL paths verified against a local stub server |
| JSOM API boot on upgraded Express | `/health` 200; `/api/students/dashboard`, `/api/admin/stats`, `/api/schedule` 401; helmet CSP/HSTS headers present |
| Frontend production builds after lockfile updates | Both pass |
| `npm audit` / `pip-audit` | See Security implications |
| GitHub CI on the first Phase 1 commit (`4205901`) | All 6 jobs green |

## Known limitations

1. `sentence-transformers` 3.0.1 has one advisory; the fix is a major version (5.x) that needs torch and the ML stack to verify. Deferred to Phase 7 (curriculum evidence), where embeddings are re-evaluated.
2. Remaining frontend advisories (JSOM 4 high, SyllabusCheck 2 moderate) need breaking upgrades (Vite/major library versions). The CI audit is report-only until cleared.
3. `scripts/dev-up.sh` was verified only for its configuration-error path; a full start needs the hosted credentials (Phase 2).
4. Hosted Supabase was not accessed. Storage policies are still unexercised (the stub does not enforce them).
5. The coverage engine was restored, not adapted: it queries legacy table names and has not been run against the Supabase schema.
6. JSOM admin routes still reference relations missing from the runtime schema (inventory §4.3). Not in Phase 1 scope; tracked for Phase 3.

## Rollback

`git revert` the Phase 1 commits. Restoring the old dependency pins reintroduces the advisories; restoring `jobs.py`/`keywords.py` reopens R-1/R-5 (do not do that in any deployed environment). No data or infrastructure changes.

## Next proposed phase — Phase 2: hosted HTTP smoke test and TLS verification

- Verify `DB_SSL_CA` against the project certificate; run both backends against the hosted dev project with verified TLS; `make health` end to end.
- Create non-owner `app_runtime` and per-worker database roles (ADR-0010) and switch the runtime connection to them.
- Tests: pooled-connection identity isolation, expired/invalid/forged tokens, anonymous vs cross-account denial over HTTP.
- Confirm or enable email confirmation in hosted Auth (R-4).

**Owner inputs needed for Phase 2:** the dev project's database password and publishable key (from your Keychain), or run the Phase 2 commands on your Mac or via your Codex agent. This cloud session has no access to those secrets.
