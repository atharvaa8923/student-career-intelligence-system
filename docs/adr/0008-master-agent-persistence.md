# ADR-0008 — Master Agent persistence

**Status:** Proposed

## Context

`MASTER.md`, `registry.json`, and `events.jsonl` define a *design* for coordination: a registry with one agent, an event file with three lines, and monitoring that assumes Codex thread snapshots ("not a continuously running operating-system supervisor"). Nothing in the repository executes agents or persists runs. The prompt requires durable records for agents, runs, tasks, dependencies, leases, heartbeats, events, artifacts, approvals, blockers, verification evidence, retries, elapsed time, and completion, plus a state machine ending in `verified-complete` that is reached only through verification. (Inventory §1, §20.)

## Decision

**Postgres is the source of truth** (`orchestration` schema, the same database as the queue in ADR-0003). `registry.json` and `events.jsonl` become **generated exports** (for human review and git history) and are no longer edited by hand once the schema exists. Until Phase 16, they stay as the documentation record.

**State machine** (enforced by a transition function and a CHECK/trigger, not by convention):

```
queued → running → waiting | blocked | failed | canceled | verification
verification → verified-complete | failed | blocked
waiting → running | canceled
blocked → running | canceled     (blockers require a recorded reason and owner)
failed → queued                  (explicit retry, increments retry_count, honors max_attempts)
```

`verified-complete` can only be set by the Master Agent's verification step and requires: (a) every declared artifact exists and its checksum matches, (b) every acceptance test in the task's contract has a recorded passing result, (c) no open blocker. A process exit alone moves a task to `verification`, never to complete. Terminal states: `verified-complete`, `canceled`, `failed` (after retries exhausted).

**Records.** `agents` (id, single responsibility, allowed tools), `runs`, `tasks` (+ `dependencies`), `leases` and heartbeats, `events` (append-only), `artifacts` (path/URI, checksum, producer task), `approvals` (human decision records), blockers, `verification_evidence`, retry counters, `started_at`/`completed_at`/observed wall-clock elapsed (idle included, as in `MASTER.md`; active compute is recorded only when the platform supplies it).

**Stall rule** (from `MASTER.md`): 60 minutes without a heartbeat or meaningful event raises a *possible stall* flag; it does not mark the task failed by elapsed time alone.

**One responsibility per agent.** The ten agents in the prompt (Source, Skill, Curriculum, Profile, Matching, Roadmap, Report, QA, Security, Master) are rows in `agents` with explicit tool allow-lists. A tool call outside the allow-list is rejected at the tool boundary and recorded as an event (feeds the Security Agent). The Master Agent coordinates and verifies; it does not execute specialized work.

**Human gates.** Actions that need a person (source approval, production security change, syllabus-evidence approval, release) create an `approvals` row and move the task to `waiting`; agents cannot approve their own gates.

**Privacy.** Events and artifacts store identifiers, counts, hashes, and reason codes only. No raw resume text, tokens, or signed URLs. A sanitizer runs on every event write; a test seeds sensitive-looking strings and asserts they never persist.

## Alternatives considered

| Option | Why not chosen |
|---|---|
| Keep JSON/JSONL files | Not concurrent-safe, no leases, no constraints, cannot prove verification |
| A workflow engine (Temporal, Airflow) | Heavy for the pilot; a second system of record. Re-evaluate if orchestration complexity outgrows SQL |
| Keep Codex thread monitoring | Not a supervisor; the platform status is not durable inside our product |

## Consequences

- A backfill step maps the existing registry/events into the new tables (single `agent-01` record, status `completed_local_mvp`, flagged as imported/unverified).
- The Master Agent's own failure modes (restart, duplicate coordinators) are handled by leases + advisory lock, same as workers.

## Security and privacy notes

- Agent database roles are separate per agent class (ADR-0009/0010). The Master Agent role cannot read student content; it reads task metadata.
- Approvals reference authenticated human user ids and are immutable.

## Verification required before acceptance

- State-transition test matrix (all legal and illegal transitions).
- "Process exited 0 but artifact missing" test ends in `failed`/`blocked`, never `verified-complete`.
- Restart test: coordinator killed mid-run; a second coordinator resumes without duplicating verification.
- Sanitizer test as above.

## Open questions for the owner

1. Which humans are approvers for each gate (source approval, security changes, release)?
2. Is `registry.json`/`events.jsonl` still wanted as repository exports after the database exists?
