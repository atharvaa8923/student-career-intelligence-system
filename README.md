# Student Career Intelligence System

This repository contains an end-to-end student career platform that connects curriculum analysis, degree planning, job-market evidence, and secure profile data.

## Components

- **SyllabusCheck** analyzes ITM and Business Analytics syllabi against skills found explicitly in job descriptions.
- **JSOM Planner** provides degree planning, course selection, scheduling, and student/admin workflows.
- **Supabase Foundation** defines shared identity, application data, row-level security, audit, and integration migrations.
- **Agent registry and status files** provide the foundation for a coordinating master agent and task-specific agents.
- **Reports** contain the generated ITM and Business Analytics market-alignment report and its reproducible document builder.

## Repository layout

```text
assessments/                     Architecture and database assessments
implementations/jsom-planner/    Degree-planning application
implementations/syllabus-check/  Curriculum and job-market analysis application
implementations/supabase-foundation/ Shared Supabase schema and migrations
implementations/reports/         Generated report and report builder
MASTER.md                         Master-agent operating design
registry.json                     Agent registry
events.jsonl                      Agent event history
```

Each application folder has its own setup instructions and environment-variable examples. Local `.env` files, dependencies, virtual environments, build output, and database runtime data are excluded from version control.

## Documentation and status

- `docs/phase-00/BASELINE-INVENTORY.md` — evidence-labeled inventory of what exists (2026-10-05).
- `docs/phase-00/PHASE-00.md` — Phase 0 record, verification, limitations, decisions requested.
- `docs/phase-01/PHASE-01.md` — Phase 1 record: root commands, CI, auth and dependency fixes.
- `docs/adr/` — ten architecture decision records (approved 2026-10-05).

Developer commands: `make help` (lint, tests, SQL replay, builds, secret scan, health, `dev-up`).
- `NEXT-STEPS-END-TO-END-ROADMAP.md` — phase tracker (Phases 0–20) and cross-phase backlog.

### Capability status (as of Phase 1)

| Capability | Status |
|---|---|
| Supabase schema, RLS, catalog import (replayed locally on PostgreSQL 16) | Implemented and verified locally; hosted state from STEP documents only |
| Supabase Auth in both backends | Partially implemented (email confirmation off in checked-in config; hosted setting unverified) |
| Syllabus upload to private Storage | Implemented with remaining deployment input (`DB_SSL_CA`) |
| ITM/BA market-alignment report | Partially implemented (18 pilot jobs, mostly non-US) |
| Root developer commands, CI (no deploy), secret scan, SQL replay | Implemented and verified (Phase 1) |
| Admin-only background-job routes (SyllabusCheck) | Implemented and verified (Phase 1, HTTP tests) |
| Coverage engine (legacy faculty tool) | Partially implemented (restored in Phase 1; legacy schema; not approved student evidence) |
| JSOM admin console | Partially implemented (several routes reference relations absent from the runtime schema) |
| Unified portal, resume/profile, job sources and snapshots, taxonomy, matching, subject recommendations, roadmap, MCP server, Master Agent runtime, Security Agent | Planned |

Known open security findings are listed in the inventory (§18). Nothing here is production-ready, and technical controls do not establish FERPA or other legal compliance.

## Security

Student and profile data must remain private. The database layer uses Supabase authentication, row-level security, role-aware access, audit records, and server-side service credentials. Never commit real secrets or production student data.

