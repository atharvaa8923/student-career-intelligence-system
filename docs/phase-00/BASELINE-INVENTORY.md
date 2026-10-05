# Phase 0 — Baseline inventory

Inventory date: 2026-10-05. Repository: `atharvaa8923/student-career-intelligence-system`, branch `claude/student-career-intelligence-arch-krjgkl`, base commit `4b79aae`.

## 0. How to read this document

**Evidence labels.** Every claim carries one of:

| Label | Meaning |
|---|---|
| **[RAN]** | I executed it in this session and saw the result. |
| **[READ]** | I read the code, SQL, or config. Not executed. |
| **[DOC]** | Taken from a repository document (STEP-xx, README, status file). Not independently verified. |
| **[NOT VERIFIABLE HERE]** | Needs the hosted Supabase project, macOS Keychain, or credentials this environment does not have. |

Imported project documents are reference material. Where a document and the code disagree, the code (or the run result) is recorded and the disagreement is flagged.

**Environment limits for this inventory.**

- The prompt names `/Users/atharvavinaykulkarni/Documents/ChatGPT/Agents`. That macOS path does not exist in this session. I worked in the repository checkout at `/home/user/student-career-intelligence-system` (Linux container). Content is the same git tree.
- No hosted Supabase access. Nothing in this inventory was read from or written to `rrabxkxqyrgbgakwljmf`. Statements about the hosted database are **[DOC]** (STEP-03…08) or **[NOT VERIFIABLE HERE]**.
- To test the SQL, I replayed all eight migrations, the catalog import, and the repo's SQL assertion files on a **throwaway local PostgreSQL 16.14 + pgvector**, with a scratch stand-in for Supabase's `storage` and `extensions` schemas (kept out of the repo). Storage-policy behavior was therefore **not** exercised by real Supabase Storage.
- `NEXT-STEPS-END-TO-END-ROADMAP.md` was listed as required reading but **does not exist** in the repository. Phase 0 creates it.

---

## 1. Repository components

```
.                                    git root
├── README.md, MASTER.md, registry.json, events.jsonl, agent-01-status.md
├── assessments/supabase-plan.md     source-code assessment + migration plan (2026-09-27)
└── implementations/
    ├── STEP-01.md … STEP-08.md      per-step implementation records
    ├── run-local.sh, stop-local.sh  macOS/zsh launcher (see §9)
    ├── tests/                       cross-project tests (signup roles, schema migrations)
    ├── jsom-planner/                degree planner (Express + React)
    ├── syllabus-check/              syllabus ↔ job-market analysis (FastAPI + Celery + React)
    ├── supabase-foundation/         Supabase CLI project: migrations, imports, SQL tests
    └── reports/                     DOCX report builder + two generated reports
```

214 tracked files at the base commit. Registry lists one agent (`agent-01`) whose deliverable (a TXT-only resume/matching MVP, "Campus Match") lives **outside this repository** at a path under `/Users/.../Codex/...`; its source is not here. **[READ]**

| Component | Stack | Role today | Size / maturity |
|---|---|---|---|
| JSOM Planner backend | Node 20, Express 4.21, `pg` 8.13, helmet, express-rate-limit | Catalog + student degree planning + admin | 7 route files, 3 services, 1 DB adapter |
| JSOM Planner frontend | React + Vite | Student and admin UI | 9 pages |
| SyllabusCheck backend | Python 3.11, FastAPI 0.111, SQLAlchemy 2 async, Celery 5.4, Redis | Syllabus upload/parse, job scrape, keyword extraction, coverage, reports | 8 route modules, 5 task modules |
| SyllabusCheck frontend | React 18 + TypeScript + Vite + Tailwind | Dashboards, job explorer, coverage, reports | 12 pages |
| Supabase foundation | Supabase CLI 2.x, plain SQL | Identity, schemas, RLS, buckets, import manifests | 8 migrations |
| Reports | python-docx | ITM and BA market-alignment DOCX | 1 builder, 2 outputs |
| Agent files | JSON/Markdown | Registry + master design | Documentation only; no runtime |

---

## 2. Application entry points

| Entry point | File | Port | Notes |
|---|---|---|---|
| JSOM API | `jsom-planner/backend/src/server.js` | 5000 | `GET /health` |
| JSOM UI (dev) | `jsom-planner/frontend` (`vite`) | 3000 / 5173 | Proxies `/api` → `localhost:5000` |
| JSOM UI (container) | `frontend/Dockerfile` → nginx | 3000 | `nginx.conf` proxies `/api/` → `backend:5000` |
| SyllabusCheck API | `syllabus-check/backend/main.py` (uvicorn) | 8000 (8080 on Railway) | `GET /api/health`, `/api/docs` |
| SyllabusCheck worker | `celery -A core.celery_app worker` | — | Needs Redis |
| SyllabusCheck scheduler | Celery beat (`core/celery_app.py`) | — | See §9 (job sources) |
| SyllabusCheck UI | `syllabus-check/frontend` (`vite`) | 5173 | `VITE_API_URL` in prod (Vercel) |
| Local launcher | `implementations/run-local.sh` | 3000, 5000, 5173, 8000 | zsh + macOS Keychain |
| Report builder | `implementations/reports/build_degree_market_reports.py` | — | Calls live public feeds |
| Catalog import | `supabase-foundation/imports/*.sql`, `scripts/*.py` | — | Hash-pinned allowlist import |
| Focused market import | `syllabus-check/backend/scripts/import_focused_market.py` | — | Pilot job import |

The two applications have **separate ports, separate frontends, separate API origins, and no shared shell**. There is no unified portal.

---

## 3. Frontend routes

### 3.1 JSOM Planner (`jsom-planner/frontend/src/App.jsx`) **[READ]**

