#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")"
python3 -m venv .venv
.venv/bin/python -m pip install -r api/requirements.txt
npm --prefix dashboard ci
printf 'Setup complete. Run ./start.sh or reproduce with .venv/bin/python -m analysis.export.\n'
