#!/usr/bin/env bash
# Deploy or update Qualyx on the VPS. Run as the `qualyx` user from $INSTALL_DIR.
# Usage: deploy.sh [commit]. Deploys that commit (CD passes the one that passed the tests), else latest main.
set -euo pipefail

cd "$(dirname "$0")/.."

if [ ! -f .env ]; then
  echo "error: deploy/.env is missing. Copy deploy/.env.example and fill it in."
  exit 1
fi

REF=${1:-origin/main}
echo "==> Checking out $REF"
git -C .. fetch --quiet origin main
git -C .. checkout main
git -C .. reset --hard "$REF"

echo "==> Building and restarting services"
docker compose up -d --build

echo "==> Pruning dangling images"
docker image prune -f

echo "==> Deploy complete. Tail logs with: docker compose logs -f"