| Route | Guard | Page |
|---|---|---|
| `/login`, `/register` | public | Login, Register |
| `/` | — | Role redirect |
| `/dashboard` | student | Degree progress |
| `/my-courses` | student | Student courses |
| `/catalog` | student | Course catalog |
| `/schedule` | student | Schedule builder |
| `/admin/overview` `/admin/programs` `/admin/students` `/admin/courses` `/admin/graph` `/admin/settings` | `role="admin"` | Admin pages |

`LoginPage.jsx` renders the legacy demo credentials (`admin@utdallas.edu` / `password123`, `demo.student@utdallas.edu` / `password123`). Those accounts do not exist in Supabase Auth (STEP-06 states they were excluded). The UI therefore advertises dead credentials. **[READ]**

### 3.2 SyllabusCheck (`syllabus-check/frontend/src/App.tsx`) **[READ]**

| Route | Page |
|---|---|
| `/` (login if no token), `/register` | Login, Register |
| `/dashboard` | Dashboard |
| `/syllabi` | Syllabi upload/list |
| `/jobs` | Job explorer |
| `/coverage` | Coverage matrix |
| `/gaps` | Gap analysis |
| `/reports` | Reports |
| `/program-gap`, `/program-report` | Program gap analysis / report |
| `/market-alignment` | ITM/BA market alignment |
| `*` | → `/dashboard` |

An `OAuthCallback.tsx` page exists but the Google OAuth router is not mounted (STEP-04). **[READ]**

### 3.3 Not present

No routes exist for: onboarding (program, catalog year, location, interests, graduation term), resume upload/review, profile, matching, subject recommendations, roadmap, report/export/deletion, or consent.

---

## 4. Backend endpoints **[READ]**

### 4.1 JSOM (Express)

| Mount | Auth | Endpoints |
|---|---|---|
| `/health` | none | status |
| `/api/auth` | mixed | `POST register, login, refresh, change-password`, `POST logout`, `GET me` (latter two authenticated) |
| `/api/programs` | GET public; writes admin | `GET /`, `GET /:id`; admin `PUT /:id`, core-course add/remove, concentration CRUD + course add/remove |
| `/api/courses` | GET public; writes admin | `GET /`, `/subjects`, `/:id`, `/:id/prereq-chain`; admin `POST /`, `PUT /:id`, prerequisite add/remove |
| `/api/students` | authenticated student/admin | `GET dashboard, courses, check-prerequisites/:courseId, eligible-courses`; `POST/PATCH/DELETE courses`; `PUT profile` |
| `/api/schedule` | authenticated | `GET /`, `GET sections/:courseId`, `POST enroll` |
| `/api/admin` | authenticated + admin | `GET stats, students, audit-log, graph/stats`; `POST users` (returns 410), `POST courses/bulk-update`, `POST graph/refresh`; `PATCH users/:id/toggle-active` |
| `/api/nebula` | **none** | `GET course, section, grades` (proxy to UTD Nebula API when key configured) |

Global: helmet, CORS pinned to `FRONTEND_URL`, 200 req / 15 min general limit, 20 / 15 min on `/api/auth`, 10 MB JSON body limit, `trust proxy 1`.

### 4.2 SyllabusCheck (FastAPI)

| Prefix | Endpoints | Auth as written |
|---|---|---|
| `/api` | `GET /health` | none |
| `/api/auth` | `POST register, login, refresh, logout`, `GET me` | Supabase-backed |
| `/api/courses` | `GET/POST programs`, `POST programs/{id}/upload`, `POST upload`, `GET /`, `GET/DELETE /{id}` | `get_current_user` |
| `/api/jobs` | `GET /`, `/stats`, `/sources`; `POST /scrape` (admin) | mixed |
| `/api/jobs` | `POST admin/trigger-keyword-extraction`, `POST reparse-all`, `POST recompute-coverage-all`, `POST reparse-empty` | **no auth dependency** (see §13, R-1) |
| `/api/jobs` | `POST admin/trigger-keyword-extraction-today` | admin |
| `/api/keywords` | `GET /`, `/stats`, `/trending`, `/emerging`, `/subdomain-stats` | authenticated |
| `/api/keywords` | `POST classify-subdomains`, `POST backfill-embeddings` | authenticated, **not admin-restricted** (R-5) |
| `/api/coverage` | `GET matrix, /{id}, /{id}/gaps`; `POST /{id}/compute`, `POST program-gap` | authenticated |
| `/api/reports` | `GET /`, `/market-alignment`; `POST generate`; `GET /{id}/download/{pdf,xlsx}`; `DELETE /{id}` | authenticated |

The Google OAuth router `api/routes/google_auth.py` exists but is **not mounted** in `main.py`.

### 4.3 Endpoints that cannot work from a clean checkout

- `api/routes/coverage.py` and `tasks/coverage_tasks.py` import `services.coverage.engine` and `services.coverage.gap_analyzer`. **That package is not in the repository.** Root `.gitignore` contains `coverage/`, which matches `services/coverage/` (`git check-ignore -v` confirms rule `.gitignore:17`). The coverage engine was never committed. **[RAN]** — this means coverage matrix, gap analysis, coverage compute, and the daily coverage recompute task cannot run from this repo. Prior test claims (STEP-08 "five unit tests pass") do not touch this module.
- JSOM admin endpoints `stats`, `students`, `audit-log` query `users` and `audit_log`; `graph/refresh` refreshes `course_graph`; `toggle-active` updates `users`. The runtime search path is `api_jsom,catalog,planner,public`. After applying all migrations locally, `public.users`, `api_jsom.users`, `api_jsom.audit_log`, and `api_jsom.course_graph` do not exist. **[RAN]** These admin routes will fail at runtime. Separately, `authenticated` holds only `SELECT` on the `api_jsom` catalog views, so admin catalog writes (`PUT /api/programs/:id`, course edits, core-course/concentration edits) would fail with permission errors; there is no admin write path in the schema. **[RAN: grants listing]**

---

## 5. Database schemas and tables

