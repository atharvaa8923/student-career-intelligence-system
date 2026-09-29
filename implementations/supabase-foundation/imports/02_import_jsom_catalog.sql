\set ON_ERROR_STOP on
begin;

do $$ begin
 if (select count(*) from import_stage.departments) <> 15 then raise exception 'expected 15 departments'; end if;
 if (select count(*) from import_stage.programs) <> 39 then raise exception 'expected 39 programs'; end if;
 if (select count(*) from import_stage.courses) <> 331 then raise exception 'expected 331 courses'; end if;
 if (select count(*) from import_stage.program_core_courses) <> 293 then raise exception 'expected 293 core assignments'; end if;
 if (select count(*) from import_stage.concentrations) <> 72 then raise exception 'expected 72 concentrations'; end if;
 if (select count(*) from import_stage.concentration_courses) <> 649 then raise exception 'expected 649 concentration assignments'; end if;
 if exists(select 1 from import_stage.programs p left join import_stage.departments d on d.id=p.department_id where d.id is null) then raise exception 'orphan program'; end if;
 if exists(select 1 from import_stage.program_core_courses x left join import_stage.programs p on p.id=x.program_id left join import_stage.courses c on c.id=x.course_id where p.id is null or c.id is null) then raise exception 'orphan core assignment'; end if;
 if exists(select 1 from import_stage.concentration_courses x left join import_stage.concentrations c on c.id=x.concentration_id left join import_stage.courses k on k.id=x.course_id where c.id is null or k.id is null) then raise exception 'orphan concentration assignment'; end if;
end $$;

insert into catalog.departments(id,name)
select id,name from import_stage.departments
on conflict(id) do update set name=excluded.name;

insert into catalog.programs(id,department_id,name,program_type,is_stem,active)
select id,department_id,program_name,program_type,is_stem,true from import_stage.programs
on conflict(id) do update set department_id=excluded.department_id,name=excluded.name,program_type=excluded.program_type,is_stem=excluded.is_stem;

insert into catalog.program_versions(id,program_id,catalog_year,total_credit_hours,source_url,requirements_notes,notes)
select md5(id::text||':2025')::uuid,id,2025,total_sch,catalog_url,prerequisites_notes,notes from import_stage.programs
on conflict(program_id,catalog_year) do update set total_credit_hours=excluded.total_credit_hours,source_url=excluded.source_url,requirements_notes=excluded.requirements_notes,notes=excluded.notes;

insert into catalog.courses(id,subject,course_number,title,credit_hours)
select id,subject,course_number,title,credit_hours from import_stage.courses
on conflict(id) do update set subject=excluded.subject,course_number=excluded.course_number,title=excluded.title,credit_hours=excluded.credit_hours;

insert into catalog.program_core_courses(id,program_version_id,course_id,sort_order,raw_text)
select x.id,md5(x.program_id::text||':2025')::uuid,x.course_id,x.sort_order,x.raw_text from import_stage.program_core_courses x
on conflict(id) do update set program_version_id=excluded.program_version_id,course_id=excluded.course_id,sort_order=excluded.sort_order,raw_text=excluded.raw_text;

insert into catalog.concentrations(id,program_version_id,name,minimum_credit_hours,free_elective_notes,sort_order)
select id,md5(program_id::text||':2025')::uuid,name,required_sch,free_elective_notes,sort_order from import_stage.concentrations
on conflict(id) do update set program_version_id=excluded.program_version_id,name=excluded.name,minimum_credit_hours=excluded.minimum_credit_hours,free_elective_notes=excluded.free_elective_notes,sort_order=excluded.sort_order;

insert into catalog.concentration_courses(concentration_id,course_id,legacy_id,group_label,minimum_from_group,raw_text)
select concentration_id,course_id,id,group_label,min_from_group,raw_text from import_stage.concentration_courses
on conflict(concentration_id,course_id) do update set legacy_id=excluded.legacy_id,group_label=excluded.group_label,minimum_from_group=excluded.minimum_from_group,raw_text=excluded.raw_text;

\if :{?source_sha256}
\else
  \set source_sha256 'missing'
\endif
insert into private.import_runs(source_name,source_sha256,source_kind,status,completed_at,notes)
values('jsom-planner/database/seed.sql', :'source_sha256', 'catalog_seed', 'complete', now(), 'Demo users and student records explicitly excluded.')
on conflict(source_name,source_sha256) do update set status='complete',completed_at=now(),notes=excluded.notes;

with run as (select id from private.import_runs where source_name='jsom-planner/database/seed.sql' and source_sha256=:'source_sha256'), counts(entity,n) as (
 values ('departments',15::bigint),('programs',39::bigint),('program_versions',39::bigint),('courses',331::bigint),
 ('program_core_courses',293::bigint),('concentrations',72::bigint),('concentration_courses',649::bigint)
)
insert into private.import_counts(run_id,entity,source_count,imported_count,rejected_count)
select run.id,counts.entity,counts.n,counts.n,0 from run cross join counts
on conflict(run_id,entity) do update set source_count=excluded.source_count,imported_count=excluded.imported_count,rejected_count=excluded.rejected_count;

insert into private.import_runs(source_name,source_sha256,source_kind,status,completed_at,notes)
values('syllabus-check/source-inventory','none','application_export','empty',now(),'No database dump, CSV, or application-data export was present in the supplied workspace.')
on conflict(source_name,source_sha256) do update set status='empty',completed_at=now(),notes=excluded.notes;

drop schema import_stage cascade;
commit;
