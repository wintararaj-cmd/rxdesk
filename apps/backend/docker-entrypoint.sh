#!/bin/sh
set -e

echo "▶ Running database migrations…"
npx prisma migrate deploy

echo "▶ Seeding database (medicine catalog + plans + admin)…"
node dist-seed/prisma/seed.js

echo "▶ Starting RxDesk backend…"
exec "$@"
