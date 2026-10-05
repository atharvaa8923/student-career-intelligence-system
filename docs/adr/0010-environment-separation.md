# ADR-0010 — Staging and production environment separation

**Status:** Proposed

## Context

One hosted Supabase project (`jsom-syllabus-dev`, East US/Ohio) exists. Local runtime uses the **database owner password** from macOS Keychain and a single connection string for the app (R-2). Nothing separates runtime, worker, migration, browser, and administrator identities. `supabase db reset --linked` is documented as dangerous in the foundation README, which means the dev project is the only target for migrations. There is no staging or production. CI exists but is inert and would auto-deploy on `main`. (Inventory §9, §14, §17.)

## Decision

**Three environments, three Supabase projects, no shared data or credentials.**

| Environment | Supabase project | Data | Who can deploy |
|---|---|---|---|
| `dev` | existing `jsom-syllabus-dev` (and local Supabase CLI stack) | Synthetic and public catalog only | developers |
| `staging` | new project, same region as production | Synthetic data and approved copies of public/catalog data only. **No real student records.** Pilot with consenting users only after the institutional review gate | CI after review |
| `prod` | new project | Real data only after institutional/legal review is recorded | CI with a manual approval step; no developer has standing write access |

**Identities (per environment, separate secrets):**

| Identity | Purpose | Privileges |
|---|---|---|
| `browser` (anon/authenticated via Supabase) | End-user access | RLS-governed table grants only; no `private` schema |
| `app_runtime` | Service request handling | Member of `authenticated`/`anon` for `SET LOCAL ROLE`; **not** owner, **not** `BYPASSRLS`; login role with no DDL |
| `worker_<type>` (market, parser, matcher, report, …) | Background tasks | Narrow grants per task type (ADR-0003); no `BYPASSRLS` unless a documented function requires it |
| `migration` | Schema changes in CI | DDL rights; used only by the deploy pipeline; credential never reaches runtime hosts |
| `security_agent` | ADR-0009 | Metadata functions + findings tables |
| `admin` (human) | Break-glass | Personal, MFA-protected accounts; use logged and reviewed |
| Service-role / secret keys | Supabase platform | Held only by the migration pipeline and a documented break-glass procedure; **never** given to services, workers, MCP, or agents |

**Secrets.** Stored in a secret manager (platform secret store acceptable for the pilot); not in git, not in `.env` on shared hosts, not in logs. Rotation by a human on a schedule and after any suspected exposure. The macOS Keychain flow remains a *developer convenience for dev only*.

**Connections.** Verified TLS everywhere (`DB_SSL_CA` set; no `rejectUnauthorized:false`). Use session/direct connections where the queue needs advisory locks/`SKIP LOCKED` semantics; transaction pooling is allowed for request handlers that use transaction-local settings (already the pattern).

**Promotion.** Migrations are forward-only files in `supabase-foundation/supabase/migrations`, applied to dev → staging → prod by the pipeline, with `db push --dry-run` first and a recorded rollback plan per migration. No `--linked` reset or manual console edits in staging/prod. Drift between environments is a Security Agent finding.

**Parity checks.** A script compares migration history, RLS enablement, and grants across environments and fails the pipeline on mismatch.

**Backup and restore.** Staging gets a scheduled backup/restore rehearsal (Phase 18); production backups follow the Supabase plan in use. The plan tier and point-in-time-recovery availability are an owner decision (cost).

**Data rules.** Synthetic fixtures only in repo, tests, logs, screenshots, findings, and public reports. A pre-commit/CI check scans for email/phone/SSN-like patterns and for common real-name datasets.

## Alternatives considered

| Option | Why not chosen |
|---|---|
| One project with schemas per environment | One credential compromise exposes all; cannot rehearse destructive migrations safely |
| Supabase branching only | Useful for previews, but does not provide a separately governed production |
| Share dev and staging | The dev project already receives experiments and `reset`-style operations |

## Consequences

- Two more Supabase projects: free-tier project limits (two active projects per organization at the time of the assessment) may require a paid plan or organization change. **Owner decision; not verified for today's pricing in this session.**
- Seeds and imports must be repeatable per environment (existing import scripts already hash-pin sources).

## Security and privacy notes

- Residency and retention choices (region, backup retention) feed the institutional review and are recorded before real data enters prod.
- Technical controls here do **not** establish FERPA or other legal compliance (prompt requirement); the review is a production gate.

## Verification required before acceptance

- A test shows the `app_runtime` role cannot create tables, is not `BYPASSRLS`, and cannot read `private.*`.
- A test shows each worker role can only touch its tables.
- Pipeline dry-run applies the same migration list to dev and a fresh scratch database.

## Open questions for the owner

1. Budget and plan tier (project count, point-in-time recovery).
2. Hosting target for services and workers; secret-manager choice.
3. Who holds break-glass access, and what is the review cadence?
4. Who performs the institutional/FERPA review, and what evidence will it need?
