#!/bin/bash
set -e
cd "$(dirname "$0")"
export UV_CACHE_DIR="$PWD/.cache/uv"
if [ -x "../../work/.venv/bin/python" ]; then
  lab_python="../../work/.venv/bin/python"
elif [ -x ".venv/bin/python" ]; then
  lab_python=".venv/bin/python"
else
  if ! command -v uv >/dev/null 2>&1; then
    echo 'Install Python 3.12+, then run: python -m venv .venv'
    echo 'Activate the environment, run: pip install -r requirements-lock.txt'
    echo 'Then run: python -m uvicorn app:app --host 127.0.0.1 --port 8765'
    exit 1
  fi
  uv venv --python 3.12 .venv
  uv pip install --python .venv/bin/python -r requirements-lock.txt
  lab_python=".venv/bin/python"
fi
printf '\nOpen http://127.0.0.1:8765 in your browser. Press Ctrl+C to stop.\n\n'
exec "$lab_python" -m uvicorn app:app --host 127.0.0.1 --port 8765
