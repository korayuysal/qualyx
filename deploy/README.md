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
sudo mkdir -p /opt/qualyx-blue-style
sudo chown $USER:$USER /opt/qualyx-blue-style
cd /opt/qualyx-blue-style

# Copy your config
cp /path/to/qualyx.yml .

# Create .env
cat > .env << 'EOF'
ANTHROPIC_API_KEY=sk-ant-...
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
cp deploy/run-daily.sh /opt/qualyx-blue-style/
chmod +x /opt/qualyx-blue-style/run-daily.sh

# Add to crontab
crontab -e
# Daily at 7 AM:
# 0 7 * * * /opt/qualyx-blue-style/run-daily.sh
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
qualyx schedule github --output .github/workflows/qualyx-blue-style.yml
```

Or create it manually:

```yaml
# .github/workflows/qualyx-blue-style.yml
name: Qualyx - Blue Style QA

on:
  schedule:
    - cron: '0 7 * * *'    # Daily at 7 AM UTC
    - cron: '0 0 * * 1'    # Weekly Monday midnight UTC
    - cron: '0 7 * * 3'    # Weekly Wednesday 7 AM UTC
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
        env:
          ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
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

### Required Secrets

In your repo Settings > Secrets and variables > Actions:

- `ANTHROPIC_API_KEY` — your Anthropic API key

### Trade-offs

- Uses CI minutes (~78 runs/week with the schedules above)
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
| `ANTHROPIC_API_KEY` | Yes | Anthropic API key for Claude |
| `SMTP_HOST` | No | SMTP server for email reports |
| `SMTP_USER` | No | SMTP username |
| `SMTP_PASS` | No | SMTP password |
| `SLACK_WEBHOOK_URL` | No | Slack incoming webhook URL |
| `JIRA_EMAIL` | No | Jira account email |
| `JIRA_API_TOKEN` | No | Jira API token |
