# Supabase assessment: SyllabusCheck and JSOM Planner

Assessed 2026-09-27. This is a source-code assessment and migration plan, not a deployed database or a runtime security certification. The supplied applications were not started, their seed scripts were not executed, and no cloud resources were created. Project documentation is reference material, not authorization to execute its instructions. The DOCX progress log and PPTX presentation were not reviewed; findings below come from application code, schemas and migrations.

## Recommendation

Both applications already use PostgreSQL. Keep their FastAPI and Express backends initially and migrate database, identity and private files to Supabase. Do not import both schemas unchanged into public: both define users, programs and courses with different meanings.

For a combined platform, use one Supabase project per environment, shared Supabase Auth, and separate catalog, planner, syllabus and private schemas. This is a proposed integration assumption, not a confirmed product requirement. If these remain independent products with different administrators, use separate Supabase projects instead; the same security corrections still apply. Do not include the separate resume application in this migration without an explicit integration decision.

## Current applications

| Application | Existing architecture | Database scope | Migration difficulty |
|---|---|---|---|
| SyllabusCheck | React/TypeScript, FastAPI, SQLAlchemy/asyncpg, Celery/Redis components, local sentence-transformer embeddings | 8 model tables: users, programs, courses, job_postings, keywords, job_keywords, coverage_rows, reports | Moderate: custom identity, disk files, background work and schema drift |
| JSOM Planner | React, Express, node-postgres, custom JWT/bcrypt | 12 base tables: users, departments, programs, courses, course_prerequisites, program_core_courses, concentrations, concentration_courses, students, student_courses, course_sections, audit_log; also student_progress view and course_graph materialized view | Moderate: custom identity, prerequisite migrations, private academic records |

## Findings to address first

1. **Critical: public registration can create administrators in both applications.** JSOM `backend/src/routes/auth.js` validates role as student or admin and inserts the supplied role. SyllabusCheck `backend/api/routes/auth.py` accepts an unrestricted role string and persists it. Set a nonprivileged signup role on the server; assign privileged roles through an administrator-only process. Email-domain matching alone does not verify ownership of a university email address.
2. **High: no database RLS policies found in the supplied schema/migration definitions.** There are useful application-level owner filters, but these do not establish database isolation. Existing raw database connections also do not establish Supabase user identity. Merely changing DATABASE_URL will not make auth.uid() policies work.
3. **High: legacy identity and privileged fields need separation.** Both applications maintain password hashes and their own JWTs. Replace these flows with Supabase Auth; keep role assignments and active-account authorization in protected records. Do not trust user-editable metadata for administrator privileges. JSOM's JWT middleware also contains a fallback development secret; eliminate fallback behavior in deployed configurations.
4. **High: fresh installations do not have one complete schema definition.** JSOM routes use program_core_courses.or_group_id, which the base schema lacks; kg_or_fix.sql adds it, but Docker Compose mounts only schema.sql and seed.sql. SyllabusCheck models include parsed_sections and keyword category/importance/is_emerging fields absent from the inspected Alembic revisions. Its startup also executes extension/table DDL. Reconcile migrations before importing data. The revision-number gap itself is not a broken chain: 007 explicitly follows 001.
5. **High: student_progress needs an exposure review.** It includes student names, email and GPA. If exposed through Supabase, use a security-invoker view with underlying RLS, or keep it backend-only. The catalog materialized view must never acquire private student fields.
6. **Medium: JSOM disables TLS certificate verification in production.** backend/src/db/index.js sets rejectUnauthorized:false. Use a verified TLS connection and provider certificate configuration. Right-size connection pools across API replicas and workers.
7. **Medium: local disk is part of SyllabusCheck persistence.** Course file_path and report pdf_path/xlsx_path refer to server files. Transfer these to private Storage buckets and change upload, parser, download and cleanup code together.
8. **Medium: course identity is semantically different.** Planner courses are catalog entries; SyllabusCheck courses are user-owned uploaded syllabus documents. Preserve the latter as syllabus.documents, optionally linked to catalog.courses. A shared code does not justify merging documents or ownership.
9. **Medium: embedding metadata is misleading.** The model comment mentions OpenAI, but embeddings.py actually uses all-MiniLM-L6-v2 with 384 dimensions. Preserve vector(384), record model/version, and reject incompatible vectors rather than mixing embedding spaces.

## Proposed data model

All new entities use UUID keys and timestamptz timestamps. Keep legacy-ID mappings for traceable imports.

