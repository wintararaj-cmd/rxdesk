# 📧 Mail Server Infrastructure (Maddy + Alps)

This guide explains how to manage your new mail server infrastructure using **Maddy** (Mail Server) and **Alps** (Webmail).

## 🚀 Services Overview

- **Maddy**: A composable all-in-one mail server (SMTP + IMAP).
- **Alps**: A simple, stateless webmail client.

## 📁 File Structure

The mail infrastructure is located in `deploy/mail/`:
- `docker-compose.yml`: Orchestrates both services.
- `maddy/maddy.conf`: Core mail server configuration.
- `.env.example`: Template for environment variables.

---

## 🛠️ Setup Instructions

### 1. Configure Environment
Copy `.env.example` to `.env` and update the hostname and domain:
```bash
cp deploy/mail/.env.example deploy/mail/.env
# Edit deploy/mail/.env with your domain
```

### 2. TLS Certificates (Optional but Recommended)
For production, place your SSL/TLS certificates in `deploy/mail/maddy/data/tls/`:
- `fullchain.pem`
- `privkey.pem`

### 3. Start the Services
```bash
cd deploy/mail
docker compose up -d
```

---

## 🚀 Deployment Options

### Option A: Manual Docker Compose (on the VPS)
1. SSH into your VPS.
2. `cd deploy/mail`
3. `cp .env.example .env` (Update it with your domain!)
4. `docker compose up -d`

### Option B: Deploy via Coolify (Recommended)
Since you are already using Coolify, you can deploy this as a **Service** or **Docker Compose** resource:

1. In Coolify, create a **New Resource** → **Service** → **Docker Compose**.
2. Name it `mail-system`.
3. Copy the contents of `deploy/mail/docker-compose.yml` into the configuration.
4. Set the **Environment Variables** in Coolify matching `deploy/mail/.env.example`.
5. Coolify/Traefik will handle the domain mapping automatically:
   - For webmail, set the domain in Coolify to `mail.yourdomain.com`.
   - Point the DNS (A record) for `mail` to your VPS IP.

---

## 👤 User Management

Maddy uses a CLI tool called `maddyctl` for management. Since it's running in Docker, you should use `docker exec`.

### Create a new user
Replace `user@yourdomain.com` with the actual email address.

1. **Create credentials (password):**
   ```bash
   docker exec -it mail_maddy maddyctl -c /data/maddy.conf creds create user@yourdomain.com
   ```
2. **Create IMAP storage:**
   ```bash
   docker exec -it mail_maddy maddyctl -c /data/maddy.conf imap-accts create user@yourdomain.com
   ```

### List Users
```bash
docker exec -it mail_maddy maddyctl -c /data/maddy.conf imap-accts list
```

---

## 🌐 DNS Requirements

To ensure mail delivery works correctly, you need to set up the following DNS records:

| Type  | Name | Value | Purpose |
| :--- | :--- | :--- | :--- |
| **A** | `mx` | `YOUR_SERVER_IP` | Mail server address |
| **MX** | `@` | `mx.yourdomain.com` | Primary mail exchanger |
| **TXT** | `@` | `v=spf1 mx ~all` | SPF (Sender Policy Framework) |
| **TXT** | `_dmarc` | `v=DMARC1; p=none` | DMARC record |

---

## 🖥️ Accessing Webmail
Once started, Alps will be available at:
`http://YOUR_SERVER_IP:8000` (or the port defined in `.env`).

Simply log in with the email and password you created via `maddyctl`.
