begin;

alter table syllabus.documents add constraint documents_owner_path
  check (object_path is null or split_part(object_path, '/', 1) = owner_id::text);
alter table syllabus.reports add constraint reports_pdf_owner_path
  check (pdf_object_path is null or split_part(pdf_object_path, '/', 1) = owner_id::text);
alter table syllabus.reports add constraint reports_sheet_owner_path
  check (spreadsheet_object_path is null or split_part(spreadsheet_object_path, '/', 1) = owner_id::text);

create or replace function private.protect_verified_academic_record()
returns trigger language plpgsql set search_path = '' as $$
begin
  if current_user = 'authenticated' and (
    new.verification_status <> 'self_reported'
    or (tg_op = 'UPDATE' and old.verification_status <> 'self_reported')
  ) then
    raise exception 'Institution verification is managed by a trusted academic process' using errcode = '42501';
  end if;
  return new;
end;
$$;
revoke all on function private.protect_verified_academic_record() from public, anon, authenticated;

create trigger protect_verified_academic_record
before insert or update on planner.student_courses
for each row execute function private.protect_verified_academic_record();

comment on column planner.students.gpa is 'Self-reported GPA. Verified academic data must use a separately controlled source.';
comment on column planner.student_courses.verification_status is 'authenticated users may create or edit self_reported values only';

commit;
