#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")"
.venv/bin/python -m uvicorn api.main:app --host 127.0.0.1 --port 8000 &
study_api_pid=$!
npm --prefix dashboard run dev -- --host 127.0.0.1 &
study_web_pid=$!
trap 'kill "$study_api_pid" "$study_web_pid" 2>/dev/null || true' EXIT INT TERM
wait
