# ADR-0005 — Market-source approval process

**Status:** Proposed

## Context

Collection code exists for five public job APIs (Arbeitnow, Remotive, Remote OK, Jobicy, Himalayas), a paid aggregator (JSearch, which is on the Celery beat schedule), GitHub README lists, and two dormant scrapers (Indeed HTML with a browser-spoofing `User-Agent`, USAJobs). No source has documented terms, robots policy, rate limits, retention restrictions, permitted use, or geographic coverage. The pilot dataset is 18 mostly non-US remote jobs. The prompt requires approval documentation **before** activation and prefers official APIs, government/institutional data, licensed feeds, and permitted employer pages. (Inventory §10, R-7, D-1.)

## Decision

Introduce a **source registry with a gated lifecycle**; the collector can only run sources in `active` status.

Lifecycle: `proposed → under_review → approved → active → suspended → retired`.

`market.sources` holds the machine-readable record; `docs/market-sources/<source_id>.md` holds the human review. A source cannot be `approved` unless every field below is filled and a reviewer other than the proposer signs off:

| Field | Required content |
|---|---|
| Name, type | api / dataset / licensed feed / employer page / html |
| Terms or API conditions | link + date reviewed + reviewer + relevant clauses (reuse, storage, redistribution, display) |
| Robots policy | applicable only to html; record `robots.txt` result and date |
| Rate limits | documented limit and our configured limit (≤ 50% of the documented limit) |
| Attribution | required text/link and where the UI shows it |
| Retention restrictions | max retention of descriptions; whether derived skills may outlive the text |
| Permitted use | internal analytics vs redistribution; whether snippets may be shown to students |
| Geographic coverage | with Dallas–Fort Worth, Texas, remote US, and wider US coverage rated separately |
| Data-quality limitations | known gaps (missing salary, stale postings, duplicates) |
| Credentials | which secret name in the secret manager; never the value |
| Structure fingerprint | schema/DOM hash used for structure-change detection (Phase 9) |

Activation rules enforced in code, not in prose:

- Collector identifies itself honestly (`User-Agent` names the project and a contact address configured via environment; **no browser spoofing, no credential or paywall circumvention, no CAPTCHA bypass**).
- Per-source rate limiter, circuit breaker, and bounded exponential retries are configuration on the source row; collector refuses to start a run for a source in any status other than `active`.
- Prefer, in order: official/public APIs → government and institutional datasets → licensed feeds → employer career pages where collection is permitted → HTML only after explicit review.
- Existing collectors are triaged in Phase 8: Indeed HTML → removed (terms-risk, no benefit over APIs); JSearch and GitHub-README collectors → `under_review`, **disabled in the beat schedule** until reviewed; the five feed APIs → reviewed one by one; USAJobs → candidate for first US government source (needs an API key and a registered contact).

Source approval is a **human decision**. The Master Agent and Source Agent can draft the review document and run the checklist but cannot move a source to `approved`/`active` (this is a Phase 16 approval gate).

## Alternatives considered

| Option | Why not chosen |
|---|---|
| Keep scraping broadly, document later | Violates the prompt and creates legal exposure; hard to unwind stored data |
| Buy one licensed feed and skip review | May be the right production answer; still needs the same record (terms, retention, attribution). Cost is an owner decision |
| Review only HTML sources | API terms often restrict storage and redistribution; reviews apply to all types |

## Consequences

- Initial active-source count will be small, possibly 0–2, until reviews finish. That honestly reflects what can be collected lawfully; Dallas coverage may need a licensed or institutional feed.
- Retention restrictions limit how long full descriptions may be stored (see Phase 9: store derived, cited skills; delete text when required).

## Security and privacy notes

- Outbound egress from collector workers is allow-listed to approved source hosts.
- Source credentials live in the secret manager; the Security Agent checks that none appear in the repo or logs.
- Job data is not personal data about students; employer contact data (recruiter names/emails) in descriptions is dropped at ingest when not needed.

## Verification required before acceptance

- A test that the collector refuses a `proposed` source and a `suspended` source.
- A test that the beat/schedule table contains no task for a non-`active` source.
- Review-template lint: approval fails if any required field is empty.

## Open questions for the owner

1. Is there budget for a licensed feed (e.g., a job-data provider) if public APIs cannot cover Dallas/Texas?
2. Does the university provide an institutional dataset or employer-relations feed (career-center postings)?
3. Which contact email should the collector User-Agent carry?
