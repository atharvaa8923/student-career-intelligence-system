# ADR-0001 — Unified portal strategy

**Status:** Proposed

## Context

Two React frontends exist with different languages (JSX vs TypeScript), styling (custom CSS vs Tailwind), routers, auth state (context vs Zustand), and API origins (`/api` → :5000 vs `VITE_API_URL` → :8000). Both authenticate against the same Supabase project but keep separate sessions. There is no onboarding flow and no profile, roadmap, or report UI. SyllabusCheck is aimed at faculty (`professor` role) and JSOM at students and administrators; the target student workflow uses neither audience as built. (Inventory §1–3.)

## Decision

Build a **new student-facing portal** (`apps/portal`, React + TypeScript + Vite) that owns the Supabase session, onboarding, profile/resume, matching, roadmap, and reports. Migrate in strangler fashion:

1. Phase 3: portal shell with shared auth and onboarding. Existing JSOM planner functions are reached through the portal's API client (Phase 2 routing, ADR-0002), not by embedding the old SPA in an iframe.
2. Port the JSOM student screens that matter (dashboard, eligible courses, catalog) into the portal as read-only consumers of planner services. Faculty/admin tools (SyllabusCheck upload, coverage, catalog admin) stay as separate staff apps behind their own role checks until replaced.
3. Retire a legacy frontend only after its student-relevant routes have portal equivalents and tests.

Single session owner: the portal uses the Supabase JS client with PKCE and stores the session per Supabase defaults. Backend services receive the user's access token as a bearer token; they do not accept cookies set by other apps.

## Alternatives considered

| Option | Why not chosen |
|---|---|
| Keep both apps and link between them | Two sessions, two styles, no shared onboarding; fails the single-flow requirement |
| Micro-frontend / module federation | Operational complexity for two small apps; both use Vite, but the build/runtime coupling cost outweighs the benefit |
| Rewrite everything in one big step | Loses working planner logic (prerequisite checks, OR groups) and violates the one-phase-at-a-time constraint |
| Embed legacy apps via iframe | Cross-origin session handling, CSP complexity, accessibility problems |

## Consequences

- One additional app to build and test (accessibility tests from the prompt apply here).
- Legacy JSOM frontend stays supported until the portal has equivalent routes; duplicated maintenance in the interim.
- Staff tools remain separate, which keeps administrator surfaces out of the student bundle (smaller attack surface).

## Security and privacy notes

- Staff and student bundles are separate builds; no admin routes ship in the student portal.
- Route guards in the UI are convenience only. Authorization lives in services and RLS.
- A strict CSP, no inline scripts, and no third-party analytics on pages that render profile data.

## Verification required before acceptance

- Phase 3 demonstrates shared login across portal and planner API calls with one session and a logout that clears both.
- Accessibility check (keyboard path through onboarding, form labels, contrast) on the onboarding screens.

## Open questions for the owner

1. Is the portal intended for students only, with faculty tools staying separate?
2. Is a UTD-branded or neutral visual identity expected?
