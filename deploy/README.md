# Qualyx Deployment

Production runs on the shared Hetzner server maskly-prod (with maskly, Lecture Studio and CommMaster) as the
compose project `qualyx` in `/opt/qualyx`: `web` (Next.js), `worker` (pg-boss + Playwright + Claude CLI), its own
Postgres `db`, and a nightly `backup`. The server's Caddy (maskly repo, `infra/Caddyfile`) serves
`https://qualyx.korayuysal.com` and proxies to `qualyx-web`. pg-boss uses the same Postgres; no separate queue.

## Continuous deployment

`.github/workflows/deploy.yml`: every merge to main is tested, shipped to `/opt/qualyx` (rsync), and
`deploy/scripts/deploy.sh` runs on the server: database dump (a failed dump stops the deploy), new migrations, rebuild,
restart; then a health check. Rollback: Actions -> Deploy -> Run workflow, and enter an older commit. Migrations only go
forward: to undo one, restore a dump from `/opt/qualyx/backups`.

## Migrations

`packages/core/drizzle/*.sql`, applied once each in name order, each in one transaction, recorded in the table
`schema_migrations`. `0000_baseline.sql` is the full schema (`drizzle-kit export`). For a schema change, edit
`src/db/schema.ts` and add the matching SQL as a new file that sorts after the existing ones.

## Server setup (once, done 2026-10-12)

- `deploy/.env` (`chmod 600`, copy in 1Password: `qualyx-prod-env`), see `.env.example`.
- DNS `qualyx.korayuysal.com` -> the server, DNS only; site block in the maskly repo's `infra/Caddyfile`.
- CD secrets: `software-factory/infra/cd/setup-deploy-secrets.sh korayuysal/qualyx root@91.98.196.67 https://qualyx.korayuysal.com/login`.
- First user: register with an invite code. Create one on the server:
  `docker compose --env-file deploy/.env -f deploy/docker-compose.yml exec db psql -U qualyx -c "insert into invite_codes (code) values ('<code>')"`

## Claude credentials for the worker

The worker's Claude CLI logs in with `CLAUDE_CODE_OAUTH_TOKEN` in `deploy/.env` (copy in 1Password:
`qualyx-claude-oauth-token`). It is a long-lived token on the Max plan, made on the Mac with `claude setup-token`.
To rotate: make a new token, replace the line in `deploy/.env`, then
`docker compose --env-file deploy/.env -f deploy/docker-compose.yml up -d worker`.

## Operations

```bash
cd /opt/qualyx
C="docker compose --env-file deploy/.env -f deploy/docker-compose.yml"
$C ps; $C logs -f worker           # status, logs
$C exec db psql -U qualyx          # SQL
```

Limits so qualyx cannot starve the other apps: worker 2 CPUs / 3 GB, web 768 MB, db 512 MB.
