#!/usr/bin/env bash
# One-time server setup for Ubuntu 22.04/24.04 (e.g. Oracle Cloud Always Free, Ampere A1).
# Run from the cloned repo:  sudo ./deploy/setup.sh acq.yourdomain.com you@email.com
set -euo pipefail
DOMAIN="${1:?usage: sudo deploy/setup.sh <domain> <email>}"
EMAIL="${2:?usage: sudo deploy/setup.sh <domain> <email>}"
cd "$(dirname "$0")/.."

echo "→ Installing Docker"
if ! command -v docker >/dev/null; then
  curl -fsSL https://get.docker.com | sh
fi
systemctl enable --now docker

echo "→ Opening ports 80/443 in the host firewall (Oracle Ubuntu images block them by default)"
if command -v iptables >/dev/null; then
  for p in 80 443; do
    iptables -C INPUT -p tcp --dport $p -j ACCEPT 2>/dev/null || iptables -I INPUT 6 -m state --state NEW -p tcp --dport $p -j ACCEPT
  done
  command -v netfilter-persistent >/dev/null && netfilter-persistent save || true
fi

echo "→ Writing .env.production (secrets generated locally, never leave this server)"
if [ ! -f .env.production ]; then
  cat > .env.production <<ENV
DOMAIN=$DOMAIN
ACME_EMAIL=$EMAIL
POSTGRES_PASSWORD=$(openssl rand -hex 24)
SESSION_SECRET=$(openssl rand -base64 48 | tr -d '\n')
EXTERNAL_ACTIONS_ENABLED=false
DEALMACHINE_API_KEY=
DEALMACHINE_WEBHOOK_SECRET=
BACKUP_KEEP_DAYS=14
ENV
  chmod 600 .env.production
fi
mkdir -p backups

echo "→ Building and starting (first build takes a few minutes)"
docker compose --env-file .env.production up -d --build

echo
echo "✓ Running. Next:"
echo "  1. Point DNS: an A record for $DOMAIN → this server's public IP."
echo "  2. Create your login:"
echo "     docker compose --env-file .env.production exec -e NEW_USER_PASSWORD='choose-12+-chars' app npx tsx scripts/create-user.ts $EMAIL \"Your Name\" owner"
echo "  3. Open https://$DOMAIN"
