# ADR-0007 — MCP transport and authentication

**Status:** Accepted — approved by the owner on 2026-10-05. Recommended defaults apply until the owner answers the open questions below.

## Context

The prompt requires an MCP server that is a controlled interface over application services: no service-role key, no unrestricted SQL, no private-schema access, no other-student access, no role changes, no consent bypass, and strict schemas, limits, idempotent mutations, and audit for 16 named tools. Nothing exists yet. The backends today verify the Supabase token per request and set transaction-local database identity; the MCP server must reuse that model rather than invent one. (Inventory §9.)

## Decision

**Transport.** Streamable HTTP at `/mcp` behind the common origin (ADR-0002) for remote/authorized agents. stdio is allowed only for local developer testing against a local stack and is never configured with production credentials. (The exact current MCP spec revision and its authorization profile are to be **checked against the published specification at the start of Phase 14**; this ADR does not freeze protocol details I have not verified.)

**Authentication.** Every MCP request carries a bearer access token that identifies a **human user** (the student) and optionally an **agent client** acting on their behalf:

- Token = a Supabase-issued user JWT, or a short-lived token minted by our own authorization endpoint after the student grants consent to a named agent client with named scopes. The MCP server verifies signature, issuer, audience, and expiry locally (JWKS) and rejects anything else. Anonymous calls are denied for every tool.
- Agent clients are registered (`agent_clients` + scopes + expiry + revocation). A client's scope set can only be a subset of what the user's own role allows; scopes cannot grant roles.
- The Master Agent and specialized agents (ADR-0008) use **agent identities with per-run scoped tokens**, not user tokens, for orchestration tools; student-data tools additionally require a valid, unexpired student consent grant for that agent and purpose.

**Authorization path.** The MCP server holds **no database privileges of its own.** Each tool handler calls the same application service layer as the HTTP API with the caller's identity, so RLS and service rules apply unchanged. It never receives, imports, or logs a service-role/secret key. A static check in CI fails the build if the MCP package references `service_role`, `SUPABASE_SECRET`, or a raw owner `DATABASE_URL`.

**Tool contract.** Each tool declares: input JSON schema (strict, `additionalProperties:false`), output schema, required scope, rate limit, timeout, max result size, pagination (cursor), redaction rules, `correlation_id` (taken from `X-Request-Id` or generated), and for mutations an `idempotency_key` (unique per user+tool; replays return the original result). Mutations in v1 are limited to: `roadmap.generate_draft`, `roadmap.record_decision`, `reports.request_report`. Phase 14 ships read-only tools; Phase 15 adds mutations.

**Audit.** Each call writes sanitized metadata only to `private.audit_events`: tool, user id (or hash), agent client, outcome, byte counts, correlation id, duration. Inputs and outputs are not stored.

**Consent.** `profile.*` and `matching.*` tools check `profile.consent_events` for an active "authorized analysis" consent covering this agent client and purpose before reading student evidence. Withdrawal takes effect on the next call.

## Alternatives considered

| Option | Why not chosen |
|---|---|
| MCP server with a service-role key and its own authz | One bug becomes full data exposure; violates the prompt |
| Direct SQL tools ("query_database") | Unbounded access; unauditable |
| stdio only | Cannot serve remote authorized agents |
| Reuse Supabase's own hosted MCP/PostgREST as the interface | Exposes table-level surface rather than business capabilities; no consent or workload rules |

## Consequences

- MCP adds a second client of the service layer, so service functions must be callable without HTTP request objects (a design requirement for Phases 11–13).
- OAuth-style consent UI must exist in the portal before Phase 14 exits.

## Security and privacy notes

- Prompt-injection stance: tool outputs contain data, never instructions; job text and (consented) profile fields returned to agents are labeled untrusted in the output schema. Tools never execute anything described in returned text.
- Result size caps (proposed 50 items / 64 KiB) and per-user, per-tool rate limits.
- Cross-account and anonymous denial tests for every tool are acceptance criteria (Phase 14).

## Verification required before acceptance

- Contract tests for all 16 tools (valid, invalid, oversize, pagination).
- Anonymous, expired token, wrong audience, and cross-account tests deny with the same error shape.
- Replay test: duplicate `idempotency_key` returns the stored result and creates no second record.
- Grep gate: no secret/service-role reference in the MCP package.

## Open questions for the owner

1. Which agent clients (names) will connect first?
2. Where does consent UI live (portal settings), and who may revoke (the student, an administrator for abuse)?
