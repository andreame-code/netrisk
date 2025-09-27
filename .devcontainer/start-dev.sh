#!/usr/bin/env bash
set -euo pipefail

cd /workspaces/netrisk

export CLIENT_URL="${CLIENT_URL:-http://localhost:3000}"
export API_URL="${API_URL:-http://localhost:3001}"
export NEXT_PUBLIC_API_BASE="${NEXT_PUBLIC_API_BASE:-$API_URL}"

echo "[devcontainer] CLIENT_URL set to $CLIENT_URL"
echo "[devcontainer] API_URL set to $API_URL"
echo "[devcontainer] NEXT_PUBLIC_API_BASE set to $NEXT_PUBLIC_API_BASE"
echo "[devcontainer] Starting pnpm dev..."

pnpm dev
