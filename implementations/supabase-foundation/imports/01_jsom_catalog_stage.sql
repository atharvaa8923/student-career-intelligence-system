\set ON_ERROR_STOP on
begin;
drop schema if exists import_stage cascade;
create schema import_stage;
set local search_path = import_stage, public;

create table departments(id uuid primary key, name text unique not null);
create table programs(
 id uuid primary key, department_id uuid, program_name text unique not null, program_type text,
 catalog_url text, total_sch numeric, is_stem boolean, prerequisites_notes text,
 num_core_courses int, total_core_sch numeric, total_elective_sch numeric,
 num_concentrations int, notes text, updated_at timestamptz default now()
);
create table courses(
 id uuid primary key, subject text not null, course_number text not null, title text,
 credit_hours numeric, unique(subject,course_number)
);
create table program_core_courses(
 id uuid primary key, program_id uuid not null, course_id uuid not null,
 raw_text text, sort_order int default 0, unique(program_id,course_id)
);
create table concentrations(
 id uuid primary key, program_id uuid not null, name text not null, required_sch numeric default 0,
 free_elective_sch numeric default 0, free_elective_notes text, sort_order int default 0,
 is_active boolean default true, unique(program_id,name)
);
create table concentration_courses(
 id uuid primary key, concentration_id uuid not null, course_id uuid not null,
 group_label text default 'A', min_from_group int default 1, raw_text text,
 unique(concentration_id,course_id)
);
commit;
