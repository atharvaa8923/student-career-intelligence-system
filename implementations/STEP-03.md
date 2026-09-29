# Step 03 — Local Supabase and identity foundation

Status: complete for the hosted development foundation.

## Implemented

- Added a project-scoped Supabase CLI dependency, locked by `package-lock.json`; CLI version verified as 2.118.0 and authenticated through the user's Supabase account.
- Initialized a reproducible `supabase/config.toml` without cloud credentials.
- Added `public.profiles`, keyed directly to `auth.users(id)` with cascade deletion.
- Added authorization records in non-exposed `private.app_roles`.
- Added an Auth signup trigger that creates a profile but grants no role.
- Added authenticated, idempotent baseline enrollment: JSOM receives `student`; SyllabusCheck receives `professor`.
- Added an authenticated function that returns only the caller's application roles.
- Enabled profile RLS with owner-only SELECT and UPDATE; browser roles have no direct access to the role table.
- Added 18 pgTAP assertions for the real local Supabase stack and a separate plain-PostgreSQL integration harness.
- Hardened local configuration: explicit table exposure, no anonymous sign-in, 12-character letter/digit passwords, 20 MiB storage limit and exact local application redirect families.

No administrator, advisor or catalog-editor assignment endpoint exists. Those roles must later use a trusted, auditable staff workflow. The current `professor` baseline preserves SyllabusCheck's existing owner-scoped behavior; it does not verify employment or faculty affiliation and must not confer access to other users' data.

## Verification completed

The migration was applied to a fresh isolated PostgreSQL database with a minimal Supabase-compatible Auth surface. Assertions verified:

- Auth inserts create profiles and no roles.
- Authenticated users have no SELECT or INSERT privilege on `private.app_roles`.
- User A sees and updates only profile A; an update targeting profile B changes zero rows.
- JSOM and SyllabusCheck enrollment returns only their baseline roles.
- Repeated enrollment is idempotent.
- An arbitrary `admin` enrollment request fails.
- No privileged role was created.

The first test run caught an ambiguous `ON CONFLICT` expression in the enrollment function. It was corrected to reference the primary-key constraint explicitly, and the full integration harness then passed.

Supabase CLI initialization and config parsing succeeded. The Supabase database linter could not run against the lightweight PostgreSQL installation because that server lacks `plpgsql_check`; this is not a migration failure. The authoritative `supabase test db` and lint pass remain pending the full local stack.

## Hosted development project

Created `jsom-syllabus-dev`, reference `rrabxkxqyrgbgakwljmf`, in the `UTD_project` organization and East US (Ohio). No paid compute size or high-availability option was requested. The project is linked to this workspace and reports `ACTIVE_HEALTHY`. The generated database password is stored in macOS Keychain under service `supabase-jsom-syllabus-dev-db`; it was not printed or written into workspace files.

The reviewed migration was dry-run first and then applied. Local and remote migration histories both show `202609270001`. Hardened configuration was pushed. Provider and pooler properties that the Management API cannot update remain at their hosted defaults; the reported differences do not change the identity-table authorization design.

The 18 pgTAP tests could not be launched through `supabase test db --linked` because that command still requires a local Docker or Podman client to run its test harness. Instead, the plain SQL integration assertions were run directly over the hosted encrypted pooler connection inside a transaction. They passed and ended with `ROLLBACK`, leaving no synthetic users or roles. Supabase's hosted database linter checked `extensions`, `private`, and `public` and reported no schema errors.

The Supabase CLI does not expose the organization's billing plan in project metadata. Creation omitted `--size` so the organization's default allocation was used. The organization now has two active healthy projects. Confirm plan and usage in the Supabase billing dashboard before real usage. Free-tier limits and pause behavior can change.

Do not run linked/remote reset commands. No real accounts were migrated, Google OAuth was not enabled, API keys were not placed in either application, and no student data was uploaded.

## Next proposed step

Adapt each backend to validate Supabase sessions and map Supabase user IDs to the new identity foundation. That should be a separate implementation and review. Google OAuth, private Storage and application-table RLS remain later approval points.
