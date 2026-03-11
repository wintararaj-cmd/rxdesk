# DocNear – VPS Deployment Guide

## Architecture

```
Internet
   │
   ▼
[Nginx :80/:443]  ── SSL terminated by Certbot
   ├── api.yourdomain.com  → localhost:3000  (Express + Socket.IO)
   └── app.yourdomain.com  → localhost:3001  (Next.js)

[PM2 Cluster]
   ├── rxdesk-backend  (Node.js, cluster mode, port 3000)
   └── rxdesk-web      (Next.js, fork mode, port 3001)

[Docker]
   ├── rxdesk_postgres  (127.0.0.1:5432)
   └── rxdesk_redis     (127.0.0.1:6379)

[External Services]
   ├── AWS S3           – file uploads / pre-signed URLs
   ├── MSG91            – SMS OTP & reminders
   ├── Firebase FCM     – push notifications
   ├── Razorpay         – payments
   └── Google Maps API  – geo search
```

## Recommended VPS Specs

| Tier | CPU | RAM | Disk | Notes |
|------|-----|-----|------|-------|
| Minimum | 2 vCPU | 4 GB | 40 GB SSD | Suitable for initial launch |
| Recommended | 4 vCPU | 8 GB | 80 GB SSD | Comfortable for 500+ concurrent users |
| Puppeteer note | +1 vCPU | +1 GB | – | PDF generation is CPU/RAM intensive |

OS: **Ubuntu 22.04 LTS**

---

## Step-by-Step Deployment

### 1. First-time VPS setup

```bash
sudo bash deploy/setup-vps.sh
```

This installs: Node.js 20, PM2, Docker, Nginx, Certbot, Chromium (for Puppeteer), UFW firewall, Fail2ban.

---

### 2. Clone the Repository

```bash
sudo -u rxdesk git clone <repo-url> /var/www/rxdesk
```

---

### 3. Configure Environment Variables

```bash
# Infrastructure (Postgres + Redis passwords)
cp deploy/.env.infra /var/www/rxdesk/deploy/.env
nano /var/www/rxdesk/deploy/.env       # fill in POSTGRES_PASSWORD, REDIS_PASSWORD

# Backend
cp deploy/.env.backend.prod /var/www/rxdesk/apps/backend/.env
nano /var/www/rxdesk/apps/backend/.env # fill in all secrets

# Web
cp deploy/.env.web.prod /var/www/rxdesk/apps/web/.env.local
```

Generate secrets quickly:
```bash
openssl rand -hex 32   # use output for JWT secrets, HMAC secret
openssl rand -hex 16   # use output for DB / Redis passwords
```

---

### 4. Start Infrastructure

```bash
cd /var/www/rxdesk
docker compose -f deploy/docker-compose.prod.yml --env-file deploy/.env up -d
docker compose -f deploy/docker-compose.prod.yml ps   # verify healthy
```

---

### 5. Install Dependencies & Build

```bash
cd /var/www/rxdesk
npm install
npm run build        # builds packages/shared → apps/backend (tsc) → apps/web (next build)
```

> If Turborepo remote cache is not configured, expect 3–5 minutes on first build.

---

### 6. Run Database Migrations

```bash
cd /var/www/rxdesk/apps/backend
npx prisma migrate deploy
# Optionally seed reference data:
# npx ts-node prisma/seed.ts
```

---

### 7. Start Application with PM2

```bash
cd /var/www/rxdesk
pm2 start deploy/ecosystem.config.js --env production
pm2 status
pm2 save
pm2 startup   # copy and run the printed command to enable auto-start on reboot
```

---

### 8. Configure Nginx

```bash
# Edit the conf to replace yourdomain.com with your actual domain
nano /var/www/rxdesk/deploy/nginx/rxdesk.conf

cp /var/www/rxdesk/deploy/nginx/rxdesk.conf /etc/nginx/sites-available/rxdesk
ln -s /etc/nginx/sites-available/rxdesk /etc/nginx/sites-enabled/rxdesk
rm -f /etc/nginx/sites-enabled/default    # remove default site
nginx -t                                   # must print "ok"
systemctl reload nginx
```

---

### 9. Issue SSL Certificates

```bash
certbot --nginx -d api.yourdomain.com -d app.yourdomain.com
```

Certbot auto-renews via a systemd timer. Verify:
```bash
systemctl status certbot.timer
certbot renew --dry-run
```

---

### 10. Verify Everything

```bash
curl https://api.yourdomain.com/health          # → {"status":"ok",...}
curl -I https://app.yourdomain.com              # → HTTP/2 200
pm2 status                                      # both apps online
docker compose -f /var/www/rxdesk/deploy/docker-compose.prod.yml ps  # both healthy
```

---

## Routine Operations

### Deploy an Update

```bash
cd /var/www/rxdesk
git pull
npm install
npm run build
cd apps/backend && npx prisma migrate deploy && cd ../..
pm2 reload ecosystem.config.js --env production  # zero-downtime reload
```

### View Logs

```bash
pm2 logs rxdesk-backend --lines 100
pm2 logs rxdesk-web     --lines 100
tail -f /var/log/nginx/rxdesk_api_error.log
tail -f /var/log/nginx/rxdesk_web_error.log
```

### Restart Services

```bash
pm2 restart rxdesk-backend
pm2 restart rxdesk-web
docker compose -f /var/www/rxdesk/deploy/docker-compose.prod.yml restart
```

---

## Security Notes

- PostgreSQL and Redis are bound to `127.0.0.1` only — never exposed to the internet.
- UFW blocks all ports except SSH (22), HTTP (80), HTTPS (443).
- Fail2ban bans IPs after repeated SSH / Nginx auth failures.
- `DEV_FIXED_OTP` must **not** be set in the production `.env`.
- Rotate JWT secrets and DB passwords periodically; restart PM2 after rotating.
- Socket.IO cluster mode requires sticky sessions; if running `instances: max` (>1), configure the Nginx [sticky module](https://nginx.org/en/docs/http/ngx_http_upstream_module.html) or switch to `instances: 1` until a Redis adapter is wired.

---

## Files in this Directory

| File | Purpose |
|------|---------|
| `setup-vps.sh` | One-time VPS provisioning script |
| `docker-compose.prod.yml` | Production Postgres + Redis containers |
| `ecosystem.config.js` | PM2 process definitions |
| `nginx/rxdesk.conf` | Nginx reverse-proxy + SSL config |
| `.env.backend.prod` | Template for `apps/backend/.env` |
| `.env.web.prod` | Template for `apps/web/.env.local` |
| `.env.infra` | Template for Docker Compose secrets |
