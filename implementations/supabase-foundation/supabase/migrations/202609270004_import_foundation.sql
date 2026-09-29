begin;

alter table catalog.program_versions add column requirements_notes text;
alter table catalog.program_versions add column notes text;
alter table catalog.program_core_courses add column raw_text text;
alter table catalog.concentrations add column free_elective_notes text;
alter table catalog.concentrations add column sort_order int not null default 0;
alter table catalog.concentration_courses add column legacy_id uuid unique;
alter table catalog.concentration_courses add column group_label text not null default 'A';
alter table catalog.concentration_courses add column minimum_from_group int not null default 1 check (minimum_from_group > 0);
alter table catalog.concentration_courses add column raw_text text;

create table private.import_runs (
  id uuid primary key default gen_random_uuid(),
  source_name text not null,
  source_sha256 text not null,
  source_kind text not null,
  status text not null check (status in ('started','complete','failed','empty')),
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  notes text,
  unique(source_name, source_sha256)
);
create table private.import_counts (
  run_id uuid not null references private.import_runs(id) on delete cascade,
  entity text not null,
  source_count bigint not null check (source_count >= 0),
  imported_count bigint not null check (imported_count >= 0),
  rejected_count bigint not null check (rejected_count >= 0),
  primary key(run_id, entity),
  check (source_count = imported_count + rejected_count)
);
create table private.import_rejections (
  id bigint generated always as identity primary key,
  run_id uuid not null references private.import_runs(id) on delete cascade,
  entity text not null,
  source_key text,
  reason_code text not null,
  detail text,
  created_at timestamptz not null default now()
);

alter table private.import_runs enable row level security;
alter table private.import_counts enable row level security;
alter table private.import_rejections enable row level security;
revoke all on private.import_runs, private.import_counts, private.import_rejections from public, anon, authenticated;

commit;
