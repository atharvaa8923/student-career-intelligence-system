# Step 6 — Controlled catalog import and reconciliation

Status: implemented, imported, and verified on 2026-09-27.

## Sources discovered

The supplied JSOM workspace contains a 2025 catalog seed and a separate prerequisite source. The supplied SyllabusCheck workspace contains schema and keyword reclassification SQL, but no database dump, CSV, or application-data export.

| Source | SHA-256 | Treatment |
|---|---|---|
| `jsom-planner/database/seed.sql` | `8e89987b421f74a483330218c34882676e65e009f69ad8197e846eb75862aabc` | Allowlisted catalog tables imported |
| `jsom-planner/database/migrations/real_prereqs_v2.sql` | `aacd754268dc40b8cbb785153e72f5afc6fd88d78724128ff480dbd7c3057835` | 202 prerequisite candidates parsed and reconciled |
| SyllabusCheck source inventory | `none` | Recorded as an empty source; no records invented |

The JSOM demo user, demo student, and three demo course records were excluded. The source labels the demo password as `password123`; none of those identities or password hashes entered Supabase.

## Imported counts

| Entity | Source | Imported | Rejected |
|---|---:|---:|---:|
| Departments | 15 | 15 | 0 |
| Programs | 39 | 39 | 0 |
| 2025 program versions | 39 | 39 | 0 |
| Courses | 331 | 331 | 0 |
| Program core assignments | 293 | 293 | 0 |
| Concentrations | 72 | 72 | 0 |
| Concentration-course assignments | 649 | 649 | 0 |
| Course prerequisites | 202 | 188 | 14 |

The 188 accepted prerequisite edges comprise 68 `AND` edges and 120 `OR` edges. OR semantics were derived from multiple candidates sharing the same target course and group number.

## Quarantined prerequisite references

Fourteen edges referenced courses missing from the source catalog and were written to `private.import_rejections` rather than loaded:

- BUAN 6340 → MIS 6323
- BUAN 6341 → OPRE 6399
- CS 6324 → CS 5343
- CS 6324 → CS 5348
- CS 6348 → CS 5343
- CS 6349 → CS 5390
- MECO 6303 → OPRE 6303
- MIS 6341 → OPRE 6399
- SYSM 6307 → ENGR 2300
- SYSM 6307 → EE 4310
- SYSM 6307 → MECH 4310
- SYSM 6308 → SE 5354
- SYSM 6310 → SE 5354
- SYSM 6319 → OPRE 6303

These need catalog evidence before their missing prerequisite courses are added.

## Import controls

- Extraction accepts only six allowlisted catalog INSERT targets.
- Expected source counts and SHA-256 hashes make source changes visible.
- Staging schemas are temporary and dropped after each successful import.
- Catalog IDs are preserved; program-version IDs are deterministic for catalog year 2025.
- Imports use upserts and the prerequisite workflow was run twice successfully to prove idempotency.
- Import runs, counts, source hashes, empty sources, and rejected rows are stored in protected `private` tables.
- Foreign-key and orphan checks run before commit.

## Verification

Hosted reconciliation assertions passed for every imported count, all manifest equations, prerequisite rejection details, and catalog relationships. The migration history is represented by `202609270004_import_foundation.sql`; executable import and reconciliation files are in `supabase-foundation/imports`, `scripts`, and `tests`.

No student records, Auth users, syllabus documents, reports, embeddings, or files were available for legitimate migration.

## Next boundary

Step 7 should adapt the application queries and ORM mappings to the schema-qualified hosted tables, connect file upload/download to the private buckets, and verify signup, planning, syllabus upload, scoring, report access, and deletion end to end.