Source: eight migrations in `supabase-foundation/supabase/migrations/`. Replayed on local PG 16.14 + pgvector. **[RAN]**

| Schema | Tables | Purpose | Browser-role access |
|---|---|---|---|
| `public` | `profiles` | One row per Auth user | `authenticated`: SELECT, UPDATE (own row) |
| `private` | `app_roles`, `advisor_notes`, `processing_jobs`, `audit_log`, `import_runs`, `import_counts`, `import_rejections` | Roles, notes, audit, import manifests | **None** |
| `catalog` | `departments`, `programs`, `program_versions`, `courses`, `course_prerequisites`, `program_core_courses`, `concentrations`, `concentration_courses`, `course_sections` | Reference catalog | `authenticated` SELECT; `anon` SELECT (added in migration 5) |
| `planner` | `students`, `student_courses` | Student-owned plan | `authenticated` full CRUD under RLS |
| `syllabus` | `program_groups`, `documents`, `job_postings`, `keywords`, `job_keywords`, `coverage_runs`, `coverage_rows`, `reports` | Syllabus + market data | Reference tables SELECT; owner tables CRUD under RLS; `coverage_runs` SELECT |
| `api_jsom` | 10 views | JSOM compatibility layer, `security_invoker=true` | `anon`/`authenticated` per view |
| `api_syllabus` | 7 views | SyllabusCheck compatibility layer, `security_invoker=true` | `authenticated` per view |

**27 base tables total** across `public`, `private`, `catalog`, `planner`, `syllabus`. Extensions: `vector`, `pg_trgm` (in `extensions`). `syllabus.keywords` carries `vector(384)` embeddings (all-MiniLM-L6-v2).

**Schemas required by the target design that do not exist yet:** `profile`, `market` (as defined in the prompt), `matching`, `roadmap`, `orchestration`. The `private` tables `administrative_assignments`, `security_findings`, `finding_occurrences`, `processing_errors` also do not exist (closest today: `app_roles`, none, none, `processing_jobs`).

Current `syllabus.job_postings` is a mutable table. There are **no immutable snapshots, content hashes, last-seen dates, closed/expired status, source-run records, or source-health tables.**

### Hosted data **[DOC]**

STEP-06: 15 departments, 39 programs, 39 program versions (2025), 331 courses, 293 core assignments, 72 concentrations, 649 concentration assignments, 188 prerequisites loaded, 14 quarantined. STEP-08: 18 pilot jobs, 78 job-skill links. No student records, Auth users, syllabi, or reports.

**Local re-derivation [RAN]:** extraction scripts verified source hashes (`8e89987b…`, `aacd7542…`) and counts; after import, `catalog.course_prerequisites` = 188 and `private.import_rejections` = 14. This reproduces the STEP-06 numbers from source files, but only on local PostgreSQL, not the hosted instance.

---

## 6. Migrations

| Version | Purpose | Applies on PG 16 + pgvector [RAN] |
|---|---|---|
| `202609270001_identity_foundation` | `profiles`, `private.app_roles`, signup trigger, `enroll_application`, `get_my_app_roles` | yes |
| `…0002_application_data` | Schemas, catalog/planner/syllabus tables, RLS, grants, buckets, storage policies | yes (with storage stub) |
| `…0003_student_data_hardening` | Verified-grade protection trigger, owner-bound path checks | yes |
| `…0004_import_foundation` | Import manifests, catalog-fidelity columns | yes |
| `…0005_jsom_runtime_adapter` | `api_jsom` views, anon catalog read | yes |
| `…0006_runtime_audit` | `private.audit_log`, `public.log_app_event` | yes |
| `…0007_syllabus_runtime_adapter` | `api_syllabus` views, extra policies | yes |
| `…0008_program_view_write_fix` | Replaces `api_syllabus.programs` view | yes |

Other migration systems still in the tree:

- Alembic (`syllabus-check/backend/migrations/versions`): `001 → 007 → 008 → 009 → 010 → 011_supabase_identity`. This is the legacy standalone SyllabusCheck database, **not** the Supabase schema. **[READ]**
- JSOM legacy SQL (`database/schema.sql`, `structural/001`, `structural/002_supabase_identity.sql`, `migrations/*.sql`). Legacy standalone database; `migrations/*.sql` are unreviewed catalog rewrites. **[READ]**

The repo therefore holds **two parallel, non-reconciled data models**: the legacy per-app databases and the Supabase schemas. The Supabase model is the strategic target (STEP-05 onward). Code reality: JSOM runtime queries only the Supabase views; SyllabusCheck's ORM models (`models/models.py`) and Celery tasks (`create_engine(settings.DATABASE_URL…)`) still assume the legacy table layout. **[READ]** — no verification that SyllabusCheck's ORM maps to the Supabase `api_syllabus` views for every model.

---

## 7. RLS policies **[RAN]**

All 27 base tables have `relrowsecurity = true`. **None has `FORCE ROW LEVEL SECURITY`.** (Table owners and `BYPASSRLS` roles bypass RLS. The design depends on the runtime role being non-owner and non-`BYPASSRLS`; that role configuration is not in the migrations.)

| Table group | Policies |
|---|---|
| `public.profiles` | `profiles_select_own`, `profiles_update_own` |
| `private.*` (7 tables) | RLS on, **no policies**, no grants → denied to browser roles |
| `catalog.*` (9 tables) | `catalog_read` (authenticated, `true`), `catalog_anon_read` (anon, `true`) |
| `planner.students` | owner SELECT/INSERT/UPDATE/DELETE on `user_id = auth.uid()` |
| `planner.student_courses` | `student_course_owner` (ALL, parent-ownership check) + verified-record trigger |
| `syllabus.documents`, `reports` | `document_owner`, `report_owner` (ALL on `owner_id = auth.uid()`) |
| `syllabus.program_groups` | read-all reference (`syllabus_reference_read`) + `program_group_owner_write` |
| `syllabus.job_postings`, `keywords`, `job_keywords` | read-all for authenticated |
| `syllabus.coverage_runs` | owner via document |
| `syllabus.coverage_rows` | owner via document (read and write) |

