# Provenance — `services/coverage`

Restored in Phase 1 (2026-10-05). These files were never committed to this
repository because the root `.gitignore` rule `coverage/` matched this
directory; the rule is now anchored.

| File | SHA-256 |
|---|---|
| `__init__.py` | `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855` |
| `engine.py` | `27ada3a44d232eddc4db30b12ddc0169432c68550485e443f7a2845c64db87d8` |
| `gap_analyzer.py` | `f7b1f4c3732707f39cb47f1158530e2aae6136d36daa95554d88ca65bdff21ef` |

- Source: https://github.com/KrutikaShindeGH/syllabuscheck, commit
  `7aa7a184240dbd8b148ccb41ab88599d89ff249e`, path
  `backend/services/coverage/`. Copied unmodified.
- License: the upstream repository has **no license file**. The repository
  owner approved reuse on 2026-10-05. Confirm permission from the upstream
  author before any public or commercial distribution.

## Known limitations (unchanged upstream behavior)

- Opens its own synchronous SQLAlchemy engine on `DATABASE_URL`, so it runs
  with the connection's role and **bypasses request-scoped RLS identity**
  (inventory risk R-2). Owner filtering is application-level only.
- Queries legacy table names (`courses`, `keywords`, `coverage_rows`,
  `job_postings`), not the Supabase `syllabus.*` schema; not verified against
  the hosted database.
- Scores come from embedding similarity with fixed thresholds (0.72 / 0.45).
  They are **not** approved course-to-skill evidence and must not feed student
  recommendations (ADR-0006; replaced in Phase 7).
