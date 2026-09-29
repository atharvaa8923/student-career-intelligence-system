# Step 02 — Database schema and migration repair

Status: implemented and tested in workspace copies. Awaiting approval before Supabase setup/Auth work.

## Changes

SyllabusCheck now has one additional Alembic revision, `010_schema_alignment`, after `009_programs`. The complete order is `001 → 007_phase7_google_reports → 008_add_subdomain_to_keywords → 009_programs → 010_schema_alignment`. Historical revisions were preserved.

The new revision adds missing course `parsed_sections` and keyword `category`, `importance`, `is_emerging` fields, aligns document/report JSON columns to JSONB, and sets embeddings to `vector(384)` for the existing local model. It rejects incompatible non-null historical vectors before making changes. It does not discard, pad or truncate embeddings. A populated legacy database may therefore need a separately reviewed re-embedding process before upgrade. The ORM now includes the already-migrated Google identity column, and its embedding comment reflects the actual local model.

API startup no longer changes the database schema or creates extensions. Migration credentials can now be kept separate from runtime credentials. `make migrate` uses a one-off container instead of requiring a running API.

JSOM now has a small, replayable structural repair: `database/structural/001_core_or_groups.sql`. It adds the missing `or_group_id`, fills nulls with zero, and preserves existing nonzero groups. Docker initialization applies schema, structural repair, then the original development seed in filename order. Existing Docker volumes are not initialized again: apply the structural repair explicitly to those databases.

## Running migrations

SyllabusCheck (from its workspace project directory, with configured local environment):

```sh
docker compose up -d db redis
make migrate
docker compose up -d
```

Without Docker, run `alembic upgrade head` from `backend` with the target `DATABASE_URL` set. The database must support pgvector. Apply migrations before starting API, workers or scheduler. Container builds themselves were not exercised in this step.

JSOM fresh development database order:

1. `database/schema.sql`
2. `database/structural/001_core_or_groups.sql`
3. Optional `database/seed.sql`, **only for disposable development databases**.

For an existing JSOM database, apply only the structural repair with `psql -v ON_ERROR_STOP=1 -f database/structural/001_core_or_groups.sql` and your configured connection. Never rerun schema or seed over existing student data. The original seed resets tables and includes demo users; it remains development-only.

The legacy `database/migrations` directory contains catalog/prerequisite data rewrites, including truncation. Those are deliberately excluded from automatic structural migration. Resolving authoritative catalog content and ordering overlapping catalog rewrites requires its own review. Existing base catalog requirements remain as seeded, with zero as the default OR group until approved catalog corrections are applied.

## Verification

Three live PostgreSQL integration tests passed:

1. SyllabusCheck: replay full migration chain on a blank database, repeat upgrade safely, select every ORM-declared table/column, verify JSONB and insert a 384-dimensional embedding.
2. SyllabusCheck: a legacy 1,536-dimensional vector blocks upgrade; the original vector and Alembic revision remain unchanged.
3. JSOM: load schema, repair and development seed into an isolated database; replay repair and verify row counts and nonzero OR groups survive; query student progress and refresh the course graph.

Tests ran on local PostgreSQL 18 with pgvector, not a hosted Supabase instance. Test databases were randomly named and removed afterward. The tests used an isolated private socket; no existing application database was changed. Results: `tests/step-02-results.txt`. Test runner: `tests/test_schema_migrations.py`.

Dependencies used for tests: SQLAlchemy 2.0.31, Alembic 1.13.1, pgvector 0.3.2, asyncpg, pydantic-settings, greenlet and psycopg2-binary in an isolated temporary virtual environment. A full dependency upgrade, frontend build and end-to-end application test are outside this schema step.

## Remaining boundaries

This repairs missing schema and fresh initialization; it does not implement Supabase Auth, RLS, private Storage, production role grants, verified academic records or cross-application schema consolidation. Existing model nullability/index differences are not a claim of complete Alembic autogenerate parity. Migration 010 intentionally refuses automated downgrade because dropping application fields or changing populated embedding dimensions could lose data; rollback requires a reviewed backup/restore plan.

Next proposed step: configure a local Supabase development environment and define the shared identity/schema foundation. Hosted project selection and production data transfer will remain separate review points.
