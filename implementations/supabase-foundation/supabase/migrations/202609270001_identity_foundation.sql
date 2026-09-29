begin;

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null check (char_length(display_name) between 1 and 120),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.profiles is
  'User-editable display data only. Authorization is stored separately in private.app_roles.';

create table private.app_roles (
  user_id uuid not null references auth.users(id) on delete cascade,
  application text not null check (application in ('jsom_planner', 'syllabus_check')),
  role text not null,
  assigned_by uuid references auth.users(id) on delete set null,
  assigned_at timestamptz not null default now(),
  primary key (user_id, application, role),
  constraint app_role_allowed check (
    (application = 'jsom_planner' and role in ('student', 'advisor', 'catalog_editor', 'admin'))
    or
    (application = 'syllabus_check' and role in ('professor', 'catalog_editor', 'admin'))
  )
);

comment on table private.app_roles is
  'Authorization records. Browser roles receive no direct table privileges.';

alter table public.profiles enable row level security;
alter table private.app_roles enable row level security;

revoke all on table public.profiles from anon, authenticated;
grant select, update on table public.profiles to authenticated;
revoke all on table private.app_roles from anon, authenticated;

create policy profiles_select_own
on public.profiles for select
to authenticated
using ((select auth.uid()) is not null and id = (select auth.uid()));

create policy profiles_update_own
on public.profiles for update
to authenticated
using ((select auth.uid()) is not null and id = (select auth.uid()))
with check ((select auth.uid()) is not null and id = (select auth.uid()));

create or replace function private.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_touch_updated_at
before update on public.profiles
for each row execute function private.touch_updated_at();

create or replace function private.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  proposed_name text;
begin
  proposed_name := nullif(btrim(coalesce(new.raw_user_meta_data ->> 'full_name', '')), '');
  if proposed_name is null then
    proposed_name := nullif(split_part(coalesce(new.email, ''), '@', 1), '');
  end if;
  if proposed_name is null then
    proposed_name := 'Member';
  end if;

  insert into public.profiles (id, display_name)
  values (new.id, left(proposed_name, 120));
  return new;
end;
$$;

revoke all on function private.handle_new_auth_user() from public, anon, authenticated;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function private.handle_new_auth_user();

create or replace function public.enroll_application(target_application text)
returns table (application text, role text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := auth.uid();
  baseline_role text;
begin
  if caller is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  baseline_role := case target_application
    when 'jsom_planner' then 'student'
    when 'syllabus_check' then 'professor'
    else null
  end;

  if baseline_role is null then
    raise exception 'Unsupported application' using errcode = '22023';
  end if;

  insert into private.app_roles (user_id, application, role, assigned_by)
  values (caller, target_application, baseline_role, caller)
  on conflict on constraint app_roles_pkey do nothing;

  return query select target_application, baseline_role;
end;
$$;

create or replace function public.get_my_app_roles()
returns table (application text, role text, assigned_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select r.application, r.role, r.assigned_at
  from private.app_roles r
  where auth.uid() is not null and r.user_id = auth.uid()
  order by r.application, r.role;
$$;

revoke all on function public.enroll_application(text) from public, anon;
grant execute on function public.enroll_application(text) to authenticated;
revoke all on function public.get_my_app_roles() from public, anon;
grant execute on function public.get_my_app_roles() to authenticated;

commit;
