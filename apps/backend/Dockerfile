# ── Stage 1: Builder ──────────────────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

# Install dependencies for native modules
RUN apk add --no-cache python3 make g++

# Copy workspace manifests
COPY package.json turbo.json ./
COPY packages/shared/package.json ./packages/shared/
COPY apps/backend/package.json ./apps/backend/

# Install all deps (including dev)
RUN npm install --frozen-lockfile

# Copy source
COPY packages/shared/ ./packages/shared/
COPY apps/backend/ ./apps/backend/

# Build shared package first
WORKDIR /app/packages/shared
RUN npm run build

# Generate Prisma client
WORKDIR /app/apps/backend
RUN npx prisma generate

# Build TypeScript (app)
RUN npm run build

# Build seed scripts separately (includes prisma/ folder)
RUN npx tsc -p tsconfig.seed.json


# ── Stage 2: Production ───────────────────────────────────────────────────────
FROM node:20-alpine AS production

RUN apk add --no-cache dumb-init

WORKDIR /app

# Copy workspace root for workspaces resolution
COPY package.json turbo.json ./

# Copy shared package dist
COPY --from=builder /app/packages/shared/dist/ ./packages/shared/dist/
COPY packages/shared/package.json ./packages/shared/

# Copy backend production deps + dist
COPY apps/backend/package.json ./apps/backend/
RUN npm install --omit=dev --frozen-lockfile

COPY --from=builder /app/apps/backend/dist/ ./apps/backend/dist/
COPY --from=builder /app/apps/backend/dist-seed/ ./apps/backend/dist-seed/
COPY --from=builder /app/apps/backend/node_modules/.prisma/ ./apps/backend/node_modules/.prisma/
COPY apps/backend/prisma/ ./apps/backend/prisma/
COPY apps/backend/docker-entrypoint.sh ./apps/backend/docker-entrypoint.sh
RUN chmod +x ./apps/backend/docker-entrypoint.sh

ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

WORKDIR /app/apps/backend

# Use dumb-init to handle PID 1 signals correctly
ENTRYPOINT ["dumb-init", "--", "/app/apps/backend/docker-entrypoint.sh"]
CMD ["node", "dist/server.js"]
