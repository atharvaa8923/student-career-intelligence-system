begin;

create extension if not exists vector with schema extensions;
create extension if not exists pg_trgm with schema extensions;

create schema if not exists catalog;
create schema if not exists planner;
create schema if not exists syllabus;

revoke all on schema catalog, planner, syllabus from public, anon;
grant usage on schema catalog, planner, syllabus to authenticated;

create or replace function private.has_app_role(target_application text, allowed_roles text[])
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from private.app_roles r
    where r.user_id = auth.uid() and r.application = target_application
      and r.role = any(allowed_roles)
  );
$$;
revoke all on function private.has_app_role(text, text[]) from public, anon, authenticated;

create table catalog.departments (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  code text unique,
  created_at timestamptz not null default now()
);
create table catalog.programs (
  id uuid primary key default gen_random_uuid(),
  department_id uuid references catalog.departments(id),
  name text not null unique,
  program_type text not null,
  is_stem boolean not null default false,
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create table catalog.program_versions (
  id uuid primary key default gen_random_uuid(),
  program_id uuid not null references catalog.programs(id) on delete cascade,
  catalog_year int not null check (catalog_year between 2000 and 2200),
  total_credit_hours numeric(5,2) not null check (total_credit_hours >= 0),
  source_url text,
  created_at timestamptz not null default now(),
  unique(program_id, catalog_year)
);
create table catalog.courses (
  id uuid primary key default gen_random_uuid(),
  subject text not null,
  course_number text not null,
  title text not null,
  description text,
  credit_hours numeric(4,2) not null default 3 check (credit_hours > 0),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique(subject, course_number)
);
create table catalog.course_prerequisites (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references catalog.courses(id) on delete cascade,
  requires_course_id uuid not null references catalog.courses(id) on delete cascade,
  prerequisite_type text not null default 'required' check (prerequisite_type in ('required','recommended','concurrent')),
  logic_group text not null default 'AND' check (logic_group in ('AND','OR')),
  group_id int not null default 0 check (group_id >= 0),
  check (course_id <> requires_course_id), unique(course_id, requires_course_id)
);
create table catalog.program_core_courses (
  id uuid primary key default gen_random_uuid(),
  program_version_id uuid not null references catalog.program_versions(id) on delete cascade,
  course_id uuid not null references catalog.courses(id),
  or_group_id int not null default 0 check (or_group_id >= 0),
  sort_order int not null default 0,
  unique(program_version_id, course_id)
);
create table catalog.concentrations (
  id uuid primary key default gen_random_uuid(),
  program_version_id uuid not null references catalog.program_versions(id) on delete cascade,
  name text not null,
  minimum_credit_hours numeric(5,2) not null default 0 check (minimum_credit_hours >= 0),
  unique(program_version_id, name), unique(id, program_version_id)
);
create table catalog.concentration_courses (
  concentration_id uuid not null references catalog.concentrations(id) on delete cascade,
  course_id uuid not null references catalog.courses(id),
  required boolean not null default false,
  primary key(concentration_id, course_id)
);
create table catalog.course_sections (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references catalog.courses(id) on delete cascade,
  source_id text,
  term text not null,
  academic_year int not null check (academic_year between 2000 and 2200),
  instructor text,
  schedule jsonb not null default '{}'::jsonb,
  last_synced_at timestamptz,
  unique(course_id, term, academic_year, source_id)
);

create table planner.students (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  program_version_id uuid references catalog.program_versions(id),
  concentration_id uuid,
  enrollment_year int check (enrollment_year between 2000 and 2200),
  expected_graduation date,
  gpa numeric(3,2) check (gpa between 0 and 4),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (concentration_id, program_version_id)
    references catalog.concentrations(id, program_version_id)
);
create table planner.student_courses (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references planner.students(id) on delete cascade,
  course_id uuid not null references catalog.courses(id),
  term text,
  academic_year int check (academic_year between 2000 and 2200),
  status text not null check (status in ('planned','enrolled','completed','withdrawn')),
  grade text,
  verification_status text not null default 'self_reported' check (verification_status in ('self_reported','institution_verified')),
  notes text,
  created_at timestamptz not null default now(),
  unique(student_id, course_id, term, academic_year)
);

create table syllabus.program_groups (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  department text,
  catalog_program_id uuid references catalog.programs(id),
  created_at timestamptz not null default now()
);
create table syllabus.documents (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  catalog_course_id uuid references catalog.courses(id),
  program_group_id uuid references syllabus.program_groups(id),
  title text not null,
  course_code text,
  term text,
  object_path text,
  object_checksum text,
  raw_text text,
  parsed_topics jsonb,
  parsed_sections jsonb,
  status text not null default 'pending' check (status in ('pending','uploaded','parsing','parsed','failed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(owner_id, object_path)
);
create table syllabus.job_postings (
  id uuid primary key default gen_random_uuid(),
  source text not null,
  external_id text,
  title text not null,
  company text,
  location text,
  description text,
  url text,
  posted_at timestamptz,
  scraped_at timestamptz not null default now(),
  unique(source, external_id)
);
create table syllabus.keywords (
  id uuid primary key default gen_random_uuid(),
  normalized_keyword text not null unique,
  category text,
  importance text not null default 'required',
  is_emerging boolean not null default false,
  embedding extensions.vector(384),
  embedding_model text,
  embedding_version text
);
create table syllabus.job_keywords (
  job_id uuid not null references syllabus.job_postings(id) on delete cascade,
  keyword_id uuid not null references syllabus.keywords(id) on delete cascade,
  relevance numeric(5,4) check (relevance between 0 and 1),
  primary key(job_id, keyword_id)
);
create table syllabus.coverage_runs (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references syllabus.documents(id) on delete cascade,
  algorithm_version text not null,
  status text not null default 'pending' check (status in ('pending','running','complete','failed')),
  score numeric(5,2) check (score between 0 and 100),
  created_at timestamptz not null default now()
);
create table syllabus.coverage_rows (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references syllabus.coverage_runs(id) on delete cascade,
  keyword_id uuid not null references syllabus.keywords(id),
  score numeric(5,4) not null check (score between 0 and 1),
  status text not null check (status in ('covered','partial','missing')),
  unique(run_id, keyword_id)
);
create table syllabus.reports (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  filters jsonb not null default '{}'::jsonb,
  summary jsonb,
  pdf_object_path text,
  spreadsheet_object_path text,
  status text not null default 'pending' check (status in ('pending','generating','complete','failed')),
  created_at timestamptz not null default now()
);

create table private.advisor_notes (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references planner.students(id) on delete cascade,
  author_id uuid not null references auth.users(id),
  note text not null,
  created_at timestamptz not null default now()
);
create table private.processing_jobs (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references auth.users(id) on delete cascade,
  resource_type text not null,
  resource_id uuid not null,
  state text not null check (state in ('queued','running','complete','failed')),
  attempts int not null default 0 check (attempts >= 0),
  error_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index planner_students_user_idx on planner.students(user_id);
create index planner_student_courses_student_idx on planner.student_courses(student_id);
create index syllabus_documents_owner_idx on syllabus.documents(owner_id);
create index syllabus_coverage_runs_document_idx on syllabus.coverage_runs(document_id);
create index syllabus_coverage_rows_run_idx on syllabus.coverage_rows(run_id);
create index syllabus_reports_owner_idx on syllabus.reports(owner_id);

alter table catalog.departments enable row level security;
alter table catalog.programs enable row level security;
alter table catalog.program_versions enable row level security;
alter table catalog.courses enable row level security;
alter table catalog.course_prerequisites enable row level security;
alter table catalog.program_core_courses enable row level security;
alter table catalog.concentrations enable row level security;
alter table catalog.concentration_courses enable row level security;
alter table catalog.course_sections enable row level security;
alter table planner.students enable row level security;
alter table planner.student_courses enable row level security;
alter table syllabus.program_groups enable row level security;
alter table syllabus.documents enable row level security;
alter table syllabus.job_postings enable row level security;
alter table syllabus.keywords enable row level security;
alter table syllabus.job_keywords enable row level security;
alter table syllabus.coverage_runs enable row level security;
alter table syllabus.coverage_rows enable row level security;
alter table syllabus.reports enable row level security;
alter table private.advisor_notes enable row level security;
alter table private.processing_jobs enable row level security;

grant select on all tables in schema catalog to authenticated;
grant select on syllabus.program_groups, syllabus.job_postings, syllabus.keywords, syllabus.job_keywords to authenticated;
grant select, insert, update, delete on planner.students, planner.student_courses, syllabus.documents, syllabus.reports to authenticated;
grant select on syllabus.coverage_runs, syllabus.coverage_rows to authenticated;

create policy catalog_read on catalog.departments for select to authenticated using (true);
create policy catalog_read on catalog.programs for select to authenticated using (true);
create policy catalog_read on catalog.program_versions for select to authenticated using (true);
create policy catalog_read on catalog.courses for select to authenticated using (true);
create policy catalog_read on catalog.course_prerequisites for select to authenticated using (true);
create policy catalog_read on catalog.program_core_courses for select to authenticated using (true);
create policy catalog_read on catalog.concentrations for select to authenticated using (true);
create policy catalog_read on catalog.concentration_courses for select to authenticated using (true);
create policy catalog_read on catalog.course_sections for select to authenticated using (true);

create policy student_owner on planner.students for select to authenticated using (user_id = auth.uid());
create policy student_owner_insert on planner.students for insert to authenticated with check (user_id = auth.uid());
create policy student_owner_update on planner.students for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy student_owner_delete on planner.students for delete to authenticated using (user_id = auth.uid());
create policy student_course_owner on planner.student_courses for all to authenticated
  using (exists(select 1 from planner.students s where s.id=student_id and s.user_id=auth.uid()))
  with check (exists(select 1 from planner.students s where s.id=student_id and s.user_id=auth.uid()));

create policy syllabus_reference_read on syllabus.program_groups for select to authenticated using (true);
create policy syllabus_reference_read on syllabus.job_postings for select to authenticated using (true);
create policy syllabus_reference_read on syllabus.keywords for select to authenticated using (true);
create policy syllabus_reference_read on syllabus.job_keywords for select to authenticated using (true);
create policy document_owner on syllabus.documents for all to authenticated using (owner_id=auth.uid()) with check (owner_id=auth.uid());
create policy report_owner on syllabus.reports for all to authenticated using (owner_id=auth.uid()) with check (owner_id=auth.uid());
create policy coverage_run_owner on syllabus.coverage_runs for select to authenticated using (
  exists(select 1 from syllabus.documents d where d.id=document_id and d.owner_id=auth.uid()));
create policy coverage_row_owner on syllabus.coverage_rows for select to authenticated using (
  exists(select 1 from syllabus.coverage_runs r join syllabus.documents d on d.id=r.document_id where r.id=run_id and d.owner_id=auth.uid()));

insert into storage.buckets(id, name, public, file_size_limit, allowed_mime_types)
values ('syllabi','syllabi',false,20971520,array['application/pdf','application/vnd.openxmlformats-officedocument.wordprocessingml.document','application/msword']),
       ('reports','reports',false,52428800,array['application/pdf','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'])
on conflict(id) do update set public=false, file_size_limit=excluded.file_size_limit, allowed_mime_types=excluded.allowed_mime_types;

create policy syllabi_owner_read on storage.objects for select to authenticated using (bucket_id='syllabi' and (storage.foldername(name))[1]=auth.uid()::text);
create policy syllabi_owner_insert on storage.objects for insert to authenticated with check (bucket_id='syllabi' and (storage.foldername(name))[1]=auth.uid()::text);
create policy syllabi_owner_update on storage.objects for update to authenticated using (bucket_id='syllabi' and (storage.foldername(name))[1]=auth.uid()::text) with check (bucket_id='syllabi' and (storage.foldername(name))[1]=auth.uid()::text);
create policy syllabi_owner_delete on storage.objects for delete to authenticated using (bucket_id='syllabi' and (storage.foldername(name))[1]=auth.uid()::text);
create policy reports_owner_read on storage.objects for select to authenticated using (bucket_id='reports' and (storage.foldername(name))[1]=auth.uid()::text);
create policy reports_owner_delete on storage.objects for delete to authenticated using (bucket_id='reports' and (storage.foldername(name))[1]=auth.uid()::text);

commit;