SECURITY DEFINER functions (5): `private.handle_new_auth_user`, `private.has_app_role`, `public.enroll_application`, `public.get_my_app_roles`, `public.log_app_event`. All set `search_path` to empty or explicit and revoke from `public`/`anon`. **[READ]**

Assertions executed locally and passing **[RAN]**:

- `identity_assertions.sql` — "identity integration assertions passed"
- `application_data_assertions.sql` — "application data isolation assertions passed"
- `import_reconciliation.sql` — "step 6 import reconciliation passed"
- `runtime_adapters_assertions.sql` — "runtime adapter assertions passed"

**Coverage gaps in those assertions:** they use `set role` + `set_config('request.jwt.claim.sub', …)` in one session; they do not test pooled-connection identity reuse, `anon` on every table, expired/invalid sessions, or cross-account access on `coverage_*`, `reports`, or `program_groups`. The pgTAP file `supabase/tests/identity_foundation.test.sql` needs the full Supabase stack and was **not run**.

---

## 8. Storage buckets and policies **[READ]** (policy behavior **[NOT VERIFIABLE HERE]**)

| Bucket | Limit | MIME | Policies |
|---|---|---|---|
| `syllabi` (private) | 20 MiB | PDF, DOCX, DOC | owner SELECT/INSERT/UPDATE/DELETE where `(storage.foldername(name))[1] = auth.uid()::text` |
| `reports` (private) | 50 MiB | PDF, XLSX | owner SELECT/DELETE; owner INSERT/UPDATE added in migration 7 |

Notes:

- Migration 7 grants **owners** INSERT/UPDATE on `reports`. STEP-05 describes report creation as "reserved for trusted workers". The deployed policy and the document disagree; the backend uploads reports with the user's token, so this follows the code path, not the STEP-05 text.
- No `resumes` bucket exists. Resume storage is a Phase 4 deliverable.
- Signed-URL expiry is not implemented; downloads go through the backend with the user token (STEP-07).

---

## 9. Authentication flows **[READ]** unless noted

1. **Signup.** JSOM `POST /api/auth/register` and SyllabusCheck `POST /api/auth/register` call Supabase `/auth/v1/signup` with the publishable key. Role is not accepted from the client. `on_auth_user_created` creates a `profiles` row with no role. After login, `enroll_application` grants baseline `student` (JSOM) or `professor` (SyllabusCheck).
2. **Email verification.** `supabase/config.toml` has `[auth.email] enable_confirmations = false`. **Accounts are usable without verifying email** in the local config. The hosted setting is **[NOT VERIFIABLE HERE]**. The product requirement is "creates **and verifies** an account".
3. **Login / refresh / logout.** Password grant against Supabase; refresh via refresh-token grant; logout `scope=local`.
4. **Per-request verification.** Both backends call `/auth/v1/user` on every protected request (network round trip; no local JWT verification).
5. **Database identity.** Per request, in one transaction: `SET LOCAL ROLE authenticated`, `set_config('request.jwt.claim.sub', uid, true)`, `set_config('search_path', …, true)`. JSOM does this in `db/index.js` (`query`, `withTransaction`); SyllabusCheck in `establish_user_context`. Transaction-local, so pooled connections do not retain identity by construction. **No test proves it** (R-8).
6. **Roles.** `get_my_app_roles()` via PostgREST RPC; backends map to `admin` / `student` / `professor` / `catalog_editor`. No UI or API creates privileged roles. `private.app_roles` can only be changed by a database administrator.
7. **Google OAuth.** Not mounted; login control disabled.
8. **JSOM `change-password`** and legacy local-user paths: replaced by Supabase or return 410.

Residual concern: `SET LOCAL ROLE authenticated` only works if the connecting database role is a member of `authenticated`. The connection string in `run-local.sh` is the Supabase pooler with the **database owner password** (`postgres`). That is the owner/`BYPASSRLS`-capable role, switched down per transaction. Any code path that queries **outside** `query()`/`withTransaction()` runs with full privileges. (R-2)

---

## 10. Current job sources and market collection

### 10.1 Sources in code **[READ]**

| Source | Where | Type | Status in code | Terms / robots documented? |
|---|---|---|---|---|
| Arbeitnow API | `focused_market.py` | Public JSON API | active (pilot import) | attribution string only |
| Remotive API | `focused_market.py` | Public JSON API | active | attribution string only |
| Remote OK API | `focused_market.py` | Public JSON API | active | attribution string only |
| Jobicy API | `focused_market.py` | Public JSON API | active | attribution string only |
| Himalayas API | `focused_market.py` | Public JSON API | active | attribution string only |
| Indeed HTML | `job_scraper.py` (`scrape_indeed`) | **HTML scrape with browser-spoofing User-Agent** | defined, **not called** by any task, scheduler, or route (grep) — dormant but one call away | **no** |
| USAJobs API | `job_scraper.py` (`scrape_usajobs`) | Government API | defined, **not called** | `User-Agent` is a hard-coded personal-style email |
| Remotive / Arbeitnow (legacy) | `job_scraper.py`, used by `scrape_single_source` and `scheduler.py` | Public API | **active** via admin-triggered scrape | no |
| JSearch (RapidAPI) | `jsearch_scraper.py` | Paid aggregator (resells search-engine job data) | **active in the Celery beat schedule** (cities daily, states weekly, country/global bi-monthly); needs `RAPIDAPI_KEY` | no — redistribution/retention terms unreviewed |
| Adzuna | `adzuna_scraper.py` | API | present, needs keys | no |
| GitHub internship README lists | `github_scraper.py` | Markdown scraping of 3 community repos | **active** via `scrape_single_source('github')` and `scheduler.py` | no |

