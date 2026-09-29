\set ON_ERROR_STOP on
do $$
declare
  catalog_run uuid;
  prereq_run uuid;
begin
  select id into strict catalog_run from private.import_runs
    where source_name='jsom-planner/database/seed.sql' and status='complete';
  select id into strict prereq_run from private.import_runs
    where source_name='jsom-planner/database/migrations/real_prereqs_v2.sql' and status='complete';

  if (select count(*) from catalog.departments) <> 15 then raise exception 'department reconciliation failed'; end if;
  if (select count(*) from catalog.programs) <> 39 then raise exception 'program reconciliation failed'; end if;
  if (select count(*) from catalog.program_versions where catalog_year=2025) <> 39 then raise exception 'program version reconciliation failed'; end if;
  if (select count(*) from catalog.courses) <> 331 then raise exception 'course reconciliation failed'; end if;
  if (select count(*) from catalog.program_core_courses) <> 293 then raise exception 'core assignment reconciliation failed'; end if;
  if (select count(*) from catalog.concentrations) <> 72 then raise exception 'concentration reconciliation failed'; end if;
  if (select count(*) from catalog.concentration_courses) <> 649 then raise exception 'concentration assignment reconciliation failed'; end if;
  if (select count(*) from catalog.course_prerequisites) <> 188 then raise exception 'prerequisite reconciliation failed'; end if;
  if (select rejected_count from private.import_counts where run_id=prereq_run and entity='course_prerequisites') <> 14 then raise exception 'prerequisite rejection count failed'; end if;
  if (select count(*) from private.import_rejections where run_id=prereq_run) <> 14 then raise exception 'prerequisite rejection detail failed'; end if;
  if exists(select 1 from catalog.programs p left join catalog.departments d on d.id=p.department_id where d.id is null) then raise exception 'orphan programs'; end if;
  if exists(select 1 from catalog.program_core_courses x left join catalog.program_versions p on p.id=x.program_version_id left join catalog.courses c on c.id=x.course_id where p.id is null or c.id is null) then raise exception 'orphan core assignment'; end if;
  if exists(select 1 from catalog.course_prerequisites x left join catalog.courses c on c.id=x.course_id left join catalog.courses r on r.id=x.requires_course_id where c.id is null or r.id is null) then raise exception 'orphan prerequisite'; end if;
  if exists(select 1 from private.import_counts where source_count<>imported_count+rejected_count) then raise exception 'manifest count equation failed'; end if;
end $$;
select 'step 6 import reconciliation passed' result;
