#!/usr/bin/env bash
# Runs on the server (CD calls it after shipping the tested code to /opt/qualyx):
# dump the database, apply new migrations, then rebuild and restart everything.
set -euo pipefail
cd "${APP_DIR:-/opt/qualyx}"
test -f deploy/.env || { echo "deploy/.env is missing (copy in 1Password: qualyx-prod-env)"; exit 1; }
mkdir -p backups
C="docker compose --env-file deploy/.env -f deploy/docker-compose.yml"
SQL="$C exec -T db psql -U qualyx -d qualyx -v ON_ERROR_STOP=1 -qtA"

if [ -n "$($C ps -q db)" ]; then  # a failed dump stops the deploy: migrations may change data
  $C exec -T db pg_dump -U qualyx -Fc qualyx > "backups/predeploy-$(date +%F-%H%M).dump"
  find backups -name 'predeploy-*' -mtime +14 -delete
  echo "pre-deploy dump ok"
fi

$C up -d --wait db
# Each packages/core/drizzle file runs once, in name order, in its own transaction.
$SQL -c "create table if not exists schema_migrations (name text primary key, applied_at timestamptz default now())"
for f in packages/core/drizzle/*.sql; do
  name=$(basename "$f" .sql)
  [ "$($SQL -c "select 1 from schema_migrations where name = '$name'")" = 1 ] && continue
  echo "applying $name"
  { cat "$f"; echo; echo "insert into schema_migrations (name) values ('$name');"; } \
    | $C exec -T db psql -U qualyx -d qualyx -v ON_ERROR_STOP=1 -q -1
done

$C up -d --build --wait --remove-orphans
docker image prune -f >/dev/null
$C ps
