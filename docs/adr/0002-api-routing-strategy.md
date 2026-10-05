# ADR-0002 — API gateway and routing strategy

**Status:** Accepted — approved by the owner on 2026-10-05. Recommended defaults apply until the owner answers the open questions below.

## Context

Two APIs (Express :5000, FastAPI :8000) with different auth plumbing, error shapes, CORS settings, and rate limits. No request correlation identifier exists. The portal (ADR-0001) and the MCP server (ADR-0007) need one stable origin and consistent contracts. SyllabusCheck currently has unauthenticated mutation routes (R-1). (Inventory §2, §4, §18.)

## Decision

1. **One public origin, path-based routing** through a thin reverse proxy (nginx or Caddy in all environments; no commercial API-gateway product):

   | Path prefix | Service |
   |---|---|
   | `/` | portal static assets |
   | `/api/planner/*` | planner service (today's JSOM Express API, re-prefixed) |
   | `/api/syllabus/*` | SyllabusCheck API (staff-facing until retired) |
   | `/api/profile/*`, `/api/market/*`, `/api/matching/*`, `/api/roadmap/*`, `/api/reports/*` | new services (one deployable per bounded context, or one modular service until load justifies splitting) |
   | `/mcp` | MCP server (ADR-0007) |

2. The proxy **never authenticates for the services.** Every service verifies the Supabase JWT itself (signature, issuer, audience, expiry) and sets transaction-local database identity. The proxy is not a trust boundary for identity headers; services ignore any `X-User-*` header.
3. The proxy adds `X-Request-Id` (generated if absent) and strips inbound copies of internal headers. Services log it and write it to audit records and run events as `correlation_id`.
4. Proxy-level limits: request body size per route (resume upload route has its own cap; JSON routes small), connection timeouts, per-IP rate limits as a first layer. Services keep per-user limits.
5. A shared error envelope `{ "error": { "code", "message", "correlation_id" } }` across new services; legacy services are wrapped or migrated route by route.
6. JWT verification moves from "call `/auth/v1/user` on every request" to local verification against the project's signing keys (JWKS), with a short-lived cache and a revocation-aware fallback (call Auth for sensitive routes). Decision to adopt must be confirmed against the project's current JWT signing configuration in Phase 2.

## Alternatives considered

| Option | Why not chosen |
|---|---|
| Managed API gateway (Kong, Apigee, AWS API GW) | Cost and operational surface exceed the pilot; adds a second place to enforce authz |
| Backend-for-frontend aggregating all calls | Useful later; premature before the services exist. Revisit in Phase 13 |
| Keep separate origins + CORS | Cookies/token handling per origin; harder correlation; harder MCP |
| Direct browser → Supabase PostgREST | Possible for simple owner CRUD but bypasses service rules (workload, versioning); acceptable only per table by explicit decision |

## Consequences

- Legacy routes get a rename (`/api/planner`, `/api/syllabus`); frontends update base URLs.
- One more component (the proxy) to configure and test; config lives in the repo and is covered by the Phase 2 smoke test.

## Security and privacy notes

- Closes R-1 only if the unauthenticated routes are also fixed or removed in the service itself (proxy rules are defense in depth, not the fix).
- Access logs must not record Authorization headers, signed URLs, query strings on signed-URL routes, or request bodies.
- TLS terminates at the proxy in staging/production; internal service-to-database connections use verified TLS (`DB_SSL_CA`).

## Verification required before acceptance

- Phase 2 smoke test shows every route prefix returns expected status for anonymous (401/403 on protected, 200 on public) and with a valid token.
- Test that a forged `X-User-Id` header has no effect.
- Test that `X-Request-Id` appears in service logs and audit rows.

## Open questions for the owner

1. Preferred hosting for the proxy and services (Railway/Vercel today for one app)? This decides nginx vs a platform router.
2. Is a single modular backend acceptable for new services in the first pilot, to reduce deployable count?
