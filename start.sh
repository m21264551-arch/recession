#!/bin/bash
trap 'kill $(jobs -p) 2>/dev/null; exit' INT TERM
cd api && source venv/bin/activate && echo "→ API: http://localhost:8000" && uvicorn main:app --reload --port 8000 2>&1 | sed 's/^/[api] /' &
sleep 4
cd dashboard && echo "→ Dashboard: http://localhost:5173" && npm run dev 2>&1 | sed 's/^/[web] /' &
wait
