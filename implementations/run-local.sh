#!/bin/zsh
set -euo pipefail

script_dir="${0:A:h}"
foundation_dir="$script_dir/supabase-foundation"
jsom_dir="$script_dir/jsom-planner"
syllabus_dir="$script_dir/syllabus-check"
ca_file="$foundation_dir/certs/supabase-root-2021.pem"
runtime_dir="${TMPDIR:-/tmp}/jsom-syllabus-local-${UID}"
mkdir -p "$runtime_dir"

required_commands=(node npm security curl lsof /opt/homebrew/bin/python3.11)
for command_name in $required_commands; do
  if ! command -v "$command_name" >/dev/null 2>&1; then
    echo "Missing required command: $command_name" >&2
    exit 1
  fi
done

for port in 3000 5000 5173 8000; do
  if lsof -tiTCP:"$port" -sTCP:LISTEN >/dev/null 2>&1; then
    echo "Port $port is already in use. Stop the existing service first." >&2
    exit 1
  fi
done

if [[ ! -d "$syllabus_dir/.venv" ]]; then
  echo "SyllabusCheck virtual environment is missing: $syllabus_dir/.venv" >&2
  exit 1
fi

pooler_url="$(<"$foundation_dir/supabase/.temp/pooler-url")"
database_password="$(security find-generic-password -s supabase-jsom-syllabus-dev-db -a postgres -w)"
publishable_key="$(security find-generic-password -s supabase-jsom-syllabus-dev-publishable -a api -w)"

export RAW_DATABASE_URL="$pooler_url"
export DBPASS="$database_password"
jsom_database_url="$(/opt/homebrew/bin/python3.11 -c 'import os; from urllib.parse import quote, urlsplit, urlunsplit; u=urlsplit(os.environ["RAW_DATABASE_URL"]); netloc="{}:{}@{}:{}".format(u.username, quote(os.environ["DBPASS"], safe=""), u.hostname, u.port); print(urlunsplit(("postgresql", netloc, u.path, u.query, u.fragment)))')"
syllabus_database_url="$(/opt/homebrew/bin/python3.11 -c 'import os; from urllib.parse import quote, urlsplit, urlunsplit; u=urlsplit(os.environ["RAW_DATABASE_URL"]); netloc="{}:{}@{}:{}".format(u.username, quote(os.environ["DBPASS"], safe=""), u.hostname, u.port); print(urlunsplit(("postgresql+asyncpg", netloc, u.path, u.query, u.fragment)))')"
unset RAW_DATABASE_URL DBPASS database_password pooler_url

export SUPABASE_URL="https://rrabxkxqyrgbgakwljmf.supabase.co"
export SUPABASE_PUBLISHABLE_KEY="$publishable_key"
export DB_SSL_CA="$ca_file"

pids=()
cleanup_started=0
cleanup() {
  if (( cleanup_started )); then
    return
  fi
  cleanup_started=1
  trap - INT TERM EXIT
  if (( ${#pids[@]} )); then
    kill -TERM $pids 2>/dev/null || true
    wait $pids 2>/dev/null || true
  fi
  echo "Local services stopped."
}
trap cleanup INT TERM EXIT

(
  cd "$jsom_dir/backend"
  export DATABASE_URL="$jsom_database_url" NODE_ENV=production PORT=5000 FRONTEND_URL=http://127.0.0.1:3000
  exec npm start
) >"$runtime_dir/jsom-backend.log" 2>&1 &
pids+=($!)

(
  cd "$jsom_dir/frontend"
  exec npm run dev -- --host 127.0.0.1
) >"$runtime_dir/jsom-frontend.log" 2>&1 &
pids+=($!)

(
  cd "$syllabus_dir/backend"
  export DATABASE_URL="$syllabus_database_url" APP_ENV=production DEBUG=false
  export UPLOAD_DIR="$runtime_dir/uploads" REPORT_DIR="$runtime_dir/reports"
  export FRONTEND_URL=http://127.0.0.1:5173
  exec ../.venv/bin/uvicorn main:app --host 127.0.0.1 --port 8000
) >"$runtime_dir/syllabus-backend.log" 2>&1 &
pids+=($!)

(
  cd "$syllabus_dir/frontend"
  exec npm run dev -- --host 127.0.0.1
) >"$runtime_dir/syllabus-frontend.log" 2>&1 &
pids+=($!)

wait_for_url() {
  local name="$1"
  local url="$2"
  local log_file="$3"
  for attempt in {1..30}; do
    if curl -fsS "$url" >/dev/null 2>&1; then
      echo "Ready: $name"
      return 0
    fi
    sleep 1
  done
  echo "$name did not become ready. Log: $log_file" >&2
  tail -40 "$log_file" >&2
  return 1
}

wait_for_url "JSOM API" "http://127.0.0.1:5000/health" "$runtime_dir/jsom-backend.log"
wait_for_url "JSOM frontend" "http://127.0.0.1:3000/" "$runtime_dir/jsom-frontend.log"
wait_for_url "SyllabusCheck API" "http://127.0.0.1:8000/api/health" "$runtime_dir/syllabus-backend.log"
wait_for_url "SyllabusCheck frontend" "http://127.0.0.1:5173/" "$runtime_dir/syllabus-frontend.log"

echo ""
echo "JSOM Planner:    http://127.0.0.1:3000"
echo "SyllabusCheck:   http://127.0.0.1:5173"
echo "API docs:        http://127.0.0.1:8000/api/docs"
echo "Logs:            $runtime_dir"
echo "Press Ctrl+C to stop all services."

wait
