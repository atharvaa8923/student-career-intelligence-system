begin;

alter table planner.students add column enrollment_semester text check (enrollment_semester in ('Fall','Spring','Summer'));
alter table planner.students add column is_full_time boolean not null default true;
alter table planner.student_courses drop constraint student_courses_status_check;
alter table planner.student_courses add constraint student_courses_status_check check (status in ('planned','enrolled','completed','withdrawn','dropped','waived'));
alter table planner.student_courses add column grade_points numeric(3,2);
alter table planner.student_courses add column section_id text;
alter table planner.student_courses add column updated_at timestamptz not null default now();

create schema if not exists api_jsom;
revoke all on schema api_jsom from public;
grant usage on schema api_jsom to anon, authenticated;

create view api_jsom.departments with (security_invoker=true) as select id,name,code,created_at from catalog.departments;
create view api_jsom.programs with (security_invoker=true) as
 select v.id,v.program_id legacy_program_id,p.department_id,p.name program_name,p.program_type,
        v.source_url catalog_url,v.total_credit_hours total_sch,p.is_stem,v.requirements_notes prerequisites_notes,
        (select count(*) from catalog.program_core_courses x where x.program_version_id=v.id) num_core_courses,
        coalesce((select sum(c.credit_hours) from catalog.program_core_courses x join catalog.courses c on c.id=x.course_id where x.program_version_id=v.id),0) total_core_sch,
        greatest(v.total_credit_hours-coalesce((select sum(c.credit_hours) from catalog.program_core_courses x join catalog.courses c on c.id=x.course_id where x.program_version_id=v.id),0),0) total_elective_sch,
        (select count(*) from catalog.concentrations x where x.program_version_id=v.id) num_concentrations,
        v.notes,p.active is_active,v.created_at,v.created_at updated_at
 from catalog.program_versions v join catalog.programs p on p.id=v.program_id;
create view api_jsom.courses with (security_invoker=true) as
 select id,subject,course_number,(subject||' '||course_number) full_code,title,description,credit_hours,
        null::text prereq_text,null::text nebula_id,active is_active,created_at,created_at updated_at
 from catalog.courses;
create view api_jsom.course_prerequisites with (security_invoker=true) as
 select id,course_id,requires_course_id,prerequisite_type prereq_type,logic_group,group_id,now() created_at from catalog.course_prerequisites;
create view api_jsom.program_core_courses with (security_invoker=true) as
 select id,program_version_id program_id,course_id,raw_text,sort_order,or_group_id,now() created_at from catalog.program_core_courses;
create view api_jsom.concentrations with (security_invoker=true) as
 select id,program_version_id program_id,name,minimum_credit_hours required_sch,0::numeric free_elective_sch,
        free_elective_notes,sort_order,true is_active,now() created_at,now() updated_at from catalog.concentrations;
create view api_jsom.concentration_courses with (security_invoker=true) as
 select legacy_id id,concentration_id,course_id,group_label,minimum_from_group min_from_group,raw_text,now() created_at
 from catalog.concentration_courses;
create view api_jsom.students with (security_invoker=true) as
 select id,user_id,program_version_id program_id,concentration_id,enrollment_year,enrollment_semester,
        to_char(expected_graduation,'YYYY-MM') expected_graduation,gpa,is_full_time,null::text advisor_notes,created_at,updated_at
 from planner.students;
create view api_jsom.student_courses with (security_invoker=true) as
 select id,student_id,course_id,term semester,academic_year as "year",status,grade,grade_points,section_id,notes,created_at,updated_at
 from planner.student_courses;
create view api_jsom.course_sections with (security_invoker=true) as
 select id,course_id,source_id nebula_id,term semester,academic_year as "year",instructor professor,
        schedule->>'days' days,(schedule->>'start_time')::time start_time,(schedule->>'end_time')::time end_time,
        schedule->>'location' location,schedule->>'modality' modality,
        null::int seats_total,null::int seats_filled,last_synced_at fetched_at
 from catalog.course_sections;

grant select on all tables in schema catalog to anon;
create policy catalog_anon_read on catalog.departments for select to anon using (true);
create policy catalog_anon_read on catalog.programs for select to anon using (true);
create policy catalog_anon_read on catalog.program_versions for select to anon using (true);
create policy catalog_anon_read on catalog.courses for select to anon using (true);
create policy catalog_anon_read on catalog.course_prerequisites for select to anon using (true);
create policy catalog_anon_read on catalog.program_core_courses for select to anon using (true);
create policy catalog_anon_read on catalog.concentrations for select to anon using (true);
create policy catalog_anon_read on catalog.concentration_courses for select to anon using (true);
create policy catalog_anon_read on catalog.course_sections for select to anon using (true);

grant select on api_jsom.departments,api_jsom.programs,api_jsom.courses,api_jsom.course_prerequisites,
 api_jsom.program_core_courses,api_jsom.concentrations,api_jsom.concentration_courses,api_jsom.course_sections to anon,authenticated;
grant select,insert,update,delete on api_jsom.students,api_jsom.student_courses to authenticated;

commit;
