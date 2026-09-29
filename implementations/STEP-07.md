# Step 7 — Hosted runtime and private Storage adaptation

Status: implementation and hosted database verification completed on 2026-09-27. One deployment input remains: download the project root certificate from Supabase Database Settings and set `DB_SSL_CA` to its absolute path before starting either production backend.

## Runtime integration

The hosted database now exposes `api_jsom` and `api_syllabus` compatibility schemas backed by the normalized Step 5 tables. Every view uses `security_invoker=true`, so the underlying RLS policies remain effective.

The JSOM database adapter now establishes a fresh transaction for each query, switches to `anon` for catalog requests or `authenticated` for signed-in requests, sets the verified Supabase user ID with transaction-local configuration, and sets the adapter search path. Pooled connections cannot retain identity between transactions. The former local `users` table is no longer used by authentication; Supabase Auth IDs own planner records directly.

SyllabusCheck now establishes the same transaction-local authenticated context in its SQLAlchemy request session. Its `User` object is request-scoped and comes from the validated Supabase identity rather than a local password table.

Login audit events use a narrow security-definer function that derives the actor from `auth.uid()`. Browser roles have no direct access to the private audit table.

## Private files

Syllabus uploads now:

1. enforce extension and size limits;
2. write to `syllabi/<auth-user-id>/<document-id>.<extension>`;
3. use a temporary local file only for parsing;
4. remove that temporary file immediately; and
5. persist only the private object path.

Generated PDF/XLSX reports are uploaded to the private `reports` bucket, removed from local disk, downloaded through an authenticated backend request, and deleted from Storage when their report record is deleted.

## Hosted verification

- Anonymous users can read the 39-program catalog and cannot access student rows.
- An authenticated synthetic user can create a planner profile and planned course through `api_jsom`.
- The same user can create a syllabus program, private document, and private report through `api_syllabus`.
- A second user sees none of the first user's documents or reports.
- Auth-derived audit insertion succeeds without direct private-table grants.
- A real temporary Supabase account completed private Storage upload, authenticated download, and deletion; the account and cascading records were then deleted.
- Both frontend production builds pass.
- Node syntax and Python compilation pass.
- Supabase database lint reports no errors.
- Hosted migration history is current through `202609270008_program_view_write_fix.sql`.

## TLS deployment input

The backends now reject unverified database certificates in production. Supabase documents that full certificate verification requires downloading the project root certificate from **Dashboard → Database Settings → SSL Configuration** and configuring the driver with it. Set:

```text
DB_SSL_CA=/absolute/path/to/prod-supabase.cer
```

The certificate is project configuration, so it is not committed to source control. Backend HTTP startup was intentionally not weakened with `rejectUnauthorized:false`; final HTTP smoke testing should run after this certificate is available.

Official guidance: https://supabase.com/docs/guides/database/connecting-to-postgres
