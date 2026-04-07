#!/bin/bash
set -euo pipefail

# Qualyx daily run wrapper for cron
# Usage: Add to crontab: 0 7 * * * /opt/qualyx/run-daily.sh

WORKDIR="/opt/qualyx"
LOGDIR="/var/log/qualyx"

mkdir -p "$LOGDIR"
source "$WORKDIR/.env"
cd "$WORKDIR"

qualyx run --parallel --max-parallel 3 --report --collect-metrics \
  2>&1 | tee "$LOGDIR/run-$(date +%Y%m%d-%H%M%S).log"
