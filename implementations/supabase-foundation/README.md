# Shared Supabase foundation

This directory contains the Supabase identity foundation for JSOM Planner and SyllabusCheck. It is development-only and contains no cloud credentials or real user data.

Hosted development project: `jsom-syllabus-dev` (`rrabxkxqyrgbgakwljmf`), East US (Ohio). The local directory is linked through ignored CLI state. Its database password is stored in macOS Keychain under service `supabase-jsom-syllabus-dev-db`; it is not stored in this repository.

## Prerequisites

- Node.js and npm
- A Docker-compatible runtime

Install dependencies and start the local services:

```sh
npm install
npm run supabase:start
npm run db:reset
npm run db:test
```

Local Studio is normally available at `http://127.0.0.1:54323`. The local stack uses default development credentials and must not be exposed to a network or treated as production.

## Identity flow

1. A user signs up through Supabase Auth.
2. `on_auth_user_created` creates `public.profiles`; it grants no application role.
3. The application calls `enroll_application('jsom_planner')` or `enroll_application('syllabus_check')` after authenticated onboarding.
4. The function grants only the baseline `student` or `professor` role and is idempotent.
5. `get_my_app_roles()` returns only the caller's assignments.

`private.app_roles` is not exposed to browser roles. Administrator, advisor and catalog-editor assignment is intentionally absent until a trusted staff-administration workflow is designed and approved. Never use user-editable Auth metadata as authorization.

## Configuration

The checked-in local configuration requires 12-character passwords containing letters and digits, disables anonymous sign-in, exposes only the public/GraphQL schemas, requires explicit grants for new tables and permits local redirects for the JSOM and SyllabusCheck development ports.

The initial migration and pgTAP policy tests are under `supabase/migrations` and `supabase/tests`. `tests/postgres_prelude.sql` and `tests/identity_assertions.sql` are a lightweight PostgreSQL compatibility harness only; they are not applied to Supabase.

Do not run `supabase db reset --linked` against a hosted project. It destroys linked remote data. Hosted linking, provider configuration and account migration require separate approval.

The hosted identity migration can be checked with `npm exec supabase migration list -- --linked`. Apply future reviewed migrations with `npm exec supabase db push -- --linked --dry-run` first, then an approved non-dry run.
## Applied implementation stages

- Identity foundation: `202609270001_identity_foundation.sql`
- Application schemas and RLS: `202609270002_application_data.sql`
- Student-data and object-path hardening: `202609270003_student_data_hardening.sql`
- Import manifests and catalog-fidelity fields: `202609270004_import_foundation.sql`

See `../STEP-05.md` for the deployed access model and `../STEP-06.md` for import results.
