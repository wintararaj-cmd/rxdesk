# 🛡️ Stalwart Mail Server

Stalwart is a modern, all-in-one mail server written in Rust. It includes SMTP, IMAP, and a Web Admin UI.

## 🚀 Deployment

1. Delete the old mail resource in Coolify.
2. Create a new **Docker Compose** resource.
3. Copy the contents of `docker-compose.yml` into Coolify.
4. Point `mail.rxdesk.in` to port `8082` in the Coolify domain settings.

## 🔑 Initial Setup

- Go to `https://mail.rxdesk.in` (mapped to **8082**) and log in with user `admin` and the password from the logs. This is the **Management UI**.

## 📧 Webmail Access (User Inbox)

I have added **SnappyMail** to the setup to provide your user inbox.
1. Map a domain (like `webmail.rxdesk.in`) to port **8081** in Coolify.
2. Go to that URL in your browser.
3. Log in with the email account you created (e.g., `support@rxdesk.in`).
4. **Login Configuration**:
   - **User**: `support@rxdesk.in`
   - **Password**: The password you set in the Stalwart UI.
   - **IMAP Host**: `stalwart` (Port 143)
   - **SMTP Host**: `stalwart` (Port 587)
