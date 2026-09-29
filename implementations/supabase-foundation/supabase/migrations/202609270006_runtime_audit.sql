begin;
create table private.audit_log(
 id bigint generated always as identity primary key,
 actor_id uuid not null references auth.users(id) on delete cascade,
 application text not null,
 action text not null,
 entity_type text,
 entity_id uuid,
 old_data jsonb,
 new_data jsonb,
 ip_address inet,
 created_at timestamptz not null default now()
);
alter table private.audit_log enable row level security;
revoke all on private.audit_log from public,anon,authenticated;

create or replace function public.log_app_event(event_action text,event_entity_type text,event_entity_id uuid,event_old_data jsonb,event_new_data jsonb,event_ip inet)
returns void language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null then raise exception 'Authentication required' using errcode='42501'; end if;
 insert into private.audit_log(actor_id,application,action,entity_type,entity_id,old_data,new_data,ip_address)
 values(auth.uid(),'jsom_planner',left(event_action,100),left(event_entity_type,100),event_entity_id,event_old_data,event_new_data,event_ip);
end; $$;
revoke all on function public.log_app_event(text,text,uuid,jsonb,jsonb,inet) from public,anon;
grant execute on function public.log_app_event(text,text,uuid,jsonb,jsonb,inet) to authenticated;
commit;
