#!/bin/zsh
set -euo pipefail

listener_pids="$(lsof -tiTCP:3000 -tiTCP:5000 -tiTCP:5173 -tiTCP:8000 -sTCP:LISTEN | sort -u || true)"
if [[ -z "$listener_pids" ]]; then
  echo "No local JSOM or SyllabusCheck services are running."
  exit 0
fi

print -r -- "$listener_pids" | xargs -n 1 kill -TERM
echo "Stopped local services on ports 3000, 5000, 5173, and 8000."
