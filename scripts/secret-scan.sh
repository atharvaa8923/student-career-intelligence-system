#!/usr/bin/env bash
# Pattern-based secret scan over tracked files (git ls-files). Exits 1 on any
# finding. Prints file:line and the pattern name only, never the match.
# Not exhaustive; complements, not replaces, a dedicated scanner.
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/.."

patterns=(
  'private_key|-----BEGIN ([A-Z]+ )?PRIVATE KEY-----'
  'jwt|eyJ[A-Za-z0-9_-]{15,}\.eyJ[A-Za-z0-9_-]{15,}\.'
  'openai_key|sk-(proj-)?[A-Za-z0-9_-]{32,}'
  'anthropic_key|sk-ant-[A-Za-z0-9_-]{20,}'
  'aws_access_key|AKIA[0-9A-Z]{16}'
  'github_token|gh[pousr]_[A-Za-z0-9]{36,}'
  'supabase_secret|sb_secret_[A-Za-z0-9_-]{20,}'
  'supabase_access_token|sbp_[a-f0-9]{40}'
  'postgres_url_with_password|postgres(ql)?(\+[a-z0-9]+)?://[^:/@[:space:]]+:[^@[:space:]]{8,}@[^[:space:]]*(supabase|amazonaws|railway|neon)'
)

found=0
while IFS= read -r -d '' file; do
  [[ -f "$file" ]] || continue
  case "$file" in *.png|*.jpg|*.pdf|*.docx|*.pptx|*.xlsx|*package-lock.json) continue ;; esac
  for entry in "${patterns[@]}"; do
    name="${entry%%|*}"; regex="${entry#*|}"
    while IFS=: read -r line _; do
      echo "SECRET? $file:$line ($name)"; found=1
    done < <(grep -nEI -- "$regex" "$file" 2>/dev/null | cut -d: -f1 | sed 's/$/:/' || true)
  done
done < <(git ls-files -z)

if (( found )); then echo "Secret scan FAILED"; exit 1; fi
echo "Secret scan passed ($(git ls-files | wc -l | tr -d ' ') tracked files)"
