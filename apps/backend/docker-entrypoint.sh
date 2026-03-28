#!/bin/sh
set -e

echo "▶ Synchronizing database schema…"
npx prisma db push --accept-data-loss

echo "▶ Seeding database (medicine catalog + plans + admin)…"
node dist-seed/prisma/seed.js

echo "▶ Starting RxDesk backend…"
exec "$@"
