#!/usr/bin/env bash
# Deploy or update Qualyx on the VPS. Run as the `qualyx` user from $INSTALL_DIR.
# Pulls latest main, rebuilds images, restarts services.
set -euo pipefail

cd "$(dirname "$0")/.."

if [ ! -f .env ]; then
  echo "error: deploy/.env is missing. Copy deploy/.env.example and fill it in."
  exit 1
fi

echo "==> Pulling latest from origin/main"
git -C .. fetch --quiet origin main
git -C .. checkout main
git -C .. reset --hard origin/main

echo "==> Building and restarting services"
docker compose pull --ignore-pull-failures || true
docker compose up -d --build

echo "==> Pruning dangling images"
docker image prune -f

echo "==> Deploy complete. Tail logs with: docker compose logs -f"
