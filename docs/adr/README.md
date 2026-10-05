# Architecture decision records

All records below were written in Phase 0 and **approved by the owner on 2026-10-05**. Recommended defaults apply until the owner answers each record's open questions. An accepted decision is a design commitment, not an implemented capability; implementation status lives in `NEXT-STEPS-END-TO-END-ROADMAP.md`.

| ADR | Decision | Evidence it responds to |
|---|---|---|
| [0001](0001-unified-portal-strategy.md) | Unified portal strategy | Two separate frontends and API origins |
| [0002](0002-api-routing-strategy.md) | API gateway / routing | Two APIs, no shared origin, no correlation ID |
| [0003](0003-shared-background-queue.md) | Shared background queue | Celery/Redis only for one app; no durable task records |
| [0004](0004-resume-parsing-boundary.md) | Resume parsing boundary | No resume service; `python-multipart` advisories; parser runs in the API process today |
| [0005](0005-market-source-approval.md) | Market-source approval process | No source terms recorded; spoofed-UA and aggregator collectors |
| [0006](0006-matching-and-recommendation-versioning.md) | Matching and recommendation versioning | No immutable snapshots, no algorithm versions |
| [0007](0007-mcp-transport-and-authentication.md) | MCP transport and authentication | No MCP; service-role risk |
| [0008](0008-master-agent-persistence.md) | Master Agent persistence | `registry.json`/`events.jsonl` are files, not records |
| [0009](0009-security-agent-permissions.md) | Security Agent permissions | One owner-level DB role; no findings tables |
| [0010](0010-environment-separation.md) | Staging and production separation | Only a hosted dev project exists |

## Format

Status, Context (with inventory references), Decision, Alternatives considered, Consequences, Security and privacy notes, Verification required before acceptance, and Open questions for the owner. Inventory risk IDs (R-n) and data-quality IDs (D-n) refer to `../phase-00/BASELINE-INVENTORY.md`.

## What these do not decide

Hosting vendor and region, budget, the institutional/FERPA review path, and whether the legacy applications are rewritten or wrapped. Those appear as open questions in the relevant record and in `../phase-00/PHASE-00.md`.
