# 🛡️ Stalwart Mail Server

Stalwart is a modern, all-in-one mail server written in Rust. It includes SMTP, IMAP, and a Web Admin UI.

## 🚀 Deployment

1. Delete the old mail resource in Coolify.
2. Create a new **Docker Compose** resource.
3. Copy the contents of `docker-compose.yml` into Coolify.
4. Point `mail.rxdesk.in` to port `8082` in the Coolify domain settings.

## 🔑 Initial Setup

- After starting, check the **Coolify Logs** for the container.
- You will see a message like: `ADMIN PASSWORD: [random_string]`.
- Go to `https://mail.rxdesk.in` (assuming you set up the domain) or `http://[IP]:8080` and log in with user `admin` and that password.