None of the prompt's required source-approval fields (terms, robots policy, rate limits, retention, permitted use, geographic coverage, data-quality limits) is recorded anywhere. Only "attribution" strings exist for the five feed sources.

### 10.2 Scheduling **[READ]**

Celery beat: city scrape daily 02:00, state scrape weekly (Mon), country/global scrape on the 1st and 16th, keyword extraction daily 02:30, coverage recompute daily 05:00 (registered **twice** under two names), timezone `America/Chicago`. Bounded retry, exponential backoff, per-source rate limits, circuit breakers, health tracking, structure-change detection, and empty-snapshot protection are **not implemented**. `focused_market.collect_focused_market_jobs` silently drops any source that raised (`isinstance(result, Exception): continue`). The importer is run manually.

### 10.3 What is stored **[READ]**

`syllabus.job_postings` (mutable): source, external id, title, company, location, description, URL, posted/scraped timestamps. Missing versus requirement: normalized title, employment type, experience level, salary, last-seen date, content hash, source run, closed status, extraction version, immutable snapshot.

### 10.4 Geographic and size reality **[DOC]**, consistent with STEP-08

Pilot: 18 jobs (10 ITM, 8 BA), labeled `pilot`, primarily European/remote. No Dallas/Texas/US collection has run. All five approved feeds are remote-job boards, so Dallas/Fort Worth and Texas on-site coverage is structurally absent. Only the USAJobs and Adzuna code could supply US-located roles, and neither has been validated.

---

## 11. Current skill-extraction approach

Two unrelated mechanisms exist:

| Mechanism | File | Behavior | Concern |
|---|---|---|---|
| Deterministic dictionary | `services/scraper/focused_market.py` | 46 named skills via regex; description-only; counted once per job | Closest to the "description-backed only" rule. No versioning, no spans, `\bapis?\b` maps to "REST API" (over-broad), "Git" matches "github", "Excel" matches "spreadsheets". No evaluation set. |
| LLM extraction | `services/nlp/keyword_extractor.py`, `tasks/nlp_tasks.py` | Claude prompt returns JSON with department/subdomain; sentence-transformer embeddings (`all-MiniLM-L6-v2`) | Non-deterministic; sends job text to an external API; prompt says "Never miss a skill — extract even if you have never seen it before"; classifies by **UTD department**, not ITM/BA skill taxonomy; no text spans; `config.py` and README still say OpenAI embeddings. Uses the pinned `anthropic==0.28.0` and a hard-coded model name in the call path. |

Role classification (`market_alignment.classify_job`) matches **title phrases only** against 10 ITM and 11 BA role-family phrase lists. There are no versioned role-taxonomy records, no experience-level separation (internship/entry/mid/senior), no exclusion rules, and no skill taxonomy table (canonical names, aliases, status, observed dates).

---

## 12. Report generation

| Output | Generator | Notes |
|---|---|---|
| PDF/XLSX coverage reports | `services/reports/generator.py` (reportlab, openpyxl) | Stored in private `reports` bucket (STEP-07); downloaded via authenticated backend |
| Market-alignment JSON | `services/reports/market_alignment.py` | Served at `GET /api/reports/market-alignment`; labels `pilot` below 30 jobs |
| ITM and BA DOCX | `implementations/reports/build_degree_market_reports.py` | Collects live feeds at run time; output committed in repo. I did **not** open or render the DOCX files; their content is unreviewed here |

No student-facing report (private, per-student), export, or deletion workflow exists.

---

## 13. Local launch process

`implementations/run-local.sh` (zsh; `stop-local.sh` likewise) **[READ]**:

- Requires macOS tooling: `security` (Keychain), `/opt/homebrew/bin/python3.11`, `lsof`, zsh.
- Reads the Supabase pooler URL from `supabase-foundation/supabase/.temp/pooler-url` (gitignored) and the DB password and publishable key from Keychain.
- Starts the JSOM API, JSOM UI, SyllabusCheck API, and SyllabusCheck UI against the **hosted dev Supabase project**. It does **not** start Celery or Redis, so scraping, keyword extraction, parsing tasks, and coverage tasks do not run locally.
- Needs `syllabus-check/.venv` to already exist.

It cannot run on Linux or in CI. **Not run here** (platform).

Legacy launch paths:

- `jsom-planner/docker-compose.yml`: starts plain `postgres:15` with legacy `schema.sql`/seed. The Step 7 adapter issues `SET LOCAL ROLE authenticated` and queries `api_jsom` views, which do not exist in that database; the compose path is **stale** and cannot serve the current backend. Static analysis only; not executed (Docker not run).
- `syllabus-check/docker-compose.yml` + `Makefile`: legacy Postgres/Redis/Celery stack; likely stale for the same reason. Not executed.

---

## 14. Tests and current status

| # | Test | Command | Result [RAN] |
|---|---|---|---|
| T1 | SyllabusCheck unit tests (`test_focused_market.py`, `test_market_alignment.py`) | `pytest tests` in `syllabus-check/backend` | **7 passed** |
| T2 | JSOM signup-role test (Node) | `node --test tests/signup-roles.cjs` | **FAIL** — `Error: '../services/supabaseAuth'`: the test's `require` mock no longer covers the module the handler now requires (post-STEP-04 refactor) |
| T3 | SyllabusCheck signup-role test (Python) | `python -m unittest tests/test_signup_roles.py` | **FAIL, 5 errors** — `NameError: name 'supabase_auth' is not defined` in the extracted handler |
| T4 | Schema migration tests (Alembic + JSOM bootstrap) | `STEP2_PGHOST=… python -m unittest tests.test_schema_migrations` | **2 pass, 1 FAIL** — expects head `010_schema_alignment`; head is now `011_supabase_identity` |
| T5 | `identity_assertions.sql` | local PG | **pass** |
| T6 | `application_data_assertions.sql` | local PG | **pass** |
| T7 | `import_reconciliation.sql` | local PG after import | **pass** |
| T8 | `runtime_adapters_assertions.sql` | local PG after import | **pass** |
| T9 | `supabase/tests/identity_foundation.test.sql` (pgTAP, 18 assertions) | needs Supabase stack | **not run** |
| T10 | JSOM backend syntax check (`node --check` on 100% of `src/**/*.js`) | | **pass** |
| T11 | JSOM frontend production build | `npm ci --legacy-peer-deps && npm run build` | **pass** (chunk-size warning) |
| T12 | SyllabusCheck frontend build | `npm ci && npm run build` | **pass** (chunk-size warning) |
| T13 | SyllabusCheck backend full import / app start | | **not run** — heavy ML deps (torch, spaCy, sentence-transformers) not installed; and `services.coverage` is missing |
| T14 | End-to-end / HTTP smoke / TLS | | **not run** — needs `DB_SSL_CA` + hosted creds |

