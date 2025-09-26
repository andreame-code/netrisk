#!/usr/bin/env bash
set -euo pipefail

cd /workspaces/netrisk

if command -v corepack >/dev/null 2>&1; then
  corepack enable
  corepack prepare pnpm@10.5.2 --activate
fi

pnpm install
