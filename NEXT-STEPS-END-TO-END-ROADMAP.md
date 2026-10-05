# Next steps — end-to-end roadmap

Created in Phase 0 (2026-10-05). This file was listed as required reading but did not exist; it is now the single phase tracker. Status labels: **Implemented and verified**, **Implemented with remaining deployment input**, **Partially implemented**, **Planned**, **Blocked**. Planned phases are not capabilities.

Process rule: one phase at a time; after each phase, present evidence and **stop for owner approval**.

## Phase tracker

| # | Phase | Status | Primary inputs from the inventory |
|---|---|---|---|
| 0 | Baseline inventory and architecture decisions | **Complete, approved 2026-10-05** (`docs/phase-00/`, ADRs accepted) | — |
| 1 | Portable root commands, aggregate health checks | **Complete, awaiting review** (`docs/phase-01/`) | R-1, R-5 fixed; R-3 mostly fixed; coverage engine restored |
| 2 | Hosted HTTP smoke test, TLS verification | Planned (needs `DB_SSL_CA` and hosted credentials) | STEP-07 deployment input; ADR-0002, 0010 |
| 3 | Unified portal and shared onboarding | Planned | ADR-0001 |
| 4 | Resume/profile schema, RLS, private Storage | Planned | ADR-0004; no `profile` schema, no `resumes` bucket |
| 5 | Resume upload, parsing, correction, export, deletion | Planned | ADR-0004 |
| 6 | Authorized ITM/BA syllabus intake | Planned (0 syllabi loaded; authorization process undefined) | D-2 |
| 7 | Course-to-skill evidence mapping | **Blocked** until syllabi exist and an approver is named (legacy coverage engine restored in Phase 1 but not approved evidence) | ADR-0006 |
| 8 | Approved US/Dallas sources, scheduled collection | Planned | ADR-0005, ADR-0003; D-1 |
| 9 | Freshness, dedup, snapshots, monitoring | Planned | ADR-0006 |
| 10 | Skill taxonomy and extraction evaluation | Planned | §11 of inventory |
| 11 | Explainable job and domain matching | Planned | ADR-0006 |
| 12 | Subject recommendation engine | Planned | ADR-0006 |
| 13 | Personal Career Roadmap | Planned | ADR-0006 |
| 14 | Read-only MCP server | Planned | ADR-0007 |
| 15 | Controlled MCP mutations | Planned | ADR-0007 |
| 16 | Durable Master Agent | Planned | ADR-0003, ADR-0008 |
| 17 | Security Agent | Planned | ADR-0009 |
| 18 | Full security/quality/resilience/restore gate | Planned | — |
| 19 | Staging pilot | Planned (needs staging project, review) | ADR-0010 |
| 20 | Production-readiness review | Planned (needs institutional/legal review) | prompt requirement |

## What exists today (baseline, 2026-10-05)

See `docs/phase-00/BASELINE-INVENTORY.md` §21. In brief:

- **Implemented and verified (locally):** Supabase schema/RLS/catalog replay on PostgreSQL 16; 4 SQL assertion suites.
- **Implemented with remaining deployment input:** hosted dev project, TLS certificate path, syllabus upload to private storage.
- **Partially implemented:** Supabase Auth integration (email confirmation off in checked-in config), market-alignment report (18 non-US pilot jobs), JSOM admin console (read routes reference missing relations; writes denied).
- **Partially implemented:** legacy coverage engine (restored in Phase 1 from upstream; legacy schema, owner-level connection).
- **Planned:** everything else in the product goal.

## Cross-phase backlog from Phase 0

| ID | Item | Target phase |
|---|---|---|
| R-1 | Authenticate four SyllabusCheck mutation routes | **Done in Phase 1** |
| R-2 | Dedicated runtime/worker/migration DB roles, no owner-level runtime | 2 (design), 4 (first use) |
| R-3 | Upgrade `python-multipart`, remove unused `authlib`/`python-jose`, address npm advisories | **Mostly done in Phase 1**; remaining: `sentence-transformers` (Phase 7), frontend majors (Phase 3) |
| R-4 | Confirm and enforce email confirmation in hosted Auth | 2–3 |
| R-5 | Restrict `classify-subdomains`, `backfill-embeddings` to admins | **Done in Phase 1** |
| R-6 | Decide `FORCE ROW LEVEL SECURITY` policy for owned tables | 4 |
| R-7 | Remove/disable unreviewed collectors; source registry | 8 |
| R-8 | Pooled-connection identity and expired-session tests | 2 |
| R-9 | Make derived `coverage_rows` writable only by workers | 6–7 |
| R-10 | Align `reports` bucket policy with worker-only creation | 4 |
| R-13 | Remove demo-credential hint and `password123` docs | 3 |
| D-3 | Resolve 14 quarantined prerequisite edges with catalog evidence | 6 |
| D-4 | Additional catalog years | 3/6 |
| — | Institutional/FERPA review recorded as a production requirement | 19–20 |

## Documents to keep current

`README.md`, this file, `MASTER.md`, `registry.json`, `events.jsonl`, per-phase documents under `docs/phase-NN/`, application READMEs, `.env.example` files, and migration/rollback notes.
