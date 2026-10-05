#!/usr/bin/env bash
# Portable local launcher (Linux/macOS, bash). Starts the JSOM API and UI and
# the SyllabusCheck API and UI against the database configured in the
# environment, waits for health, and stops everything on Ctrl+C.
#
# Unlike implementations/run-local.sh (macOS Keychain + zsh), this reads plain
# environment variables. Put them in a git-ignored .env file at the repo root
# (see .env.example) or export them. Celery/Redis workers are not started.
set -euo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
if [[ -f "$root/.env" ]]; then set -a; . "$root/.env"; set +a; fi

: "${JSOM_DATABASE_URL:?set JSOM_DATABASE_URL (postgresql://...)}"
: "${SYLLABUS_DATABASE_URL:?set SYLLABUS_DATABASE_URL (postgresql+asyncpg://...)}"
: "${SUPABASE_URL:?set SUPABASE_URL}"
: "${SUPABASE_PUBLISHABLE_KEY:?set SUPABASE_PUBLISHABLE_KEY}"
app_env="${APP_ENV:-production}"
if [[ "$app_env" == "production" ]]; then
  : "${DB_SSL_CA:?set DB_SSL_CA to the Supabase root certificate path (verified TLS is required)}"
  [[ -r "$DB_SSL_CA" ]] || { echo "DB_SSL_CA is not readable: $DB_SSL_CA" >&2; exit 1; }
fi
syllabus_python="${SYLLABUS_PYTHON:-$root/implementations/syllabus-check/.venv/bin/python}"
[[ -x "$syllabus_python" ]] || { echo "SyllabusCheck Python not found: $syllabus_python (set SYLLABUS_PYTHON)" >&2; exit 1; }

logs="${DEV_LOG_DIR:-${TMPDIR:-/tmp}/sci-dev-logs}"
mkdir -p "$logs"
pids=()
cleanup() { trap - INT TERM EXIT; (( ${#pids[@]} )) && kill "${pids[@]}" 2>/dev/null; wait 2>/dev/null; echo "Stopped."; }
trap cleanup INT TERM EXIT

( cd "$root/implementations/jsom-planner/backend"
  DATABASE_URL="$JSOM_DATABASE_URL" NODE_ENV="$app_env" PORT=5000 FRONTEND_URL=http://127.0.0.1:3000 exec node src/server.js
) >"$logs/jsom-api.log" 2>&1 & pids+=($!)
( cd "$root/implementations/jsom-planner/frontend" && exec npx vite --host 127.0.0.1 --port 3000 --strictPort
) >"$logs/jsom-ui.log" 2>&1 & pids+=($!)
( cd "$root/implementations/syllabus-check/backend"
  DATABASE_URL="$SYLLABUS_DATABASE_URL" APP_ENV="$app_env" DEBUG=false FRONTEND_URL=http://127.0.0.1:5173 \
  UPLOAD_DIR="$logs/uploads" REPORT_DIR="$logs/reports" exec "$syllabus_python" -m uvicorn main:app --host 127.0.0.1 --port 8000
) >"$logs/syllabus-api.log" 2>&1 & pids+=($!)
( cd "$root/implementations/syllabus-check/frontend" && exec npx vite --host 127.0.0.1 --port 5173 --strictPort
) >"$logs/syllabus-ui.log" 2>&1 & pids+=($!)

for attempt in $(seq 1 45); do
  if "$root/scripts/health.sh" >/dev/null 2>&1; then break; fi
  sleep 1
done
"$root/scripts/health.sh" || { echo "Startup failed; logs in $logs" >&2; exit 1; }
echo "JSOM Planner http://127.0.0.1:3000 · SyllabusCheck http://127.0.0.1:5173 · logs $logs · Ctrl+C to stop"
wait
