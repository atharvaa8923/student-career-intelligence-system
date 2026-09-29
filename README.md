# Student Career Intelligence System

This repository contains an end-to-end student career platform that connects curriculum analysis, degree planning, job-market evidence, and secure profile data.

## Components

- **SyllabusCheck** analyzes ITM and Business Analytics syllabi against skills found explicitly in job descriptions.
- **JSOM Planner** provides degree planning, course selection, scheduling, and student/admin workflows.
- **Supabase Foundation** defines shared identity, application data, row-level security, audit, and integration migrations.
- **Agent registry and status files** provide the foundation for a coordinating master agent and task-specific agents.
- **Reports** contain the generated ITM and Business Analytics market-alignment report and its reproducible document builder.

## Repository layout

```text
assessments/                     Architecture and database assessments
implementations/jsom-planner/    Degree-planning application
implementations/syllabus-check/  Curriculum and job-market analysis application
implementations/supabase-foundation/ Shared Supabase schema and migrations
implementations/reports/         Generated report and report builder
MASTER.md                         Master-agent operating design
registry.json                     Agent registry
events.jsonl                      Agent event history
```

Each application folder has its own setup instructions and environment-variable examples. Local `.env` files, dependencies, virtual environments, build output, and database runtime data are excluded from version control.

## Security

Student and profile data must remain private. The database layer uses Supabase authentication, row-level security, role-aware access, audit records, and server-side service credentials. Never commit real secrets or production student data.

