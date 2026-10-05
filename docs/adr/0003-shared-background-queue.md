# ADR-0003 — Shared background queue

**Status:** Proposed

## Context

Only SyllabusCheck has background work (Celery + Redis; beat schedule with a duplicated recompute entry). Tasks use a separate sync SQLAlchemy engine on the raw `DATABASE_URL` (owner-level). No task is recorded durably, so retries, failures, and elapsed time are not auditable; there is no lease, heartbeat, or dependency model. The target needs: scheduled market collection, resume parsing, matching, roadmap generation, reports, QA runs, security scans, and Master Agent coordination — all with durable records, bounded retries, and restart safety. (Inventory §6, §10.2, R-2.)

## Decision

Use a **Postgres-backed durable queue in the `orchestration` schema** as the system of record for all new work, with workers that claim tasks using `FOR UPDATE SKIP LOCKED` and time-limited leases.

Core tables (detailed in Phase 16, referenced earlier): `orchestration.tasks` (state, attempts, max_attempts, run_after, lease_owner, lease_expires_at, idempotency_key, correlation_id), `dependencies`, `leases`/heartbeats, `events`, `artifacts`.

Rules:

- A task is claimed by updating `lease_owner`/`lease_expires_at` in one statement; workers heartbeat; expired leases are reclaimed by any worker (restart-safe).
- Retries use exponential backoff with jitter and a hard cap; exhausted tasks become `failed` (never silently dropped).
- **Idempotency key** per task; side-effecting handlers must be idempotent (verified by Phase 8–9 tests: duplicate delivery produces no duplicate rows).
- Per-source/queue concurrency limits are enforced by the claim query, not by worker count.
- The scheduler is a single "scheduler" task type that inserts due tasks (cron-like table `orchestration.schedules`), protected by an advisory lock so two schedulers cannot double-enqueue.
- Workers connect with a **dedicated worker role** (not owner, not `BYPASSRLS`) with grants limited to the tables that task type needs (ADR-0010).
- Celery/Redis stay only for the legacy SyllabusCheck tasks until that app is retired; no new task is added to Celery.

## Alternatives considered

| Option | Why not chosen |
|---|---|
| Extend Celery/Redis to everything | A second durable store would still be needed for task records, leases, and approvals; Redis persistence settings become a correctness dependency |
| pgmq / pg-boss / Graphile Worker | Reasonable; adopting a library hides lease and state-machine details the Master Agent must verify. Re-evaluate in Phase 16 if hand-rolled code grows |
| Supabase Edge Functions + cron | Runtime limits and weaker local test story for long parsers and collectors |
| Managed queue (SQS, Cloud Tasks) | Adds a vendor and a second source of truth |

## Consequences

- Throughput is bounded by Postgres; adequate for tens of thousands of tasks per day, which exceeds the pilot (a daily collection run plus per-student interactive jobs).
- Queue tables compete with application load on the free tier; retention (prune completed tasks and events by age) is part of Phase 16.
- Workers need an outbound path to Postgres only; collectors also need outbound HTTP to approved sources (allow-listed by source registry, ADR-0005).

## Security and privacy notes

- Task payloads carry identifiers and object paths, **never** raw resume text, tokens, or signed URLs. Event bodies pass the same sanitizer as security findings (ADR-0009).
- Tasks acting for a student carry the student's `owner_id` and a consent reference; handlers re-check consent at execution time.

## Verification required before acceptance

- Worker restart test: kill a worker mid-task; the lease expires; another worker completes the task exactly once effect-wise.
- Duplicate-enqueue test with the same idempotency key yields one task.
- Retry/backoff test; poison task ends `failed` with attempts recorded.

## Open questions for the owner

1. Is Redis acceptable to drop for new work, given the existing Railway setup?
2. Is a worker host available that can reach Supabase over the direct/session pooler (not transaction pooler) for `SKIP LOCKED` + advisory locks?
