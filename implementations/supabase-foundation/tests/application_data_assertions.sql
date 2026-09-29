\set ON_ERROR_STOP on
begin;

insert into auth.users (id, email, raw_user_meta_data) values
 ('20000000-0000-0000-0000-000000000001','owner-a@example.com','{"full_name":"Owner A"}'),
 ('20000000-0000-0000-0000-000000000002','owner-b@example.com','{"full_name":"Owner B"}');

insert into catalog.departments(id,name,code) values ('21000000-0000-0000-0000-000000000001','Test Department','TST');
insert into catalog.programs(id,department_id,name,program_type) values ('22000000-0000-0000-0000-000000000001','21000000-0000-0000-0000-000000000001','Test Program','MS');
insert into catalog.program_versions(id,program_id,catalog_year,total_credit_hours) values ('23000000-0000-0000-0000-000000000001','22000000-0000-0000-0000-000000000001',2026,36);
insert into catalog.courses(id,subject,course_number,title) values ('24000000-0000-0000-0000-000000000001','TST','6000','Security Test');

set role authenticated;
select set_config('request.jwt.claim.sub','20000000-0000-0000-0000-000000000001',false);
select public.enroll_application('jsom_planner');
select public.enroll_application('syllabus_check');

insert into planner.students(id,user_id,program_version_id) values
 ('25000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001','23000000-0000-0000-0000-000000000001');
insert into planner.student_courses(student_id,course_id,status) values
 ('25000000-0000-0000-0000-000000000001','24000000-0000-0000-0000-000000000001','planned');
insert into syllabus.documents(id,owner_id,title,status) values
 ('26000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001','Owner A document','pending');
insert into storage.objects(id,bucket_id,name,owner_id) values
 ('27000000-0000-0000-0000-000000000001','syllabi','20000000-0000-0000-0000-000000000001/document.pdf','20000000-0000-0000-0000-000000000001');

do $$ begin
  if (select count(*) from planner.students) <> 1 then raise exception 'owner cannot read own student row'; end if;
  if (select count(*) from syllabus.documents) <> 1 then raise exception 'owner cannot read own document'; end if;
  begin
    insert into planner.students(user_id) values ('20000000-0000-0000-0000-000000000002');
    raise exception 'caller created another user student row';
  exception when insufficient_privilege then null; end;
  begin
    update syllabus.documents set owner_id='20000000-0000-0000-0000-000000000002'
      where id='26000000-0000-0000-0000-000000000001';
    raise exception 'caller transferred document ownership';
  exception when insufficient_privilege then null; end;
  begin
    insert into planner.student_courses(student_id,course_id,status,verification_status) values
      ('25000000-0000-0000-0000-000000000001','24000000-0000-0000-0000-000000000001','completed','institution_verified');
    raise exception 'student self-certified an academic record';
  exception when insufficient_privilege then null; end;
  begin
    insert into syllabus.documents(owner_id,title,object_path) values
      ('20000000-0000-0000-0000-000000000001','Invalid path','20000000-0000-0000-0000-000000000002/file.pdf');
    raise exception 'document accepted another owner path';
  exception when check_violation then null; end;
  begin
    insert into storage.objects(id,bucket_id,name,owner_id) values
      ('27000000-0000-0000-0000-000000000002','syllabi','20000000-0000-0000-0000-000000000002/stolen.pdf','20000000-0000-0000-0000-000000000001');
    raise exception 'storage accepted another owner folder';
  exception when insufficient_privilege then null; end;
end $$;

select set_config('request.jwt.claim.sub','20000000-0000-0000-0000-000000000002',false);
do $$ begin
  if (select count(*) from planner.students) <> 0 then raise exception 'user B can read user A student row'; end if;
  if (select count(*) from planner.student_courses) <> 0 then raise exception 'user B can read user A course row'; end if;
  if (select count(*) from syllabus.documents) <> 0 then raise exception 'user B can read user A document'; end if;
  if (select count(*) from storage.objects where bucket_id='syllabi') <> 0 then raise exception 'user B can read user A file object'; end if;
  begin
    insert into planner.student_courses(student_id,course_id,status) values
      ('25000000-0000-0000-0000-000000000001','24000000-0000-0000-0000-000000000001','planned');
    raise exception 'user B inserted into user A child record';
  exception when insufficient_privilege then null; end;
end $$;

reset role;
do $$ begin
  if has_schema_privilege('anon','planner','USAGE') then raise exception 'anonymous role can use planner schema'; end if;
  if (select public from storage.buckets where id='syllabi') then raise exception 'syllabi bucket is public'; end if;
  if (select public from storage.buckets where id='reports') then raise exception 'reports bucket is public'; end if;
  if not (select relrowsecurity from pg_class where oid='planner.students'::regclass) then raise exception 'students RLS disabled'; end if;
  if not (select relrowsecurity from pg_class where oid='syllabus.documents'::regclass) then raise exception 'documents RLS disabled'; end if;
end $$;

select 'application data isolation assertions passed' result;
rollback;
