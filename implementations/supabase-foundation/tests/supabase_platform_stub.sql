-- TEST-ONLY stand-in for Supabase platform schemas that plain PostgreSQL lacks.
-- Applied after postgres_prelude.sql by scripts/db-replay-test.sh. Never apply
-- to Supabase. It lets the migrations and SQL assertions replay on a disposable
-- database; it does NOT reproduce Supabase Storage enforcement, so storage
-- policy behavior still needs a real Supabase stack (see Phase 2 / Phase 4).
create schema if not exists extensions;
create schema if not exists storage;
create table storage.buckets(
  id text primary key, name text, public boolean default false,
  file_size_limit bigint, allowed_mime_types text[]
);
create table storage.objects(
  id uuid primary key default gen_random_uuid(),
  bucket_id text references storage.buckets(id), name text, owner uuid, owner_id text
);
alter table storage.objects enable row level security;
create or replace function storage.foldername(name text) returns text[]
language sql immutable as $$ select string_to_array(name, '/') $$;
grant usage on schema storage to anon, authenticated;
grant select, insert, update, delete on storage.objects to authenticated;
