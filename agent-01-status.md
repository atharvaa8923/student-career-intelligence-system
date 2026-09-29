# Agent 01 — Campus Match
UTC: 2026-09-27T01:39:14Z (verified with clock tool)
Stage: Tested local MVP complete
Completed: Sites/Vinext UI, Node API, real PostgreSQL auth/profile/resume storage, FORCE RLS on all five personal tables, private file access, account deletion, configurable requirements, explainable matching across seven IT roles. Primary-source research and setup README complete. Synthetic demo seeded; no deployment or real student ingestion.
Tests: 14/14 automated tests passed against live PostgreSQL/API, including anonymous denial, cross-user read/write/delete/file isolation, owner-transfer denial, runtime non-BYPASSRLS/owner checks, logout and deletion cascades. TypeScript and production frontend build passed. Desktop/mobile browser QA passed; WebMCP valid read and invalid-input rejection verified. Single-command local launcher verified.
Blockers: Production requires managed identity/recovery, HTTPS/secure cookies, backend hosting integration, secrets, operational hardening, independent review, matching evaluation. TXT-only ingestion; PDF/DOCX/OCR not implemented. No external credentials needed for local demo.
Next action: Coordinator review/handoff. Demo is running locally at http://127.0.0.1:4310 (API 4311; PostgreSQL private socket port 55439).
Synthetic login: alex@example.com / Synthetic-Demo-2026!
Deliverables:
- /Users/atharvavinaykulkarni/Documents/Codex/2026-09-26/student-resume-platform/outputs/campus-match/README.md
- /Users/atharvavinaykulkarni/Documents/Codex/2026-09-26/student-resume-platform/outputs/campus-match/RESEARCH.md
- /Users/atharvavinaykulkarni/Documents/Codex/2026-09-26/student-resume-platform/outputs/campus-match/migrations/001_init.sql
- /Users/atharvavinaykulkarni/Documents/Codex/2026-09-26/student-resume-platform/outputs/campus-match/test-results.txt
- /Users/atharvavinaykulkarni/Documents/Codex/2026-09-26/student-resume-platform/outputs/campus-match-source.tar.gz
Archive excludes local database state, dependencies, environment file and build output.

## Post-turn reachability verification
Verified at 2026-09-27T01:39:14Z using the clock tool. Frontend GET http://127.0.0.1:4310 returned HTTP 200 outside the restricted network sandbox. API GET http://127.0.0.1:4311/api/health returned {"ok":true}. The same frontend curl inside the default sandbox returned HTTP 000 / connection failure. This reproduces a sandbox access difference, not a stopped service. No restart or rebuild was needed.
Launcher PID 59633, API PID 59658, UI PID 59659 were still alive after the preceding turn. The retained exec session is 78380. These are local development processes, not a supervised system service: app/session cleanup, machine restart, or manual termination may stop them. Persistent availability is not guaranteed. Restart from the application directory with npm run demo; do not launch duplicates while ports are occupied. PostgreSQL remains running when the launcher is stopped. Production blockers above remain unchanged.
