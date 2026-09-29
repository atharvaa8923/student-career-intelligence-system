begin;
alter table syllabus.program_groups add column description text;
alter table syllabus.program_groups add column owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade;
alter table syllabus.documents add column domain text;
alter table syllabus.documents add column coverage_score numeric(5,2) check(coverage_score between 0 and 100);
alter table syllabus.documents drop constraint documents_status_check;
alter table syllabus.documents add constraint documents_status_check check(status in ('pending','uploaded','parsing','parsed','scored','failed'));
alter table syllabus.job_postings add column city text;
alter table syllabus.job_postings add column state text;
alter table syllabus.job_postings add column country text default 'USA';
alter table syllabus.job_postings add column is_remote boolean not null default false;
alter table syllabus.job_postings add column role_type text;
alter table syllabus.job_postings add column domain text;
alter table syllabus.keywords add column text text;
alter table syllabus.keywords add column domain text;
alter table syllabus.keywords add column subdomain text;
alter table syllabus.keywords add column frequency int not null default 0;
alter table syllabus.keywords add column created_at timestamptz not null default now();
alter table syllabus.coverage_rows alter column run_id drop not null;
alter table syllabus.coverage_rows add column document_id uuid references syllabus.documents(id) on delete cascade;
alter table syllabus.coverage_rows add column updated_at timestamptz not null default now();
alter table syllabus.reports add column title text not null default 'Gap report';

create unique index syllabus_coverage_document_keyword_uq on syllabus.coverage_rows(document_id,keyword_id) where document_id is not null;
create policy coverage_row_document_owner on syllabus.coverage_rows for select to authenticated using (
 document_id is not null and exists(select 1 from syllabus.documents d where d.id=document_id and d.owner_id=auth.uid()));
create policy coverage_row_document_write on syllabus.coverage_rows for all to authenticated
 using(document_id is not null and exists(select 1 from syllabus.documents d where d.id=document_id and d.owner_id=auth.uid()))
 with check(document_id is not null and exists(select 1 from syllabus.documents d where d.id=document_id and d.owner_id=auth.uid()));
create policy program_group_owner_write on syllabus.program_groups for all to authenticated
 using(owner_id=auth.uid()) with check(owner_id=auth.uid());
grant insert,update,delete on syllabus.program_groups,syllabus.coverage_rows to authenticated;

create schema if not exists api_syllabus;
revoke all on schema api_syllabus from public,anon;
grant usage on schema api_syllabus to authenticated;
create view api_syllabus.programs with(security_invoker=true) as
 select id,name,coalesce(department,'') department,description,created_at from syllabus.program_groups;
create view api_syllabus.courses with(security_invoker=true) as
 select id,owner_id,title,course_code code,term semester,domain,object_path file_path,raw_text,
 parsed_topics,parsed_sections,coverage_score,status,program_group_id program_id,created_at,updated_at from syllabus.documents;
create view api_syllabus.job_postings with(security_invoker=true) as select * from syllabus.job_postings;
create view api_syllabus.keywords with(security_invoker=true) as
 select id,coalesce(text,normalized_keyword) text,normalized_keyword normalized,domain,subdomain,embedding,frequency,category,importance,is_emerging,created_at from syllabus.keywords;
create view api_syllabus.job_keywords with(security_invoker=true) as select job_id,keyword_id from syllabus.job_keywords;
create view api_syllabus.coverage_rows with(security_invoker=true) as
 select id,document_id course_id,keyword_id,score similarity_score,status,updated_at from syllabus.coverage_rows where document_id is not null;
create view api_syllabus.reports with(security_invoker=true) as
 select id,owner_id,title,filters,summary,pdf_object_path pdf_path,spreadsheet_object_path xlsx_path,created_at from syllabus.reports;

grant select,insert,update,delete on api_syllabus.programs,api_syllabus.courses,api_syllabus.reports to authenticated;
grant select on api_syllabus.job_postings,api_syllabus.keywords,api_syllabus.job_keywords,api_syllabus.coverage_rows to authenticated;
grant insert,update,delete on api_syllabus.coverage_rows to authenticated;

create policy reports_owner_insert on storage.objects for insert to authenticated with check(bucket_id='reports' and (storage.foldername(name))[1]=auth.uid()::text);
create policy reports_owner_update on storage.objects for update to authenticated using(bucket_id='reports' and (storage.foldername(name))[1]=auth.uid()::text) with check(bucket_id='reports' and (storage.foldername(name))[1]=auth.uid()::text);
commit;
