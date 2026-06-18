#!/bin/bash
set -e
echo "── RECESSION — SETUP ──"

command -v python3 >/dev/null || { echo "✗ Python 3 not found"; exit 1; }
command -v node >/dev/null || { echo "✗ Node.js not found"; exit 1; }

echo "── API ──"
cd api
[ ! -d "venv" ] && python3 -m venv venv
source venv/bin/activate
pip install -q --upgrade pip && pip install -q -r requirements.txt
echo "✓ Python deps installed"
cd ..

echo "── Dashboard ──"
cd dashboard
npm install --silent
echo "✓ Frontend deps installed"
cd ..

cat > start.sh << 'SH'
#!/bin/bash
trap 'kill $(jobs -p) 2>/dev/null; exit' INT TERM
cd api && source venv/bin/activate && echo "→ API: http://localhost:8000" && uvicorn main:app --reload --port 8000 2>&1 | sed 's/^/[api] /' &
sleep 4
cd dashboard && echo "→ Dashboard: http://localhost:5173" && npm run dev 2>&1 | sed 's/^/[web] /' &
wait
SH
chmod +x start.sh

echo ""
echo "── Done ──"
echo "  ./start.sh → start both servers"
echo "  http://localhost:5173 → dashboard"
echo ""
