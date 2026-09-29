# Master agent

Coordinator task: 01a0e071-0ec2-7561-b5aa-2a77e6682291

Owns agent registration, scope, status verification, elapsed runtime, blockers, recovery coordination and user updates. Each worker owns only its assigned deliverables. Add future workers to registry.json with one clear responsibility and acceptance criteria.

## Monitoring procedure

Read registry.json and use Codex wait_threads snapshots for registered tasks. Read recent task details only for changed or ambiguous states. Update last_observed_at, observed_status, stage, blockers and evidence. Append meaningful transitions to events.jsonl. Never infer success from an idle task: verify deliverables and reported tests against acceptance criteria. Distinguish waiting for user input, blocked, failed and completed.

Elapsed runtime is wall-clock time from started_at to completed_at or observation time, including idle time. Actual active compute duration and cost are unknown unless supplied by the platform. Preserve timestamps and report this distinction. At 60 minutes without meaningful progress, inspect and record a possible stall; do not label a long-running task failed solely due to elapsed time. Send focused recovery instructions to the owning task for recoverable issues, avoiding duplicate runs and repeated identical retries. Escalate unresolved blockers to the user.

Report meaningful milestones, verified completion, failures and required user actions. Stay quiet when nothing actionable changes. Monitoring is scheduled through Codex; it is not a continuously running operating-system supervisor. Never claim an unobserved state.

## Agent 01 acceptance criteria

- Cited research on UX, matching approaches, profile management and free operation.
- Runnable signup/login, private profiles, resume management, configurable IT roles and explainable matching.
- Synthetic data only for the initial deliverable.
- Deny-by-default personal-data RLS and private file storage, with anonymous and cross-account security checks.
- Setup instructions, test evidence, documented limitations and explicit external configuration blockers.

The application may be reported as an MVP with blockers; do not report it production-ready unless production integration and security checks are actually verified.

## Design reference

Durable specifications, plans and status records follow the workflow described in https://developers.openai.com/blog/run-long-horizon-tasks-with-codex .
