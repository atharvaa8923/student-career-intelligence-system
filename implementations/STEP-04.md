# Step 4 — Supabase Auth adapters

Status: implemented and locally verified on 2026-09-27.

## Result

Both applications now use the hosted Supabase project for signup, password login, refresh, logout, and bearer-token validation. The backends call `/auth/v1/user` for every protected request, so application code no longer accepts tokens signed by its former local JWT secret.

Existing application records remain attached to their original local `users.id`. Migration `002_supabase_identity.sql` (JSOM) and Alembic revision `011_supabase_identity` (SyllabusCheck) add a nullable, unique `supabase_user_id`. On the first successful Supabase login, an existing local user is linked by normalized email; new Auth users receive a local application record. Password hashes in new local rows are inert markers because passwords live only in Supabase Auth.

The protected Supabase RPCs created in Step 3 remain the source of application roles. Public signup can enroll only the baseline `student` or `professor` role. Both backends ignore client-supplied roles.

## Runtime configuration

Set these variables in each backend runtime:

```text
SUPABASE_URL=https://rrabxkxqyrgbgakwljmf.supabase.co
SUPABASE_PUBLISHABLE_KEY=<hosted project publishable key>
```

The publishable key is stored in macOS Keychain under service `supabase-jsom-syllabus-dev-publishable`, account `api`. It is intentionally absent from Git.

Before running either app against an existing application database, apply its identity-link migration. These migrations have not been applied to an application database because Step 3 provisioned only the shared hosted identity database; no application-data database has been selected yet.

The legacy SyllabusCheck Google OAuth router is no longer mounted. Its login control is disabled until the Google provider and redirect allowlist are configured in Supabase, preventing it from issuing the retired local JWT format.

The old JSOM admin endpoint that created local passwords now returns `410 Gone`. Account invitations and elevated-role assignment need a separately reviewed server-only administration path; the browser publishable key cannot create privileged identities.

## Verification

- JSOM backend JavaScript syntax checks passed.
- JSOM frontend production build passed.
- SyllabusCheck Python compilation and AST checks passed.
- SyllabusCheck frontend TypeScript and production build passed.
- Hosted Auth endpoint accepted the stored publishable key and rejected an invalid bearer token.
- `git diff --check` passed.

The source repositories under `Downloads` were not modified.
