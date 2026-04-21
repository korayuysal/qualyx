#!/usr/bin/env bash
# Bootstrap a fresh Hetzner / Debian-Ubuntu VPS for Qualyx.
# Run as root on the VPS right after first SSH login. Idempotent.
set -euo pipefail

REPO_URL="${REPO_URL:-https://github.com/korayuysal/qualyx.git}"
INSTALL_DIR="${INSTALL_DIR:-/opt/qualyx}"
DEPLOY_USER="${DEPLOY_USER:-qualyx}"

echo "==> Installing system packages"
apt-get update
apt-get install -y ca-certificates curl git ufw postgresql-client

echo "==> Installing Docker Engine + Compose plugin"
curl -fsSL https://get.docker.com | sh
systemctl enable --now docker

echo "==> Creating deploy user '$DEPLOY_USER'"
if ! id "$DEPLOY_USER" >/dev/null 2>&1; then
  adduser --disabled-password --gecos "" "$DEPLOY_USER"
fi
usermod -aG docker "$DEPLOY_USER"

echo "==> Cloning repo into $INSTALL_DIR"
if [ ! -d "$INSTALL_DIR/.git" ]; then
  git clone "$REPO_URL" "$INSTALL_DIR"
fi
chown -R "$DEPLOY_USER:$DEPLOY_USER" "$INSTALL_DIR"

echo "==> Configuring UFW (allow SSH + HTTP + HTTPS)"
ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable

cat <<EOF

==> Bootstrap complete. Next steps:

  1. Copy your Claude Max credentials to the VPS:
     scp -r ~/.claude $DEPLOY_USER@<vps>:$INSTALL_DIR/deploy/claude-home/

  2. Create $INSTALL_DIR/deploy/.env from deploy/.env.example and fill it in.

  3. Point your domain's A record at this VPS IP.

  4. su - $DEPLOY_USER
     cd $INSTALL_DIR/deploy
     docker compose up -d --build

  5. Apply DB migrations against Supabase:
     for sql in $INSTALL_DIR/packages/core/drizzle/*.sql; do
       psql "\$DATABASE_URL_DIRECT" -v ON_ERROR_STOP=1 -f "\$sql"
     done

EOF
