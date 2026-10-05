#!/usr/bin/env bash
# Aggregate health check for the local or hosted stack.
#
# Checks each configured endpoint and prints one line per check. Exit status
# is 0 only when every *required* check passes. Override URLs with env vars;
# set a URL to an empty string to skip that check.
#
#   JSOM_API_URL       default http://127.0.0.1:5000   (GET /health)
#   SYLLABUS_API_URL   default http://127.0.0.1:8000   (GET /api/health)
#   JSOM_UI_URL        default http://127.0.0.1:3000   (optional)
#   SYLLABUS_UI_URL    default http://127.0.0.1:5173   (optional)
#   SUPABASE_URL + SUPABASE_PUBLISHABLE_KEY            (GET /auth/v1/health, optional)
#   HEALTH_TIMEOUT     seconds per request, default 5
#
# Never prints keys, tokens, or response bodies.
set -uo pipefail

timeout="${HEALTH_TIMEOUT:-5}"
failures=0

check() {
  local name="$1" url="$2" required="$3"; shift 3
  if [[ -z "$url" ]]; then printf '%-22s SKIP   (not configured)\n' "$name"; return; fi
  local code
  code="$(curl -sS -o /dev/null -w '%{http_code}' --max-time "$timeout" "$@" "$url" 2>/dev/null)" || code="000"
  if [[ "$code" =~ ^2 ]]; then
    printf '%-22s PASS   HTTP %s\n' "$name" "$code"
  elif [[ "$required" == "required" ]]; then
    printf '%-22s FAIL   HTTP %s  %s\n' "$name" "$code" "${url%%\?*}"
    failures=$((failures + 1))
  else
    printf '%-22s WARN   HTTP %s  %s (optional)\n' "$name" "$code" "${url%%\?*}"
  fi
}

jsom_api="${JSOM_API_URL-http://127.0.0.1:5000}"
syllabus_api="${SYLLABUS_API_URL-http://127.0.0.1:8000}"

check "JSOM API" "${jsom_api:+$jsom_api/health}" required
check "SyllabusCheck API" "${syllabus_api:+$syllabus_api/api/health}" required
check "JSOM UI" "${JSOM_UI_URL-http://127.0.0.1:3000}" optional
check "SyllabusCheck UI" "${SYLLABUS_UI_URL-http://127.0.0.1:5173}" optional
if [[ -n "${SUPABASE_URL:-}" && -n "${SUPABASE_PUBLISHABLE_KEY:-}" ]]; then
  check "Supabase Auth" "${SUPABASE_URL%/}/auth/v1/health" optional -H "apikey: $SUPABASE_PUBLISHABLE_KEY"
else
  printf '%-22s SKIP   (SUPABASE_URL/SUPABASE_PUBLISHABLE_KEY not set)\n' "Supabase Auth"
fi

if (( failures )); then echo "UNHEALTHY: $failures required check(s) failed"; exit 1; fi
echo "HEALTHY"
