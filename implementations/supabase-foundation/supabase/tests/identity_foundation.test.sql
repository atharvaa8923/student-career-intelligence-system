begin;
select plan(18);

insert into auth.users (id, email, raw_user_meta_data)
values
  ('10000000-0000-0000-0000-000000000001', 'student-a@example.com', '{"full_name":"Student A"}'),
  ('10000000-0000-0000-0000-000000000002', 'student-b@example.com', '{"full_name":"Student B"}');

select is((select display_name from public.profiles where id = '10000000-0000-0000-0000-000000000001'), 'Student A', 'signup trigger creates profile');
select is((select count(*)::int from private.app_roles), 0, 'signup grants no application roles');
select ok(has_table('public', 'profiles'), 'profiles table exists');
select ok(has_table('private', 'app_roles'), 'private roles table exists');
select ok((select relrowsecurity from pg_class where oid = 'public.profiles'::regclass), 'profiles has RLS');
select ok((select relrowsecurity from pg_class where oid = 'private.app_roles'::regclass), 'roles has RLS');
select is(has_table_privilege('authenticated', 'private.app_roles', 'SELECT'), false, 'authenticated cannot select role table');
select is(has_table_privilege('authenticated', 'private.app_roles', 'INSERT'), false, 'authenticated cannot insert role table');

set local role authenticated;
select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000001', true);
select is((select count(*)::int from public.profiles), 1, 'user sees only own profile');
select lives_ok($$update public.profiles set display_name = 'Updated A' where id = '10000000-0000-0000-0000-000000000001'$$, 'user updates own profile');
select is((select count(*)::int from public.profiles where id = '10000000-0000-0000-0000-000000000002'), 0, 'user cannot see another profile');
select lives_ok($$update public.profiles set display_name = 'Hijacked' where id = '10000000-0000-0000-0000-000000000002'$$, 'cross-user update exposes no error or row');
select is((select role from public.enroll_application('jsom_planner')), 'student', 'JSOM self-enrollment grants student only');
select is((select role from public.enroll_application('syllabus_check')), 'professor', 'Syllabus self-enrollment grants professor only');
select throws_ok($$select public.enroll_application('admin')$$, '22023', 'Unsupported application', 'arbitrary enrollment rejected');
select is((select count(*)::int from public.get_my_app_roles()), 2, 'user sees only own baseline roles');

reset role;
select is((select display_name from public.profiles where id = '10000000-0000-0000-0000-000000000002'), 'Student B', 'cross-user update changed no row');
select is((select count(*)::int from private.app_roles where role = 'admin'), 0, 'self-enrollment created no admin');

select * from finish();
rollback;
