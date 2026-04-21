# Qualyx Deployment

Production deployment of the Qualyx platform (web + worker + Caddy) on a single Hetzner VPS, using Docker Compose and Supabase for the database.

## Topology

```
  Internet
     │
     ▼
  ┌─────────────┐
  │ Caddy (TLS) │  :80 / :443
  └──────┬──────┘
         │
         ▼
  ┌──────────┐   ┌──────────┐
  │ web      │   │ worker   │
  │ (Next.js)│   │ (pg-boss │
  │          │   │  + claude│
  │          │   │  CLI)    │
  └────┬─────┘   └─────┬────┘
       │               │
       └──────┬────────┘
              │
              ▼
      Supabase (Postgres)
```

The web and worker both talk to Supabase. pg-boss rides on the same Postgres — no separate queue broker. The worker shells out to the Claude Code CLI, which authenticates via credentials mounted at `/home/qualyx/.claude` (copied from your laptop's Claude Max login).

## Prerequisites

- A Hetzner VPS (CX32 or better — 4 vCPU / 8 GB RAM is comfortable headroom for Playwright)
- Ubuntu 24.04 LTS
- Root SSH access
- A domain name you control, with an A record pointing at the VPS public IP
- The Qualyx Supabase project's connection string (session pooler + direct)
- Your Claude Max login on your laptop (the `~/.claude/` directory)

## First-time setup

On the VPS, as root:

```bash
curl -fsSL https://raw.githubusercontent.com/korayuysal/qualyx/main/deploy/scripts/bootstrap.sh | bash
```

That script installs Docker, creates a `qualyx` user, clones the repo to `/opt/qualyx`, and opens ports 22/80/443 via UFW.

From your laptop, copy your Claude Max credentials over:

```bash
scp -r ~/.claude qualyx@<vps-ip>:/opt/qualyx/deploy/claude-home/
```

On the VPS, as `qualyx`:

```bash
cd /opt/qualyx/deploy
cp .env.example .env
# edit .env — fill in DOMAIN, DATABASE_URL, DATABASE_URL_DIRECT, AUTH_SECRET
```

Apply the database schema (first time only, or whenever migrations change):

```bash
for sql in /opt/qualyx/packages/core/drizzle/*.sql; do
  psql "$DATABASE_URL_DIRECT" -v ON_ERROR_STOP=1 -f "$sql"
done
```

Start everything:

```bash
cd /opt/qualyx/deploy
docker compose up -d --build
docker compose logs -f
```

Visit `https://<DOMAIN>` once DNS has propagated — Caddy will issue a Let's Encrypt cert automatically.

## Updates

GitHub Actions runs `deploy/scripts/deploy.sh` on every push to `main`. It's a thin wrapper around `git pull && docker compose up -d --build`.

Manual deploy (useful for testing a branch on the VPS):

```bash
ssh qualyx@<vps-ip>
cd /opt/qualyx
bash deploy/scripts/deploy.sh
```

## GitHub Actions secrets

Configure these on the `production` environment in the GitHub repo settings:

| Secret            | Value                                                        |
| ----------------- | ------------------------------------------------------------ |
| `SSH_HOST`        | VPS public IP or hostname                                    |
| `SSH_USER`        | `qualyx`                                                     |
| `SSH_PRIVATE_KEY` | Contents of a private key whose public half is in the user's `~/.ssh/authorized_keys` on the VPS |

## Debugging

```bash
# tail everything
docker compose logs -f

# one service
docker compose logs -f worker

# one-off shell inside web
docker compose exec web sh

# check Caddy config / certs
docker compose exec caddy caddy validate --config /etc/caddy/Caddyfile
docker compose exec caddy ls /data/caddy/certificates

# claude auth sanity check from the worker
docker compose exec worker claude --help
```

## Claude Max credential rotation

OAuth tokens in `~/.claude/` refresh themselves on use, but they can be revoked server-side. If the worker starts failing with auth errors:

```bash
# on your laptop — re-login, then resync
claude login
scp -r ~/.claude qualyx@<vps-ip>:/opt/qualyx/deploy/claude-home/
ssh qualyx@<vps-ip> "cd /opt/qualyx/deploy && docker compose restart worker"
```

## Backups

Supabase handles Postgres backups. The VPS itself is stateless — everything Qualyx writes lives in Postgres (via pg-boss + Drizzle) or in Caddy's TLS cert volumes. Rebuild the box from scratch if it dies.
