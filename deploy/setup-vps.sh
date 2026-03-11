#!/usr/bin/env bash
# =============================================================================
# DocNear (RxDesk) – VPS First-Time Setup Script
# Target: Ubuntu 22.04 LTS
# Run as root or a sudo user:   sudo bash setup-vps.sh
# =============================================================================
set -euo pipefail

APP_DIR="/var/www/rxdesk"
LOG_DIR="/var/log/rxdesk"
APP_USER="rxdesk"

echo "══════════════════════════════════════════════════════"
echo "  DocNear VPS Setup"
echo "══════════════════════════════════════════════════════"

# ── 1. System update ──────────────────────────────────────────────────────────
apt-get update -y && apt-get upgrade -y
apt-get install -y curl wget git unzip ufw fail2ban logrotate

# ── 2. Node.js 20 (via NodeSource) ───────────────────────────────────────────
if ! command -v node &>/dev/null; then
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt-get install -y nodejs
fi
node -v && npm -v

# ── 3. PM2 ────────────────────────────────────────────────────────────────────
npm install -g pm2

# ── 4. Docker + Docker Compose ───────────────────────────────────────────────
if ! command -v docker &>/dev/null; then
  curl -fsSL https://get.docker.com | sh
  systemctl enable docker
  systemctl start docker
fi
docker --version

# ── 5. Nginx ──────────────────────────────────────────────────────────────────
apt-get install -y nginx
systemctl enable nginx

# ── 6. Certbot (Let's Encrypt) ────────────────────────────────────────────────
apt-get install -y certbot python3-certbot-nginx

# ── 7. Chromium for Puppeteer (PDF generation) ───────────────────────────────
apt-get install -y \
  chromium-browser \
  libnss3 libatk1.0-0 libatk-bridge2.0-0 libcups2 libdrm2 \
  libxkbcommon0 libxcomposite1 libxdamage1 libxrandr2 \
  libgbm1 libpango-1.0-0 libcairo2 libasound2

# ── 8. Application user & directories ────────────────────────────────────────
id "$APP_USER" &>/dev/null || useradd --system --shell /bin/bash --create-home "$APP_USER"
mkdir -p "$APP_DIR" "$LOG_DIR"
chown -R "$APP_USER":"$APP_USER" "$APP_DIR" "$LOG_DIR"

# ── 9. Firewall (UFW) ─────────────────────────────────────────────────────────
ufw --force reset
ufw default deny incoming
ufw default allow outgoing
ufw allow OpenSSH
ufw allow 'Nginx Full'   # 80 + 443
# Internal ports (5432, 6379) are NOT opened – Docker binds them to 127.0.0.1
ufw --force enable
ufw status verbose

# ── 10. Fail2ban ──────────────────────────────────────────────────────────────
cat >/etc/fail2ban/jail.d/rxdesk.conf <<'EOF'
[sshd]
enabled  = true
maxretry = 5
findtime = 600
bantime  = 3600

[nginx-http-auth]
enabled = true

[nginx-limit-req]
enabled  = true
filter   = nginx-limit-req
action   = iptables-multiport[name=ReqLimit, port="http,https", protocol=tcp]
logpath  = /var/log/nginx/*.log
findtime = 600
bantime  = 7200
maxretry = 10
EOF
systemctl enable fail2ban
systemctl restart fail2ban

# ── 11. Log rotation for app logs ─────────────────────────────────────────────
cat >/etc/logrotate.d/rxdesk <<'EOF'
/var/log/rxdesk/*.log {
    daily
    rotate 14
    compress
    delaycompress
    missingok
    notifempty
    sharedscripts
    postrotate
        pm2 reloadLogs
    endscript
}
EOF

echo ""
echo "══════════════════════════════════════════════════════"
echo "  Setup complete. Next steps:"
echo ""
echo "  1. Clone repo:   git clone <repo-url> $APP_DIR"
echo "  2. Copy env:     cp deploy/.env.prod $APP_DIR/apps/backend/.env"
echo "                   cp deploy/.env.web.prod $APP_DIR/apps/web/.env.local"
echo "  3. Start infra:  cd $APP_DIR && docker compose -f deploy/docker-compose.prod.yml up -d"
echo "  4. Build apps:   npm install && npm run build"
echo "  5. DB migrate:   cd apps/backend && npx prisma migrate deploy"
echo "  6. Start apps:   pm2 start deploy/ecosystem.config.js --env production"
echo "  7. Save PM2:     pm2 save && pm2 startup"
echo "  8. Nginx:        cp deploy/nginx/rxdesk.conf /etc/nginx/sites-available/rxdesk"
echo "                   ln -s /etc/nginx/sites-available/rxdesk /etc/nginx/sites-enabled/"
echo "                   nginx -t && systemctl reload nginx"
echo "  9. SSL:          certbot --nginx -d api.yourdomain.com -d app.yourdomain.com"
echo "══════════════════════════════════════════════════════"
