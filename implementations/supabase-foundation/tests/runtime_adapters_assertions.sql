\set ON_ERROR_STOP on
begin;
insert into auth.users(id,email,raw_user_meta_data) values
 ('30000000-0000-0000-0000-000000000001','runtime-a@example.com','{"full_name":"Runtime A"}'),
 ('30000000-0000-0000-0000-000000000002','runtime-b@example.com','{"full_name":"Runtime B"}');

set role anon;
set local search_path=api_jsom,catalog,public;
do $$ begin
 if (select count(*) from programs)<>39 then raise exception 'anonymous catalog adapter failed'; end if;
 begin perform * from students; raise exception 'anonymous accessed students'; exception when insufficient_privilege then null; end;
end $$;
reset role;

set role authenticated;
select set_config('request.jwt.claim.sub','30000000-0000-0000-0000-000000000001',false);
set local search_path=api_jsom,catalog,planner,public;
select public.enroll_application('jsom_planner');
insert into students(user_id,program_id) select auth.uid(),id from programs limit 1;
insert into student_courses(student_id,course_id,semester,"year",status)
 select s.id,c.id,'Fall',2026,'planned' from students s cross join courses c limit 1;
do $$ begin
 if (select count(*) from students)<>1 then raise exception 'JSOM student adapter failed'; end if;
 if (select count(*) from student_courses)<>1 then raise exception 'JSOM course adapter failed'; end if;
end $$;
select public.log_app_event('TEST','student',(select id from students limit 1),null,null,'127.0.0.1');

set local search_path=api_syllabus,syllabus,catalog,public;
select public.enroll_application('syllabus_check');
insert into programs(name,department,description) values('Runtime Test','Testing','Temporary');
insert into courses(id,owner_id,title,code,semester,domain,file_path,status)
 values('31000000-0000-0000-0000-000000000001',auth.uid(),'Runtime Syllabus','TST 6000','Fall 2026','Testing','30000000-0000-0000-0000-000000000001/test.pdf','pending');
insert into reports(id,owner_id,title,pdf_path)
 values('32000000-0000-0000-0000-000000000001',auth.uid(),'Runtime Report','30000000-0000-0000-0000-000000000001/test.pdf');
do $$ begin
 if (select count(*) from courses)<>1 then raise exception 'syllabus document adapter failed'; end if;
 if (select count(*) from reports)<>1 then raise exception 'report adapter failed'; end if;
end $$;

select set_config('request.jwt.claim.sub','30000000-0000-0000-0000-000000000002',false);
do $$ begin
 if (select count(*) from courses)<>0 then raise exception 'user B read user A syllabus'; end if;
 if (select count(*) from reports)<>0 then raise exception 'user B read user A report'; end if;
end $$;
reset role;
do $$ begin
 if (select count(*) from private.audit_log where actor_id='30000000-0000-0000-0000-000000000001')<>1 then raise exception 'audit adapter failed'; end if;
end $$;
select 'runtime adapter assertions passed' result;
rollback;
