// PM2 Ecosystem – DocNear (RxDesk)
// Usage:
//   pm2 start ecosystem.config.js --env production
//   pm2 save
//   pm2 startup   ← run the printed command to auto-start on reboot

module.exports = {
  apps: [
    // ── Backend (Express + Socket.IO) ────────────────────────────────────────
    {
      name: 'rxdesk-backend',
      script: 'dist/server.js',
      cwd: '/var/www/rxdesk/apps/backend',
      instances: 'max',         // cluster mode – 1 worker per CPU core
      exec_mode: 'cluster',
      // NOTE: Socket.IO sticky sessions require a sticky load balancer.
      // If you don't have one, set instances to 1 or use the @socket.io/sticky adapter.
      // instances: 1,

      // ── Env: values are overridden by the .env file loaded by dotenv ────────
      env_production: {
        NODE_ENV: 'production',
        PORT: 3000,
      },

      // ── Restart / memory policy ──────────────────────────────────────────────
      max_memory_restart: '512M',
      restart_delay: 3000,
      max_restarts: 10,

      // ── Logging ──────────────────────────────────────────────────────────────
      out_file: '/var/log/rxdesk/backend-out.log',
      error_file: '/var/log/rxdesk/backend-err.log',
      merge_logs: true,
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',

      // ── Graceful shutdown (matches server.ts 15 s forced timeout) ────────────
      kill_timeout: 16000,
      wait_ready: true,
      listen_timeout: 10000,
    },

    // ── Web App (Next.js) ────────────────────────────────────────────────────
    {
      name: 'rxdesk-web',
      script: 'node_modules/.bin/next',
      args: 'start -p 3001',
      cwd: '/var/www/rxdesk/apps/web',
      instances: 1,             // Next.js has its own internal concurrency
      exec_mode: 'fork',

      env_production: {
        NODE_ENV: 'production',
        PORT: 3001,
      },

      max_memory_restart: '768M',
      restart_delay: 3000,
      max_restarts: 10,

      out_file: '/var/log/rxdesk/web-out.log',
      error_file: '/var/log/rxdesk/web-err.log',
      merge_logs: true,
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',

      kill_timeout: 10000,
      wait_ready: true,
      listen_timeout: 30000,    // Next.js can be slow to boot cold
    },
  ],
};
