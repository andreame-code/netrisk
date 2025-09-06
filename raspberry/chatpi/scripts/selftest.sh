#!/bin/bash
set -e
cd "$(dirname "$0")/.."
HEADLESS=1 SIMULATION=keyboard python app.py <<'INPUT'
ciao
stop
INPUT
