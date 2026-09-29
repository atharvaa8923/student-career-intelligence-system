\set ON_ERROR_STOP on
begin;

insert into auth.users (id, email, raw_user_meta_data)
values
  ('10000000-0000-0000-0000-000000000001', 'student-a@example.com', '{"full_name":"Student A"}'),
  ('10000000-0000-0000-0000-000000000002', 'student-b@example.com', '{"full_name":"Student B"}');

do $$
begin
  if (select count(*) from public.profiles) <> 2 then
    raise exception 'signup trigger did not create both profiles';
  end if;
  if (select count(*) from private.app_roles) <> 0 then
    raise exception 'signup unexpectedly granted application roles';
  end if;
  if has_table_privilege('authenticated', 'private.app_roles', 'SELECT')
     or has_table_privilege('authenticated', 'private.app_roles', 'INSERT') then
    raise exception 'authenticated has direct role-table privileges';
  end if;
end;
$$;

set role authenticated;
select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000001', false);

do $$
begin
  if (select count(*) from public.profiles) <> 1 then
    raise exception 'RLS did not restrict profile selection to the caller';
  end if;
end;
$$;

update public.profiles set display_name = 'Updated A'
where id = '10000000-0000-0000-0000-000000000001';
update public.profiles set display_name = 'Hijacked'
where id = '10000000-0000-0000-0000-000000000002';

select public.enroll_application('jsom_planner');
select public.enroll_application('syllabus_check');
select public.enroll_application('jsom_planner');

do $$
begin
  if (select count(*) from public.get_my_app_roles()) <> 2 then
    raise exception 'baseline role enrollment is missing or not idempotent';
  end if;
  begin
    perform public.enroll_application('admin');
    raise exception 'arbitrary role enrollment was accepted';
  exception when invalid_parameter_value then
    null;
  end;
end;
$$;

reset role;

do $$
begin
  if (select display_name from public.profiles where id = '10000000-0000-0000-0000-000000000002') <> 'Student B' then
    raise exception 'cross-user update changed another profile';
  end if;
  if (select count(*) from private.app_roles where role in ('admin', 'advisor', 'catalog_editor')) <> 0 then
    raise exception 'self-enrollment created a privileged role';
  end if;
  if (select count(*) from private.app_roles) <> 2 then
    raise exception 'unexpected role count';
  end if;
end;
$$;

select 'identity integration assertions passed' as result;
rollback;
