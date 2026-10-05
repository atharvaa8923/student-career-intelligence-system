# ADR-0006 — Matching and recommendation versioning

**Status:** Accepted — approved by the owner on 2026-10-05. Recommended defaults apply until the owner answers the open questions below.

## Context

The prompt requires rules-first, explainable, reproducible matching and subject recommendation, with stated starting weights treated as hypotheses to be evaluated. Today there is no snapshot of market data (job rows are mutable), no taxonomy versions, no algorithm records, and no result storage. The coverage engine that produced prior curriculum scores is missing from the repo (D-9), so nothing existing can be reproduced. (Inventory §5, §10, §19.)

## Decision

Every score, recommendation, and roadmap is a **pure function of versioned, immutable inputs**, and the output stores references to each input so the result can be recomputed byte-for-byte.

**Version objects** (tables in `matching`, `market`, `roadmap`, `catalog`):

| Object | Identity | Immutability |
|---|---|---|
| Algorithm | `algorithm_id` + semantic version, code commit hash | Never edited; new version row |
| Weight set | `weight_set_id`, JSON of weights, validation: sums, ranges | Never edited |
| Role taxonomy | `role_taxonomy_versions` | Published versions frozen |
| Skill taxonomy | `skill_taxonomy_versions` (canonical names, aliases, rules) | Published versions frozen |
| Market snapshot | `market_snapshot_id`, `as_of`, source set, counts, content-hash of included job-snapshot ids | Immutable; each job snapshot is itself immutable (ADR-0005/Phase 9) |
| Catalog + syllabus evidence | `program_version_id` (catalog year) and approved `course_skill_evidence` set version | Evidence rows versioned and approved by a human reviewer |
| Student evidence | profile evidence **as of a profile version hash**, plus consent reference | Student edits create a new profile version |

**Result record** (`matching.job_matches`, `score_components`, `explanations`; `roadmap.recommendations`): `algorithm_id`, `weight_set_id`, `role_taxonomy_version`, `skill_taxonomy_version`, `market_snapshot_id`, `profile_version_hash`, `catalog_version`, `evidence_set_version`, `computed_at`, `input_hash`. Components are stored **separately** (required skills, preferred skills, evidence strength, coursework, projects, experience, preference fit, location fit, experience-level fit); the weighted total is a derived field. **Hard constraints are stored and displayed outside the weighted score** and cannot be offset by other components.

**Reproducibility rule:** re-running with the stored identifiers must yield the same output (floating-point formatting and tie-break order fixed in the algorithm spec). A test per phase recomputes a stored result and compares. Randomness is not used in v1.

**Changing weights:** the starting formulas from the prompt (match and subject priority) are registered as weight set `v0-hypothesis`. Production use requires a recorded `evaluation_run` (Phase 11/12) with the labeled set, metrics, and fairness/counterfactual checks, then a new weight set version if changes are justified. Evaluation failures block promotion; they do not silently revert.

**Diffs:** a new roadmap version stores a computed diff against the previous version, which feeds "what changed from the previous roadmap". Student decisions (accept/reject/lock/move/replace) are first-class rows (`recommendation_decisions`) keyed by a stable recommendation identity so regeneration preserves locked items.

**Excluded features:** protected characteristics and obvious proxies (name, photo, age/graduation-date-as-age signals beyond term planning, gender, nationality/visa status as a *ranking* feature, address granularity beyond the stated target metro, etc.) are not inputs. Work-authorization requirements in a posting are shown as a **hard constraint to the student**, never used by the system to rank people.

## Alternatives considered

| Option | Why not chosen |
|---|---|
| ML ranking first | Not explainable, no labels, no baseline; the prompt requires rules-first |
| Recompute on read, store nothing | Cannot reproduce past advice when the market or taxonomy changes |
| Mutable "current" score rows | Loses audit trail and the previous-roadmap diff |

## Consequences

- More tables and storage; retention policy for old snapshots (keep those referenced by an active roadmap version).
- Evaluation harness and a labeled synthetic set are Phase 10–12 deliverables, not afterthoughts.

## Security and privacy notes

- Stored explanations quote taxonomy skill names and short job-text spans, not resume text; resume evidence is referenced by `skill_evidence` id (spans stay in the profile schema under owner RLS).
- Results are owner-scoped by RLS; matching services run under the student's identity or a worker role that records which student it acted for.

## Verification required before acceptance

- Recompute test: stored result equals recomputation.
- Counterfactual test: swapping a protected attribute or proxy changes no score (inputs are not read).
- Hard-constraint test: a failing hard requirement stays visible when the weighted score is high.

## Open questions for the owner

1. Who approves course-to-skill evidence (faculty, advising, owner)? This gates Phase 7.
2. Are there labeled outcomes (past student → role) available for evaluation, or is evaluation limited to expert-reviewed synthetic cases?
