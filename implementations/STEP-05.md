# Step 5 — Application schemas, RLS, and private storage

Status: implemented, deployed, and verified on 2026-09-27.

## Hosted result

The hosted development project `rrabxkxqyrgbgakwljmf` now contains separated `catalog`, `planner`, `syllabus`, and `private` schemas. Migration history includes:

- `202609270002_application_data.sql` — application tables, constraints, grants, RLS policies, indexes, and Storage buckets.
- `202609270003_student_data_hardening.sql` — verified-grade protection and owner-bound file paths.

No legacy application data was imported in this step.

## Data boundaries

- `catalog`: departments, programs, immutable catalog versions, courses, prerequisites, core requirements, concentrations, and sections. Authenticated users can read this reference data; browser roles cannot write it.
- `planner`: one student record per Auth user and owner-controlled planned/enrolled/completed courses. Parent ownership is checked for every child operation.
- `syllabus`: owner-controlled documents and reports, shared job/keyword reference records, and owner-readable derived coverage results.
- `private`: application roles, advisor notes, and processing jobs. Browser roles receive no table grants.

Student GPA is explicitly self-reported. A database trigger prevents an authenticated student from creating, editing, or downgrading an institution-verified course record. A future trusted academic import process must manage verified records.

## Storage

Two private buckets are deployed:

- `syllabi`: maximum 20 MiB; PDF, DOCX, or DOC.
- `reports`: maximum 50 MiB; PDF or XLSX.

Syllabus objects must use `<auth-user-uuid>/...` paths. Owners can read, create, update, and delete their own syllabus objects. Report creation is reserved for trusted workers; owners can read and delete their own output. Database object-path checks bind document and report paths to their owner UUID.

## Verification

The hosted transaction-wrapped assertions passed and rolled back all synthetic records. They prove:

- user A can manage their own planner and syllabus records;
- user B cannot read user A's student, course, document, or Storage object;
- user B cannot insert a child row under user A's student record;
- owners cannot transfer a document to another user;
- students cannot self-certify institution-verified records;
- Storage rejects paths under another user's UUID;
- anonymous users lack planner schema access;
- both buckets remain private; and
- RLS is enabled on protected student and document tables.

The remote Supabase database linter reported no schema errors across `catalog`, `extensions`, `planner`, `private`, `public`, and `syllabus`.

## Next boundary

Step 6 should import data in dependency order with manifests and reconciliation: catalog first, reviewed program mappings second, then identity mappings, student records, syllabus records, and derived data. File transfer should use checksums and keep unresolved references out of production tables.
