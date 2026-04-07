# Qualyx Deployment Guide

Three options for running Qualyx on a schedule. Pick whichever fits your infrastructure.

---

## Option A: VPS with Cron (simplest, cheapest)

### Requirements

- Ubuntu 22.04+ (or any Linux with Node.js support)
- 2 vCPU, 4 GB RAM minimum (Playwright + Chromium need headroom)
- Node.js 20+

### Setup

```bash
# Install Qualyx and dependencies
npm install -g qualyx @anthropic-ai/claude-code
npx playwright install --with-deps chromium

# Create working directory
sudo mkdir -p /opt/qualyx
sudo chown $USER:$USER /opt/qualyx
cd /opt/qualyx

# Copy your config
cp /path/to/qualyx.yml .

# Create .env with your settings
cat > .env << 'EOF'
# Optional — uncomment when ready:
# SMTP_HOST=smtp.gmail.com
# SMTP_USER=you@gmail.com
# SMTP_PASS=app-password
# SLACK_WEBHOOK_URL=https://hooks.slack.com/services/...
# JIRA_EMAIL=you@company.com
# JIRA_API_TOKEN=...
EOF
chmod 600 .env
```

### Cron Setup

Generate crontab entries from your config:

```bash
qualyx schedule cron
```

Or use the wrapper script:

```bash
cp deploy/run-daily.sh /opt/qualyx/
chmod +x /opt/qualyx/run-daily.sh

# Add to crontab
crontab -e
# Daily at 7 AM:
# 0 7 * * * /opt/qualyx/run-daily.sh
```

### Log Rotation

```bash
sudo tee /etc/logrotate.d/qualyx << 'EOF'
/var/log/qualyx/*.log {
    daily
    rotate 14
    compress
    missingok
    notifempty
}
EOF

sudo mkdir -p /var/log/qualyx
sudo chown $USER:$USER /var/log/qualyx
```

---

## Option B: GitHub Actions (zero infrastructure)

Generate the workflow file:

```bash
qualyx schedule github --output .github/workflows/qualyx-qa.yml
```

Or create it manually:

```yaml
# .github/workflows/qualyx-qa.yml
name: Qualyx QA

on:
  schedule:
    - cron: '0 7 * * *'    # Daily at 7 AM UTC
  workflow_dispatch:         # Manual trigger

jobs:
  qa-run:
    runs-on: ubuntu-latest
    timeout-minutes: 30
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: 20

      - name: Install dependencies
        run: |
          npm install -g qualyx @anthropic-ai/claude-code
          npx playwright install --with-deps chromium

      - name: Run QA suite
        run: |
          qualyx run --parallel --max-parallel 3 --report --collect-metrics

      - name: Upload reports
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: qualyx-reports-${{ github.run_number }}
          path: |
            qualyx-reports/
            .qualyx/
          retention-days: 30
```

### Trade-offs

- Uses CI minutes
- No persistent history DB across runs (each run starts fresh)
- Reports available as downloadable artifacts

---

## Option C: Docker (portable)

### Build and Run

```bash
cd deploy/

# Build
docker compose build

# Run once
docker compose run --rm qualyx

# Run detached with cron inside container
docker compose up -d
```

### Deploying to Cloud

The Docker image works on any Docker host:

- **AWS ECS / Fargate** — push to ECR, create task definition
- **GCP Cloud Run** — push to Artifact Registry, create scheduled job
- **DigitalOcean App Platform** — connect repo, set env vars
- **Any VPS** — install Docker, `docker compose up -d`

### Volumes

- `./reports` — HTML reports and screenshots (mounted from host)
- `./data` — SQLite history database (persisted across runs)

---

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SMTP_HOST` | No | SMTP server for email reports |
| `SMTP_USER` | No | SMTP username |
| `SMTP_PASS` | No | SMTP password |
| `SLACK_WEBHOOK_URL` | No | Slack incoming webhook URL |
| `JIRA_EMAIL` | No | Jira account email |
| `JIRA_API_TOKEN` | No | Jira API token |
