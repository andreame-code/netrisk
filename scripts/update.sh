#!/usr/bin/env bash
set -e

echo "update $(date +%s)" >> "$HOME/chatpi-update.log"
systemctl --user restart chatpi.service