Items T2–T4 show that **three of the four security/regression tests that protect the signup-role fix and migration chain are stale and failing**. The role-escalation fix itself is plausible from code (`register` ignores client roles), but the guarding tests do not currently prove it.

There are no tests for: API contracts, MCP, storage policies, pooled-connection identity, expired sessions, parser rejection, scraper resilience, matching, recommendations, roadmap, workers, backup/restore, performance, accessibility, or end-to-end flows. Frontends have no test runners.

CI: `syllabus-check/.github/workflows/ci.yml` is nested under a subdirectory, so **GitHub does not execute it**. If it were moved to the repository root, it would run `pytest tests/` (7 tests), build one frontend, and **deploy to Railway and Vercel on pushes to `main`** using repository secrets. No root-level workflows exist. **[READ]**

---

## 15. Environment variables

| Variable | Used by | Secret? | Notes |
|---|---|---|---|
| `SUPABASE_URL` | both backends | no | Hosted dev project URL appears in docs and `.env.example` |
| `SUPABASE_PUBLISHABLE_KEY` | both backends | publishable | Not in repo; Keychain |
| `DATABASE_URL` | both backends | **yes** | JSOM `postgresql://`, SyllabusCheck `postgresql+asyncpg://`; contains DB owner password in `run-local.sh` flow |
| `DB_SSL_CA` | both backends | no | Required when production; points to Supabase root cert. A cert file `certs/supabase-root-2021.pem` is committed |
| `NODE_ENV`, `PORT`, `FRONTEND_URL` | JSOM | no | |
| `JWT_SECRET` | JSOM compose, README | **yes (legacy)** | Compose sets a fixed dev value. The code no longer reads it for auth (STEP-04), so this is residual |
| `NEBULA_API_KEY` | JSOM nebula route | yes | Optional |
| `APP_ENV`, `DEBUG`, `SECRET_KEY`, `JWT_SECRET_KEY` | SyllabusCheck | yes | Defaults `change-me`, `change-me-in-production` in `core/config.py`; `DEBUG` defaults `True` |
| `REDIS_URL`, `CELERY_BROKER_URL`, `CELERY_RESULT_BACKEND` | SyllabusCheck | maybe | |
| `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `OPENAI_*` | SyllabusCheck | yes | `ANTHROPIC_API_KEY` is actually used; `OPENAI_*` settings are stale |
| `RAPIDAPI_KEY`, `ADZUNA_APP_ID`, `ADZUNA_APP_KEY` | scrapers | yes | |
| `GOOGLE_CLIENT_ID/SECRET/REDIRECT_URI` | legacy OAuth | yes | Router not mounted |
| `UPLOAD_DIR`, `REPORT_DIR`, `MAX_UPLOAD_SIZE_MB`, `ALLOWED_EXTENSIONS` | SyllabusCheck | no | |
| `SCRAPE_INTERVAL_HOURS`, `MAX_JOBS_PER_SOURCE`, `PLAYWRIGHT_HEADLESS` | scrapers | no | |
| `CORS_ORIGINS` | SyllabusCheck | no | |
| `VITE_API_URL` | SyllabusCheck frontend | no | Vercel deployment |
| `TRUST_PROXY` | JSOM compose | no | |
| `STEP2_PGHOST`, `STEP2_PGPORT` | migration test | no | |

There is no single root `.env.example`. `.gitignore` excludes `.env` and `.env.*`, with `!.env.example`.

---

## 16. External dependencies and services

| Dependency | Use | Version evidence |
|---|---|---|
| Supabase (Auth, Postgres, Storage, PostgREST RPC) | Identity, data, files | Hosted dev `jsom-syllabus-dev` (East US) **[DOC]** |
| Redis | Celery broker/result | docker-compose / Railway |
| Anthropic API | LLM keyword extraction / subdomain classification | `anthropic==0.28.0` |
| OpenAI | stale config; `openai==1.35.13` pinned | unused in the extraction path I read |
| sentence-transformers / torch / spaCy | Embeddings, NLP | Heavy (CPU torch) |
| UTD Nebula API | Course sections/grades (optional) | needs key |
| Job feeds | See §10 | |
| Railway (API + worker + Postgres + Redis), Vercel (frontend) | Deployment of SyllabusCheck | `railway.toml`, `railway.main.toml`, `vercel.json`, ci.yml |
| Docker / nginx | Container builds | Dockerfiles run as root (no `USER`) |
| Supabase CLI 2.x | Migrations | `supabase-foundation/package.json` |

Dependency vulnerability scan **[RAN]**:

- `npm audit --omit=dev`: JSOM backend **9** (1 low, 5 moderate, 3 high); JSOM frontend **5** (all high); SyllabusCheck frontend **9** (6 moderate, 3 high). Includes the `validator`/`express-validator` advisory (GHSA-vghf-hv5q-vc2g).
- `pip-audit --no-deps` on directly pinned Python packages: **39 advisories in 5 packages** — `python-multipart 0.0.9` (fix ≥ 0.0.31), `python-jose 3.3.0`, `authlib 1.3.1` (fix ≥ 1.6.12), `sentence-transformers 3.0.1`, `python-dotenv 1.0.1`. Transitive dependencies were **not** audited. `numpy` (range-pinned) and `torch` were skipped.

---

## 17. Deployment files

| File | Target | Notes |
|---|---|---|
| `syllabus-check/railway.toml` | Railway **worker** | Header says worker; start command is the Celery worker |
| `syllabus-check/railway.main.toml` | Railway API | NIXPACKS; `uvicorn … --port 8080` |
| `syllabus-check/backend/nixpacks.toml`, `Dockerfile` | build | |
| `syllabus-check/frontend/vercel.json`, `Dockerfile`, `nginx.spa.conf`, `docker-entrypoint.sh` | Vercel / container | SPA rewrite |
| `syllabus-check/.github/workflows/ci.yml` | GitHub Actions | **Inert** (wrong location) |
| `syllabus-check/infra/docker/init.sql`, `infra/nginx/nginx.conf` | local | |
| `jsom-planner/docker-compose.yml`, `*/Dockerfile`, `frontend/nginx.conf` | local container | Stale (§13) |
| `SyllabusCheck_AI_(4).pptx`, `Progress_logs.docx` under `syllabus-check/` | docs | Not reviewed (binary); STEP assessments also did not review them |

The README references `railway.worker.toml`; that file does not exist (the worker config is in `railway.toml`). A publicly named Vercel demo URL appears in the SyllabusCheck README. **Staging and production environments do not exist**; only a hosted dev Supabase project is documented.

---

## 18. Known security risks

Severity is my assessment from code and run evidence. IDs are referenced by the ADRs and the roadmap.

| ID | Sev | Risk | Evidence |
|---|---|---|---|
| R-1 | **High** | **Unauthenticated mutation endpoints** on SyllabusCheck: `POST /api/jobs/admin/trigger-keyword-extraction` (queues up to 5,000 LLM-priced jobs), `/reparse-all`, `/recompute-coverage-all`, `/reparse-empty` (the last also mutates `Course.status`). They have no auth dependency. `reparse-empty` and `reparse-all` read via `get_db`, which does **not** set an identity or drop role. | [READ] `api/routes/jobs.py` |
| R-2 | **High** | Runtime connects as the database owner role and relies on `SET LOCAL ROLE`; non-RLS code paths (unauthenticated endpoints above, Celery tasks using `create_engine(DATABASE_URL)`) run with elevated privileges. No dedicated runtime/worker/migration roles exist. | [READ] `core/database.py`, `tasks/coverage_tasks.py`, `run-local.sh` |
| R-3 | **High** | Dependency vulnerabilities (39 Python, 23 npm direct+transitive production) including `python-multipart` (upload parsing — directly on the new resume upload path) and `authlib`/`python-jose`, which are no longer needed for auth. | [RAN] |
| R-4 | **Med-High** | Email confirmation disabled in checked-in Auth config; hosted state unknown. Product requires verified accounts. | [READ] `config.toml` |
| R-5 | **Medium** | Any authenticated user (including self-enrolled `professor`) can enqueue `classify-subdomains` and `backfill-embeddings` Celery tasks (external-API cost, DoS). | [READ] `api/routes/keywords.py` |
| R-6 | **Medium** | `FORCE ROW LEVEL SECURITY` not enabled on any table; protection depends on the runtime role never being an owner/`BYPASSRLS`. Role setup is not in migrations. | [RAN] |
| R-7 | **Medium** | Scraping posture: a dormant Indeed HTML scraper with a browser-spoofing `User-Agent` (uncalled today); active JSearch aggregator and GitHub-README collection with no terms/robots/retention review; hard-coded personal-style email as USAJobs User-Agent in uncalled code. Compliance and retention exposure. | [READ] `job_scraper.py` |
| R-8 | **Medium** | Pooled-connection identity isolation (transaction-local config) is implemented but **untested**. Expired/invalid-session handling untested (backends call `/auth/v1/user` and map errors to 401, but no test). | [READ] |
| R-9 | **Medium** | Student-authored `coverage_rows` write access: `authenticated` has INSERT/UPDATE/DELETE on `syllabus.coverage_rows` (owner-scoped via document). Derived analytics are therefore user-writable, which would break the integrity of any score derived from them. | [RAN] grants |
| R-10 | **Medium** | `reports` bucket allows owner INSERT/UPDATE; STEP-05 states creation is worker-only. Users can write arbitrary files under their own prefix in `reports` (limited by bucket MIME and size). | [READ] migration 7 |
| R-11 | **Medium** | JSOM `/api/nebula/*` and catalog GET endpoints are unauthenticated and rate-limited only by the general limiter (200 / 15 min); `nebula` makes outbound calls with the server key. | [READ] |
| R-12 | **Low-Med** | Docker images run as root; no resource limits; nginx images unpinned (`nginx:alpine`). | [READ] |
| R-13 | **Low-Med** | Stale demo credentials displayed on the JSOM login page; `password123` in docs and seed. Accounts do not exist in Supabase, but the UI advertises weak defaults. | [READ] |
| R-14 | **Low** | Residual default secrets in code/config (`change-me`, fixed compose `JWT_SECRET`), `DEBUG` default true. | [READ] |
| R-15 | **Low** | Supabase project ref and dev URL committed in docs/examples (identifier, not a credential). Root certificate committed (public). No private keys or tokens found by regex scan for common patterns (OpenAI/AWS/JWT/PEM private key/Supabase secret prefixes). Scan is pattern-based and not exhaustive. | [RAN] |
| R-16 | **Info** | Per-request round trip to `/auth/v1/user` plus an RPC for roles adds latency and an availability dependency; acceptable for pilot. | [READ] |
| R-17 | **Info** | No FERPA / institutional review recorded. Technical controls do not establish compliance. | prompt requirement |

---

## 19. Known data-quality limitations

| ID | Limitation | Source |
|---|---|---|
| D-1 | Job sample is 18 pilot records from remote/European boards; **no Dallas, Texas, or US on-site coverage**; no multiple collection dates; no trend data. | STEP-08 [DOC] |
| D-2 | No syllabi are loaded; every curriculum-alignment score is `not_assessed`. No approved course-to-skill evidence exists. | STEP-08 [DOC] |
| D-3 | 14 prerequisite edges quarantined for missing courses (e.g., BUAN 6340 → MIS 6323). Eligibility checks that rely on catalog prerequisites are incomplete until resolved. | STEP-06 [DOC], reproduced [RAN] |
| D-4 | Catalog is a **2025** catalog extracted from a legacy seed file; other catalog years do not exist. Catalog years in the student flow cannot be selected. JSOM catalog data tables used by migrations contain unreviewed legacy rewrites (`database/migrations/*.sql`). | [READ] |
| D-5 | Title-only role classification; ITM vs BA assignment by phrase length; no experience-level, no exclusion rules. | [READ] |
| D-6 | Skill dictionary over-matches (`api`, `github`, `spreadsheet`) and has no evaluation set or false-positive rate. | [READ] |
| D-7 | Grades/GPA are self-reported; no verified academic records. | STEP-05 [DOC] |
| D-8 | Stored job text is plain-text-stripped HTML truncated to 20,000 characters. | [READ] |
| D-9 | `coverage` engine missing from the repo (§4.3); any coverage score cannot be reproduced from this repository. | [RAN] |
| D-10 | The DOCX market reports were generated from live feeds at a prior date; the committed copy is a snapshot, not reproducible from stored immutable data. | [READ] |

---

## 20. Missing components required by the prompt

Mapped to the 20 phases. "Exists" means present in some form; none is production-ready.

| Prompt requirement | Today | Phase |
|---|---|---|
| Portable root developer commands, aggregate health checks | None (macOS-only launcher) | 1 |
| Hosted HTTP smoke test, TLS verification | Not run; `DB_SSL_CA` missing | 2 |
| Unified portal, shared onboarding (program, catalog year, location, interests, graduation term) | Two separate apps, no onboarding | 3 |
| Profile schema (career_profiles, target_roles, preferences, projects, experiences, certifications, skill_evidence, resume_documents, consent_events) | None | 4 |
| Private `resumes` bucket, owner-bound paths | None | 4 |
| Resume upload, PDF/DOCX validation, bounded parser, versions, evidence strength, corrections, export, deletion, retention | None (a TXT-only prototype exists outside the repo) | 5 |
| Authorized ITM/BA syllabus intake, review workflow | Upload exists for professors; zero syllabi loaded; no authorization or review state | 6 |
| Course-to-skill evidence mapping with approval | None; coverage engine missing | 7 |
| Approved-source registry, per-source rate limits, scheduled workers, source docs | Five feed collectors, no registry or terms docs; risky scrapers present | 8 |
| Freshness labels, dedupe, immutable snapshots, change/removal detection, source health, circuit breakers, empty-snapshot protection | None | 9 |
| Versioned role and skill taxonomy with aliases, spans, evaluation | Dictionary only | 10 |
| Rules-first matching service with component scores, hard constraints, confidence, versions | None | 11 |
| Subject recommendation engine (gap × demand × degree × prerequisite × interest) | None. JSOM `eligible-courses` exists (prerequisite check only) | 12 |
| Semester roadmap with versions, decisions, locks, workload | None | 13 |
| MCP server, 16 tools, schemas, rate limits, idempotency, audit | None | 14–15 |
| Master Agent with durable records and state machine | Documentation + JSON registry only | 16 |
| Security Agent and findings tables | None | 17 |
| Full gate: backup/restore test, fairness/counterfactual evaluation, performance, accessibility, E2E | None | 18 |
| Staging pilot, production-readiness review, institutional/FERPA review | None | 19–20 |
| Separate runtime / worker / migration / admin DB identities | One owner role | 1–2, 4 |
| Staging and production environments | Only dev | 2, 19 |
| Secret scanning, dependency scanning in CI | None; CI inert | 1, 18 |
| Root-level CI | None | 1 |
| Export and deletion of student data | None | 5 |
| Threat model, incident procedure | None | 17–18 |
| `NEXT-STEPS-END-TO-END-ROADMAP.md` | Missing (created in Phase 0) | 0 |

---

## 21. Capability status labels (current)

| Capability | Label |
|---|---|
| Supabase Auth signup/login with server-assigned baseline roles | Implemented and verified at code + local SQL level; hosted behavior and email verification **Partially implemented** |
| Catalog data in Supabase (2025, 39 programs) | Implemented with remaining deployment input (hosted state **[DOC]**, local replay **[RAN]**) |
| Planner RLS (students, student_courses) | Implemented and verified locally (SQL assertions); hosted and pooled behavior unverified |
| Syllabus upload to private storage | Implemented with remaining deployment input |
| Market-alignment report (pilot) | Partially implemented (18 jobs, non-US) |
| Job-source approval, scheduled resilient collection | **Planned**; unsafe collectors **present** |
| Skill taxonomy, role taxonomy | **Planned** (dictionary only) |
| Coverage engine | **Blocked** (source missing from repo) |
| JSOM admin console | **Partially implemented** (read paths likely broken; write paths denied) |
| Resume/profile service | **Planned** |
| Matching, recommendations, roadmap | **Planned** |
| MCP server | **Planned** |
| Master Agent runtime | **Planned** (docs + registry only) |
| Security Agent | **Planned** |
| Unified portal | **Planned** |
| Root CI, aggregate health, HTTP smoke | **Planned** |
