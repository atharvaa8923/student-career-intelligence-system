\set ON_ERROR_STOP on
begin;

\if :{?source_sha256}
\else
  \set source_sha256 'missing'
\endif
insert into private.import_runs(source_name,source_sha256,source_kind,status,notes)
values('jsom-planner/database/migrations/real_prereqs_v2.sql', :'source_sha256', 'catalog_prerequisites', 'started', 'Only parsed prerequisite INSERT statements are eligible.')
on conflict(source_name,source_sha256) do update set status='started',completed_at=null,notes=excluded.notes;

with run as (
 select id from private.import_runs where source_name='jsom-planner/database/migrations/real_prereqs_v2.sql' and source_sha256=:'source_sha256'
)
delete from private.import_rejections r using run where r.run_id=run.id and r.entity='course_prerequisites';

with run as (
 select id from private.import_runs where source_name='jsom-planner/database/migrations/real_prereqs_v2.sql' and source_sha256=:'source_sha256'
)
insert into private.import_rejections(run_id,entity,source_key,reason_code,detail)
select run.id,'course_prerequisites',c.legacy_id::text,'missing_course_reference',
       concat_ws(',',case when course.id is null then 'course_id='||c.course_id end,case when required.id is null then 'requires_course_id='||c.requires_course_id end)
from import_stage.prerequisite_candidates c cross join run
left join catalog.courses course on course.id=c.course_id
left join catalog.courses required on required.id=c.requires_course_id
where course.id is null or required.id is null;

with candidates as (
 select c.*,count(*) over(partition by c.course_id,c.group_id) group_size
 from import_stage.prerequisite_candidates c
)
insert into catalog.course_prerequisites(id,course_id,requires_course_id,prerequisite_type,logic_group,group_id)
select c.legacy_id,c.course_id,c.requires_course_id,c.prerequisite_type,
       case when c.group_size>1 then 'OR' else 'AND' end,
       c.group_id
from candidates c
join catalog.courses course on course.id=c.course_id
join catalog.courses required on required.id=c.requires_course_id
where c.course_id<>c.requires_course_id
on conflict(course_id,requires_course_id) do update set prerequisite_type=excluded.prerequisite_type,logic_group=excluded.logic_group,group_id=excluded.group_id;

with run as (
 select id from private.import_runs where source_name='jsom-planner/database/migrations/real_prereqs_v2.sql' and source_sha256=:'source_sha256'
), totals as (
 select count(*)::bigint source_count,
        count(*) filter(where course.id is not null and required.id is not null and c.course_id<>c.requires_course_id)::bigint imported_count
 from import_stage.prerequisite_candidates c
 left join catalog.courses course on course.id=c.course_id
 left join catalog.courses required on required.id=c.requires_course_id
)
insert into private.import_counts(run_id,entity,source_count,imported_count,rejected_count)
select run.id,'course_prerequisites',source_count,imported_count,source_count-imported_count from run cross join totals
on conflict(run_id,entity) do update set source_count=excluded.source_count,imported_count=excluded.imported_count,rejected_count=excluded.rejected_count;

update private.import_runs set status='complete',completed_at=now()
where source_name='jsom-planner/database/migrations/real_prereqs_v2.sql' and source_sha256=:'source_sha256';
drop schema import_stage cascade;
commit;
