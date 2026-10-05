# ADR-0009 — Security Agent permissions

**Status:** Proposed

## Context

The prompt defines a defensive, least-privileged monitor that checks RLS and grants, unsafe views/functions, isolation, dependency and secret exposure, access patterns, privileged-role changes, MCP/agent scope violations, and control drift; it may report and verify but must not silently change production security. Nothing exists. The baseline already found issues the agent should have caught (unauthenticated mutation routes, owner-level runtime role, no `FORCE RLS`, dependency advisories). (Inventory §18.)

## Decision

**Identity.** A dedicated database role `security_agent` (NOLOGIN group + a login role per environment), distinct from runtime, worker, migration, and administrator roles (ADR-0010). It is **not** a member of `authenticated`, owns no objects, has no `BYPASSRLS`.

**Read access (metadata only).** Through a small set of **SECURITY DEFINER inspection functions** owned by a migration role and granted to `security_agent` only. Functions return catalog facts (relation names, `relrowsecurity`/`relforcerowsecurity`, policies, table/column grants, view options such as `security_invoker`, function owners and `prosecdef`, role memberships, extension list) and aggregate counters from audit/event tables. They do **not** return row contents from student tables. `security_agent` has no direct SELECT on `planner`, `profile`, `syllabus.documents`, `roadmap`, or storage objects.

**Write access.** INSERT/UPDATE only on `private.security_findings` and `private.finding_occurrences` (and its own run/event rows in `orchestration`). No DDL, no GRANT/REVOKE, no role changes, no deletes outside its own finding rows' status fields.

**Isolation tests (anonymous / cross-account).** Run only against **dev/staging with synthetic users created by the test harness**; the harness creates and removes its own users with a migration-time-limited token. In production the agent performs read-only configuration checks and never creates users, never executes cross-account probes, and never runs destructive probes.

**Findings contract.** Each finding records: category, severity, affected resource identifier, **sanitized** evidence, detection-rule version, first_seen, last_seen, occurrence_count, assigned_owner, status (open/acknowledged/mitigated/verified/closed/risk_accepted), remediation notes, verification result. A sanitizer rejects (and fails closed, dropping evidence rather than storing it) any value matching: passwords, bearer/JWT tokens, private keys, full connection strings, signed URLs, or long free text that could be resume or student content. Evidence uses identifiers, counts, hashes, and rule outcomes only. Tests seed these patterns and assert none is stored.

**Never silently.** The agent cannot change RLS, grant/revoke roles, disable users, rotate credentials, delete records, modify firewall/deployment config, or run destructive probes. Remediation is a **human workflow**: finding → approval row in `orchestration.approvals` → a person applies a migration or change through the normal release path → the agent **re-verifies** and records the result.

**Detections scheduled** (versioned rules): RLS enabled and policies present for all protected tables; `FORCE RLS` policy where required; browser-role grants vs an allow-list; `security_invoker` on exposed views; SECURITY DEFINER functions with mutable `search_path`; dependency audits (npm, pip) from CI artifacts; secret scanning results from CI; repeated authorization failures and high-volume reads/exports from audit events; privileged-role assignment/removal and self-promotion attempts; MCP scope violations and unauthorized tool calls from `orchestration.events`; unexpected migration/service identities; configuration drift against a committed baseline.

**Alerting.** New high/critical findings create an `approvals` task and a notification to the owner; the agent does not page third parties.

## Alternatives considered

| Option | Why not chosen |
|---|---|
| Run as service role / owner for completeness | Violates least privilege; one agent bug becomes full compromise |
| Only external scanners (SaaS) | Cannot see our application-level authorization, MCP scopes, or consent rules; still useful as inputs |
| Allow auto-remediation of simple drift | The prompt forbids silent production security changes |

## Consequences

- The inspection functions are themselves security-sensitive code; they are reviewed like migrations and tested for not leaking row data.
- Some checks (e.g., Supabase dashboard auth settings) may not be queryable from SQL; those require a read-only Management API token with minimal scope, held in the secret manager, or remain manual checklist items. That limitation is recorded rather than hidden.

## Security and privacy notes

- The agent's own credentials are stored in the secret manager and rotated by a human.
- Finding rows are access-controlled (administrators only); even sanitized, they describe weaknesses.

## Verification required before acceptance

- Negative tests: attempt `GRANT`, `ALTER POLICY`, `DELETE` on student tables as `security_agent` → all fail.
- Sanitizer tests as above.
- Seeded-misconfiguration tests: disable RLS on a scratch table in staging → a finding appears within one scan; after the human fix, verification closes it.

## Open questions for the owner

1. Who is the initial finding owner and escalation contact?
2. Is a read-only Supabase Management API token acceptable for dashboard-setting checks (e.g., email confirmation, redirect allow-list)?
