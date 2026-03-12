# RxDesk – Coolify Deployment Guide

This guide walks you through deploying **RxDesk** on a VPS using [Coolify](https://coolify.io) (self-hosted PaaS).

---

## Architecture on Coolify

```
Coolify (your VPS)
  ├── PostgreSQL 15        (managed database service)
  ├── Redis 7              (managed database service)
  ├── rxdesk-backend       (Docker – apps/backend/Dockerfile)
  └── rxdesk-web           (Docker – apps/web, Nixpacks/Node buildpack)

Coolify Proxy (Traefik) handles:
  ├── api.yourdomain.com   → backend :3000
  └── app.yourdomain.com   → web :3001
```

---

## Prerequisites

- A VPS with **Coolify installed** (min 2 vCPU, 4 GB RAM, Ubuntu 22.04)
- Coolify installation: `curl -fsSL https://cdn.coollabs.io/coolify/install.sh | bash`
- A domain with DNS access
- The repo pushed to GitHub: `https://github.com/wintararaj-cmd/rxdesk.git`
- Coolify connected to your GitHub account (Settings → Source → GitHub App)

---

## Step 1 – Create a Project

1. Open Coolify UI → **Projects** → **New Project**
2. Name it `rxdesk`
3. Create one **environment**: `production`

---

## Step 2 – Add PostgreSQL

1. Inside the `rxdesk` project → **New Resource** → **Database** → **PostgreSQL 15**
2. Settings:
   - **Name**: `rxdesk-postgres`
   - **Database name**: `rxdesk_prod`
   - **Username**: `rxdesk`
   - **Password**: generate a strong password and **copy it** – you'll need it later
3. Click **Start**
4. After it starts, click the database resource → **Connection** tab  
   Copy the **Internal Connection URL** – it looks like:
   ```
   postgresql://rxdesk:<password>@rxdesk-postgres:5432/rxdesk_prod
   ```

---

## Step 3 – Add Redis

1. Inside the `rxdesk` project → **New Resource** → **Database** → **Redis 7**
2. Settings:
   - **Name**: `rxdesk-redis`
   - **Password**: generate a strong password and **copy it**
3. Click **Start**
4. After it starts, copy the **Internal Connection URL**:
   ```
   redis://:<password>@rxdesk-redis:6379
   ```

---

## Step 4 – Deploy the Backend

### 4.1 – Create the service

1. **New Resource** → **Application** → **GitHub** → select `wintararaj-cmd/rxdesk`
2. Settings:
   - **Branch**: `master`
   - **Build Pack**: `Dockerfile`
   - **Dockerfile location**: `apps/backend/Dockerfile`
   - **Port**: `3000`
   - **Name**: `rxdesk-backend`

### 4.2 – Set environment variables

Go to **Environment Variables** for `rxdesk-backend` and add all of the following:

| Variable | Value |
|----------|-------|
| `NODE_ENV` | `production` |
| `PORT` | `3000` |
| `DATABASE_URL` | *(Internal URL from Step 2)* |
| `REDIS_URL` | *(Internal URL from Step 3)* |
| `JWT_ACCESS_SECRET` | *(random 64-char string — see tip below)* |
| `JWT_REFRESH_SECRET` | *(different random 64-char string)* |
| `JWT_ACCESS_EXPIRES_IN` | `15m` |
| `JWT_REFRESH_EXPIRES_IN` | `30d` |
| `PRESCRIPTION_HMAC_SECRET` | *(random 32-char string)* |
| `FRONTEND_URL` | `https://app.yourdomain.com` |
| `API_URL` | `https://api.yourdomain.com` |
| `ADMIN_PHONE` | `9999999999` *(your admin phone, without +91)* |
| `AWS_ACCESS_KEY_ID` | *(S3/R2/B2 key)* |
| `AWS_SECRET_ACCESS_KEY` | *(S3/R2/B2 secret)* |
| `AWS_REGION` | `ap-south-1` |
| `S3_BUCKET_NAME` | `rxdesk-files` |
| `S3_ENDPOINT` | *(only if using R2 or B2, else omit)* |
| `FAST2SMS_API_KEY` | *(your Fast2SMS API key)* |
| `FIREBASE_SERVICE_ACCOUNT_JSON` | *(full JSON in one line — see tip below)* |
| `RAZORPAY_KEY_ID` | `rzp_live_xxxx` |
| `RAZORPAY_KEY_SECRET` | *(Razorpay secret)* |
| `RAZORPAY_WEBHOOK_SECRET` | *(Razorpay webhook secret)* |
| `GOOGLE_MAPS_API_KEY` | *(Google Maps key)* |
| `OTP_EXPIRY_SECONDS` | `300` |
| `OTP_LENGTH` | `6` |

> **Tip – generate secrets:**
> ```bash
> # On any Linux machine or the VPS:
> openssl rand -hex 32
> ```

> **Tip – Firebase JSON:** Paste the entire service account JSON on a single line.
> In the Firebase console: Project Settings → Service Accounts → Generate New Private Key.
> Minify it: `cat firebase.json | jq -c .`

### 4.3 – Configure domain

1. Go to **Domains** for `rxdesk-backend`
2. Add: `api.yourdomain.com`
3. Enable **HTTPS** (Coolify handles Let's Encrypt automatically)

### 4.4 – Deploy

Click **Deploy**. Coolify will:
- Build the Docker image
- On first boot, `docker-entrypoint.sh` automatically runs:
  1. `prisma migrate deploy` — applies all DB migrations
  2. `node dist-seed/prisma/seed.js` — seeds medicine catalog, subscription plans, and admin user
  3. Starts the Express + Socket.IO server

> **What the seed creates on first deployment:**
> - 120+ Indian medicines in the catalog (safe to re-run — uses upsert)
> - 3 subscription plans: Basic (₹499), Advanced (₹999), Premium (₹1999)
> - Admin user with phone `+91<ADMIN_PHONE>`

---

## Step 5 – Deploy the Web Frontend

### 5.1 – Create the Web Dockerfile

The `apps/web` folder does not have its own Dockerfile. Add one to enable Docker-based deployment in Coolify:

Create `apps/web/Dockerfile`:

```dockerfile
FROM node:20-alpine AS builder
WORKDIR /app

COPY package.json turbo.json ./
COPY packages/shared/package.json ./packages/shared/
COPY apps/web/package.json ./apps/web/

RUN npm install --frozen-lockfile

COPY packages/shared/ ./packages/shared/
COPY apps/web/ ./apps/web/

WORKDIR /app/packages/shared
RUN npm run build

WORKDIR /app/apps/web
ARG NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
RUN npm run build

# ── Production ──────────────────────────────────────────────────────
FROM node:20-alpine AS production
RUN apk add --no-cache dumb-init
WORKDIR /app

COPY --from=builder /app/apps/web/.next/standalone ./
COPY --from=builder /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=builder /app/apps/web/public ./apps/web/public

ENV NODE_ENV=production
ENV PORT=3001
EXPOSE 3001

ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "apps/web/server.js"]
```

Also add `output: 'standalone'` to `apps/web/next.config.js`:

```js
const nextConfig = {
  output: 'standalone',          // ← add this line
  transpilePackages: ['@rxdesk/shared'],
  images: {
    domains: ['rxdesk-uploads.s3.ap-south-1.amazonaws.com'],
  },
};
```

Commit and push before deploying:

```bash
git add apps/web/Dockerfile apps/web/next.config.js
git commit -m "feat: add web Dockerfile for Coolify"
git push
```

### 5.2 – Create the service in Coolify

1. **New Resource** → **Application** → **GitHub** → `wintararaj-cmd/rxdesk`
2. Settings:
   - **Branch**: `master`
   - **Build Pack**: `Dockerfile`
   - **Dockerfile location**: `apps/web/Dockerfile`
   - **Port**: `3001`
   - **Name**: `rxdesk-web`

### 5.3 – Set environment variables (Web)

| Variable | Value |
|----------|-------|
| `NEXT_PUBLIC_API_URL` | `https://api.yourdomain.com/api/v1` |
| `NODE_ENV` | `production` |

> `NEXT_PUBLIC_API_URL` must be set as a **build argument (ARG)** too — the Dockerfile handles this via `ARG NEXT_PUBLIC_API_URL`.
> In Coolify, set it under **Build Arguments** as well as Environment Variables.

### 5.4 – Configure domain

1. **Domains** → Add `app.yourdomain.com`
2. Enable **HTTPS**

### 5.5 – Deploy

Click **Deploy**.

---

## Step 6 – DNS Records

In your domain registrar / Cloudflare, add:

| Type | Name | Value |
|------|------|-------|
| `A` | `api` | `<VPS IP>` |
| `A` | `app` | `<VPS IP>` |

If using Cloudflare proxy (orange cloud), set **SSL/TLS mode to Full (strict)**.

---

## Step 7 – Verify Deployment

```bash
# Backend health check
curl https://api.yourdomain.com/health

# Expected response:
# {"status":"ok","database":"connected","redis":"connected"}
```

Open `https://app.yourdomain.com` — you should see the RxDesk landing page.

---

## Post-Deployment: Set Admin Password

The admin user is created with phone `+91<ADMIN_PHONE>`. Log in via OTP the first time:

1. Go to `https://app.yourdomain.com/login`
2. Enter the admin phone number
3. Use **Login with OTP**
4. After OTP verification you'll be prompted to **set a password**

---

## Updating the Application

Every `git push` to `master` can trigger automatic redeployment.

To enable **auto-deploy**:
1. Coolify → `rxdesk-backend` → **General** → enable **Auto-deploy on push**
2. Same for `rxdesk-web`
3. In your GitHub repo: Settings → Webhooks → add the Coolify webhook URL

On every redeploy the entrypoint runs `prisma migrate deploy` and `seed` again — migrations and catalog updates are applied automatically with no manual steps.

---

## Troubleshooting

### Container fails to start

Check logs in Coolify → Application → **Logs** tab.

Common causes:
- Missing `DATABASE_URL` or `REDIS_URL` — verify environment variables
- DB not ready yet — Coolify starts services in parallel; re-deploy the backend after the DB is healthy
- Duplicate medicine names in existing DB — the migration handles this automatically

### `prisma migrate deploy` fails

- Check if PostgreSQL is accepting connections: Coolify → `rxdesk-postgres` → **Logs**
- Ensure `DATABASE_URL` uses the **internal** Docker hostname, not `localhost`

### OTP not received

- In production `NODE_ENV=production` is required, otherwise OTPs go through the mock path
- Check `FAST2SMS_API_KEY` is correct (Dashboard → Dev API → API Key)

### File uploads not working

- Verify S3/R2/B2 credentials and that the bucket exists with public-read or pre-signed URL policy
- For Cloudflare R2: set `S3_ENDPOINT=https://<account-id>.r2.cloudflarestorage.com` and `AWS_REGION=auto`

### Socket.IO connections dropping

- Coolify/Traefik: ensure **Keep-Alive** and **WebSocket upgrade** headers are forwarded
- Add to the backend service labels in Coolify (Advanced → Labels):
  ```
  traefik.http.middlewares.rxdesk-ws.headers.customRequestHeaders.X-Forwarded-Proto=https
  ```

---

## Environment Variable Reference (Full)

### Backend (`rxdesk-backend`)

```env
NODE_ENV=production
PORT=3000

DATABASE_URL=postgresql://rxdesk:<password>@rxdesk-postgres:5432/rxdesk_prod
REDIS_URL=redis://:<password>@rxdesk-redis:6379

JWT_ACCESS_SECRET=<64-char-random>
JWT_REFRESH_SECRET=<64-char-random>
JWT_ACCESS_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=30d

PRESCRIPTION_HMAC_SECRET=<32-char-random>

FRONTEND_URL=https://app.yourdomain.com
API_URL=https://api.yourdomain.com

ADMIN_PHONE=9999999999

AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
AWS_REGION=ap-south-1
S3_BUCKET_NAME=rxdesk-files
# S3_ENDPOINT=  (R2/B2 only)

FAST2SMS_API_KEY=

FIREBASE_SERVICE_ACCOUNT_JSON={"type":"service_account",...}

RAZORPAY_KEY_ID=rzp_live_xxxx
RAZORPAY_KEY_SECRET=
RAZORPAY_WEBHOOK_SECRET=

GOOGLE_MAPS_API_KEY=

OTP_EXPIRY_SECONDS=300
OTP_LENGTH=6
```

### Web (`rxdesk-web`)

```env
NODE_ENV=production
NEXT_PUBLIC_API_URL=https://api.yourdomain.com/api/v1
```

> Build argument (set in Coolify Build Arguments too):
> ```
> NEXT_PUBLIC_API_URL=https://api.yourdomain.com/api/v1
> ```
