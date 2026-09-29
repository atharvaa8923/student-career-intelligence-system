begin;
create or replace view api_syllabus.programs with(security_invoker=true) as
 select id,name,department,description,created_at from syllabus.program_groups;
commit;