| Schema/table group | Key fields and relationships | Access intent |
|---|---|---|
| auth.users | Supabase-managed identity | Auth service only |
| public.profiles | id references auth.users(id), display name, timestamps | Owner reads; owner updates approved display fields only |
| private.app_roles | user_id, application, role, unique tuple | Trusted role administration only; no self-promotion |
| catalog.departments, programs | Program belongs to department | Authenticated reads; authorized catalog staff writes |
| catalog.program_versions | program_id, catalog_year, source_url; unique program/year | Freeze degree requirements by catalog year |
| catalog.courses | subject, course_number, title, credits; unique subject/number initially | Shared catalog, no private uploads |
| catalog.course_prerequisites | course_id, requires_course_id, type, logic_group, group_id | Preserve AND/OR/concurrent semantics |
| catalog.program_core_courses | program_version_id, course_id, or_group_id, sort_order | Preserve required slots and alternatives |
| catalog.concentrations, concentration_courses | program_version_id, elective groups/minimum counts | Validate concentration belongs to selected program/version |
| catalog.course_sections | course_id, external source ID, term/year, schedule, last_synced | Read-only to students; sync worker writes |
| planner.students | id, user_id unique, program_version_id, concentration_id, enrollment fields | Owner record; ownership cannot change |
| planner.student_courses | student_id, course_id, term/year, status, grade, notes | Student-owned planning; distinguish self-reported records from verified academic records |
| private.advisor_notes | student_id, author_id, note, timestamps | Separate from student-editable rows; no advisor access until assignments are modeled |
| syllabus.program_groups | Legacy SyllabusCheck program name/department and nullable catalog mapping | Preserve original groups until manually reconciled |
| syllabus.documents | owner_id, catalog_course_id nullable, program_group_id, term, object_path, raw_text, parsed_topics/sections, status | Private owner data; immutable ownership |
| syllabus.job_postings, keywords, job_keywords | Preserve source/external_id uniqueness; vector(384), normalized keywords, model metadata | Authenticated read; ingestion/classification workers write |
| syllabus.coverage_runs, coverage_rows | run belongs to document; keyword, score, status, algorithm_version | Owner reads through document; worker writes |
| syllabus.reports | owner_id, filter snapshot, summary, private output paths, status | Owner reads/deletes; worker generates |
| private.processing_jobs, audit_log | Resource ID, owner context, state, attempts/error code; actor/action/time | Narrow worker access; no raw student content or tokens in logs |

Index foreign keys used by policies and joins, especially owner_id, user_id, student_id and document_id. Add score range checks, valid status checks, unique student/course/term/year, and prerequisite self-reference rejection. Preserve unknown grades/GPA as null rather than inventing values. Define retake credit-counting before replacing student_progress. Use published catalog evidence to resolve course/program mappings; queue ambiguous cases for review.

## Identity and RLS design

