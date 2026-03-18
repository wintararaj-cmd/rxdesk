# 🛡️ Stalwart Mail Server

Stalwart is a modern, all-in-one mail server written in Rust. It includes SMTP, IMAP, and a Web Admin UI.

## 🚀 Deployment (Coolify)

1. Delete any old mail resource in Coolify.
2. Create a new **Docker Compose** resource named `mail-system`.
3. Copy the contents of `docker-compose.yml` into Coolify.
4. **Port Configuration**:
   - In the Coolify UI, for the `stalwart` service, the **Proxy Port** should be `8080`.
   - In the Coolify UI, for the `webmail` service, the **Proxy Port** should be `8888`.
5. Ensure you have a Docker network on your VPS named `coolify` (this is the default for Coolify).

## 🔑 Initial Setup

- **Management UI**: Go to `https://mail.rxdesk.in` (which proxies to internal port `8080`) and log in with user `admin` and the password from the logs. 

## 📧 Webmail Access (User Inbox)

I have added **SnappyMail** to the setup to provide your user inbox.
1. Map `webmail.rxdesk.in` to port **8888** (Proxy Port) in Coolify.
2. Go to `https://webmail.rxdesk.in` in your browser.
3. Log in with the email account you created (e.g., `support@rxdesk.in`).

## 🔧 Configuring SnappyMail (One-time Setup)

If you get a "cannot connect" error on the login screen, you need to tell SnappyMail where the server is:
1. Go to `http://192.99.167.217:8081/?admin`
2. **User**: `admin`
3. **Password**: `Admin123!`
4. Go to **Domains** -> **Add Domain**.
5. **Name**: `rxdesk.in`
6. **IMAP**:
   - Server: `stalwart`
   - Port: `143`
7. **SMTP**:
   - Server: `stalwart`
   - Port: `587`
8. Click **Add**. Now you can log in on the normal page!
