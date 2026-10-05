#!/usr/bin/env bash
# Replay every Supabase migration, the hash-pinned catalog import, and all SQL
# assertion suites on a disposable database, then drop it.
#
# Needs: psql, python3, and a PostgreSQL 15+ server with pgvector reachable via
# the standard PGHOST/PGPORT/PGUSER/PGPASSWORD variables. Creates and drops
# only a randomly named database; never touches any other database.
# Never point this at a hosted Supabase project.
set -euo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
foundation="$root/implementations/supabase-foundation"
jsom_db="$root/implementations/jsom-planner/database"
db="replay_$(date +%s)_$$"
work="$(mktemp -d)"
psql_base=(psql -X -q -v ON_ERROR_STOP=1)

cleanup() {
  "${psql_base[@]}" -d postgres -c "drop database if exists $db" >/dev/null 2>&1 || true
  rm -rf "$work"
}
trap cleanup EXIT

case "${PGHOST:-}" in
  *supabase.co*|*supabase.com*) echo "Refusing to run against a hosted Supabase host: $PGHOST" >&2; exit 2 ;;
esac

"${psql_base[@]}" -d postgres -c "create database $db" >/dev/null
run() { "${psql_base[@]}" -d "$db" "$@"; }

echo "1/5 platform prelude"
run -f "$foundation/tests/postgres_prelude.sql" >/dev/null
run -f "$foundation/tests/supabase_platform_stub.sql" >/dev/null

echo "2/5 migrations"
for migration in "$foundation"/supabase/migrations/*.sql; do
  run -f "$migration" >/dev/null
  echo "    applied $(basename "$migration")"
done

echo "3/5 identity and isolation assertions (before import)"
run -f "$foundation/tests/identity_assertions.sql" | grep -q 'identity integration assertions passed'
run -f "$foundation/tests/application_data_assertions.sql" | grep -q 'application data isolation assertions passed'

echo "4/5 catalog and prerequisite import"
catalog_sha="$(python3 "$foundation/scripts/extract_jsom_catalog.py" "$jsom_db/seed.sql" "$work/catalog.sql" | sed -n 's/^sha256=//p')"
prereq_sha="$(python3 "$foundation/scripts/extract_jsom_prerequisites.py" "$jsom_db/migrations/real_prereqs_v2.sql" "$work/prereqs.sql" | sed -n 's/^sha256=//p')"
run -f "$foundation/imports/01_jsom_catalog_stage.sql" >/dev/null 2>&1
run -f "$work/catalog.sql" >/dev/null
run -v source_sha256="$catalog_sha" -f "$foundation/imports/02_import_jsom_catalog.sql" >/dev/null 2>&1
run -f "$work/prereqs.sql" >/dev/null 2>&1
run -v source_sha256="$prereq_sha" -f "$foundation/imports/03_import_jsom_prerequisites.sql" >/dev/null 2>&1

echo "5/5 reconciliation, runtime adapters, RLS coverage"
run -f "$foundation/tests/import_reconciliation.sql" | grep -q 'step 6 import reconciliation passed'
run -f "$foundation/tests/runtime_adapters_assertions.sql" | grep -q 'runtime adapter assertions passed'
missing_rls="$(run -tA -c "select string_agg(n.nspname||'.'||c.relname, ', ') from pg_class c join pg_namespace n on n.oid=c.relnamespace where c.relkind='r' and n.nspname in ('public','private','catalog','planner','syllabus') and not c.relrowsecurity")"
if [[ -n "$missing_rls" ]]; then echo "Tables without RLS: $missing_rls" >&2; exit 1; fi
private_grants="$(run -tA -c "select count(*) from information_schema.role_table_grants where table_schema='private' and grantee in ('anon','authenticated')")"
if [[ "$private_grants" != "0" ]]; then echo "Browser roles hold $private_grants grants on private tables" >&2; exit 1; fi

echo "PASS: migrations, import, and SQL assertions replayed on $db"