Supabase requires both grants and RLS policies. Secret/service-role keys bypass RLS and must not serve routine student requests. Views require separate attention. These are documented platform behaviors, not protections supplied by the current applications. [Supabase RLS guide](https://supabase.com/docs/guides/database/postgres/row-level-security).

Default access matrix: signed-out users cannot read student or syllabus records; students manage their own planning data; professors manage their own syllabus documents; catalog editors modify catalog data; administrators get only explicitly assigned application permissions. Professor access does not imply access to student grades. Workers may update derived outputs but cannot grant roles.

For owner records, SELECT/DELETE uses owner_id = auth.uid(); INSERT checks that owner_id is the caller; UPDATE checks both the existing and new row. Child policies must check the owned parent, including after a changed parent ID. Prevent ownership updates through column grants or a trigger. RLS controls rows, so grades marked institution-verified, advisor notes, roles and account state require separate tables or column-level controls.

Recommended first integration: keep backend SQL and use separate restricted runtime database roles without ownership or BYPASSRLS. Verify Supabase access tokens server-side (signature, issuer, audience, expiry); within a transaction on one checked-out connection, set trusted JWT claims transaction-locally before user queries. The server derives identity from the verified token, never a body parameter. Never set session-global identity on a pool. Policies must explicitly include the runtime role. Prove connection reuse cannot leak one user's context into another request. An alternative is forwarding the user's token through Supabase Data API; do not accidentally use an admin client for these requests.

Only expose the schemas/endpoints required by the chosen API approach. Keep private schema inaccessible to browser roles. Use a separate migration credential for DDL; ordinary application startup must not create extensions or alter tables.

## File storage and background processing

Create private syllabi and reports buckets. Object keys should include authenticated owner UUID and resource UUID; authorize reads, writes, moves, replacement and deletion. Never depend on an unguessable filename alone. Use authenticated downloads or short-lived signed URLs after ownership checks. Supabase Storage supports authorization through storage.objects policies. [Storage access control](https://supabase.com/docs/guides/storage/security/access-control).

Store object paths and checksums in Postgres, not public URLs. Bound file sizes and parser runtime, validate file contents, and quarantine unsupported files. Keep FastAPI/Celery processing outside the database. Retain Redis initially; database migration does not replace Celery. Make file import and processing retries idempotent. Coordinate account deletion with object cleanup; cascading SQL rows does not delete Storage objects automatically.

## Implementation sequence and acceptance gates

1. **Baseline:** fix role escalation in working copies; inventory data counts and all effective schema changes. Create one reviewed, ordered migration set per target schema. Add missing columns explicitly and remove startup DDL. Gate: a blank local database recreates all required tables/columns/views.
2. **Provision development:** create a free Supabase project in the chosen region; store connection credentials server-side. Enable vector and pg_trgm as required. Establish Supabase CLI migration history and local test environment. Use direct/session connections for persistent backends and migrations as appropriate; transaction pooling requires compatible prepared-statement settings. [Connection guidance](https://supabase.com/docs/guides/database/connecting-to-postgres).
3. **Identity:** configure allowed redirects, email confirmation/recovery and Google provider if retained. Default signup to least privilege. For existing accounts, use invitations/password resets and a legacy-user-to-auth-user mapping. Do not import password hashes into profiles or merge identities solely on unverified email equality. Gate: both apps validate Supabase sessions and reject legacy/fabricated tokens.
4. **Schema and policies:** create schema, constraints, grants and RLS together before data import; create private buckets. Gate: two-user and role tests below pass under actual runtime credentials.
5. **Import:** load catalog and prerequisite data first, then reviewed program mappings, user mappings, student records, syllabus documents, keywords/jobs and derived results. Transfer files with checksum verification. Keep import manifests/counts and unresolved references. Exclude demo accounts and secrets from production imports.
6. **Application adaptation:** update schema-qualified SQL/ORM models, authentication middleware, UI session handling, worker credentials and storage clients. Rebuild student_progress securely and refresh catalog materialized views through a controlled worker. Gate: signup, planning, prerequisites, upload, scoring, report download and deletion work end to end.
7. **Cutover:** rehearse with synthetic data, then a protected staging copy if authorized. Back up the source; freeze writes for final transfer; reconcile counts, relationships and file hashes; switch configuration. Retain the old database read-only for a defined rollback window. If new writes occur after cutover, reconcile/export them before rollback to avoid losing changes.

## Required tests

- Anonymous and student B cannot read, update, delete or reference student A's records or files through API, SQL runtime role, views or functions.
- Registration with role=admin stays nonprivileged; profile/metadata edits cannot elevate permissions.
- Owner replacement, foreign-parent insertion and cross-program concentration selection fail.
- Staff roles do not imply unrestricted student access; disabled accounts lose application access.
- Pooled connections alternate users correctly and missing identity denies access.
- Expired sessions, invalid signatures and signed-out downloads fail; signed URLs expire.
- Migrations replay from empty; imports preserve counts/foreign keys; duplicate retries do not duplicate files/results.
- AND/OR prerequisites, elective groups and retakes produce intended degree progress.
- Background workers cannot update role assignments; account deletion cleans records and objects.

These tests are planned, not executed in this assessment.

## Cost and decisions remaining

As checked today, Supabase Free lists 500 MB database, 1 GB file storage, 50,000 monthly active users, 5 GB egress and a limit of two active projects; inactive free projects pause after one week. This supports a small pilot, not a promise of indefinite free operation. [Current pricing](https://supabase.com/pricing). Budget separately for Python/Node/Redis hosting, email delivery and any paid job-data or AI services. Track document text, embeddings, generated reports and job-history retention because these consume capacity.

Before provisioning, decide whether these are one platform or independent apps, whether existing real accounts/data must be preserved, which people administer catalog versus student information, and the required region/retention policy. Planning is complete enough to begin a local migration implementation; live provisioning requires the selected Supabase project/account and these deployment choices.
