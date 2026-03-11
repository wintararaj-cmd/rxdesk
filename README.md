# RxDesk

> **Digitize the entire workflow from doctor discovery to appointment booking, prescription writing, medicine billing, and pharmacy accounting — built for Bharat's local healthcare ecosystem.**

A three-sided healthcare platform connecting **Patients**, **Doctors**, and **Medical Shops** in India. Solves the small-town problem where doctors sit inside medical shops with no centralized system for schedules, appointments, prescriptions, or pharmacy billing.

## Platform Overview

| User | Core Capabilities |
|------|------------------|
| **Patient** | Search doctors by name/area/specialization · Book appointment · View digital prescriptions · Check medicine availability · Bill history |
| **Doctor** | Manage multi-shop chamber schedules · View daily patient queue · Write digital prescriptions · Access patient history |
| **Medical Shop** | Appointment dashboard · Receive prescriptions · Barcode/manual medicine billing · GST invoice · Inventory management · Supplier purchases · Full accounting (P&L, credit, cash register) |

## System Design Documents

| Document | Contents |
|----------|----------|
| [SYSTEM_DESIGN.md](./SYSTEM_DESIGN.md) | Full feature breakdown, MVP plan, UI/UX flow, pharmacy billing system design, accounting module, security & compliance, development timeline, revenue plan |
| [DATABASE_SCHEMA.md](./DATABASE_SCHEMA.md) | All PostgreSQL table definitions (24 tables) including billing and full accounting module |
| [API_ARCHITECTURE.md](./API_ARCHITECTURE.md) | REST API reference for all modules including `/accounting` (suppliers, purchases, expenses, P&L, GST reports) |
| [TECH_STACK.md](./TECH_STACK.md) | Technology decisions, folder structure, environment setup, deployment & cost estimates |

## Architecture

```
RxDesk/
├── apps/
│   ├── backend/       → Node 20 + Express + Prisma + PostgreSQL + Redis + Socket.io
│   ├── mobile/        → Expo SDK 51 + Expo Router v3 + NativeWind + Zustand + TanStack Query
│   └── web/           → Next.js 14 App Router (admin + shop web panel)
└── packages/
    └── shared/        → Shared TypeScript types
```

## Prerequisites

| Tool | Version |
|------|---------|
| Node.js | 20+ |
| npm | 10+ |
| Docker Desktop | latest |
| Expo CLI | `npm i -g expo-cli` |

## Quick Start

### 1 — Clone & install

```bash
git clone <repo-url> RxDesk
cd RxDesk
npm install
```

### 2 — Start infrastructure (PostgreSQL + Redis)

```bash
docker compose up -d
```

Default services:
- PostgreSQL → `localhost:5432`  (user: `rxdesk`, password: `rxdesk`, db: `rxdesk`)
- Redis       → `localhost:6379`

### 3 — Configure environment

**Backend**

```bash
cp apps/backend/.env.example apps/backend/.env
# Edit .env — set DATABASE_URL, REDIS_URL, JWT secrets, MSG91 key
```

**Mobile**

```bash
cp apps/mobile/.env.example apps/mobile/.env
# Edit EXPO_PUBLIC_API_URL if you are on a physical device
```

**Web**

```bash
cp apps/web/.env.example apps/web/.env.local
```

### 4 — Run database migrations

```bash
cd apps/backend
npx prisma migrate dev --name init
npx prisma generate
cd ../..
```

### 5 — Start all apps

```bash
# From the monorepo root — starts backend + web concurrently
npm run dev

# In a separate terminal — start the mobile app
cd apps/mobile
npx expo start
```

Or start individually:

```bash
# Backend only
npm run dev --workspace=apps/backend

# Web only
npm run dev --workspace=apps/web

# Mobile only
cd apps/mobile && npx expo start
```

## Key Environment Variables

### `apps/backend/.env`

```env
DATABASE_URL=postgresql://rxdesk:rxdesk@localhost:5432/rxdesk
REDIS_URL=redis://localhost:6379

JWT_ACCESS_SECRET=<32-char-random>
JWT_REFRESH_SECRET=<32-char-random>
JWT_ACCESS_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=30d

PRESCRIPTION_QR_SECRET=<32-char-random>

MSG91_API_KEY=<your-msg91-key>
MSG91_TEMPLATE_ID=<your-otp-template>

PORT=3000
NODE_ENV=development
```

### `apps/mobile/.env`

```env
EXPO_PUBLIC_API_URL=http://10.0.2.2:3000/api/v1   # Android emulator
# EXPO_PUBLIC_API_URL=http://localhost:3000/api/v1  # iOS simulator
# EXPO_PUBLIC_API_URL=http://192.168.x.x:3000/api/v1 # Physical device
```

## API Overview

Base URL: `http://localhost:3000/api/v1`

| Module | Prefix | Description |
|--------|--------|-------------|
| Auth | `/auth` | OTP login, token refresh |
| Patients | `/patients` | Patient profile & history |
| Doctors | `/doctors` | Doctor profile, search, chambers |
| Chambers | `/chambers` | Doctor ↔ Shop schedule management |
| Appointments | `/appointments` | Book, cancel, status updates, real-time queue |
| Prescriptions | `/prescriptions` | Issue, view, verify QR, PDF export |
| Bills | `/bills` | Auto-generate from prescription, GST invoice |
| Medicines | `/medicines` | Master DB search, cross-shop availability |
| Inventory | `/inventory` | Shop stock management, barcode lookup |
| Medical Shops | `/shops` | Shop registration, doctor linking |
| Notifications | `/notifications` | SMS/push history |
| Subscriptions | `/subscriptions` | Shop plans, Razorpay integration |
| Accounting | `/accounting` | Suppliers, purchases, expenses, credit customers, P&L, GST reports |
| Admin | `/admin` | Doctor/shop verification, platform analytics |

Full Swagger/OpenAPI docs are available at `http://localhost:3000/api-docs` when running in development mode.

## Auth Flow

1. `POST /auth/send-otp` → sends OTP via MSG91
2. `POST /auth/verify-otp` → returns `{ access_token, refresh_token, user }`
3. All subsequent requests: `Authorization: Bearer <access_token>`
4. `POST /auth/refresh` → returns new access token

## User Roles

| Role | Description |
|------|-------------|
| `patient` | Books appointments, receives prescriptions |
| `doctor` | Manages chambers & schedules, writes prescriptions |
| `shop_owner` | Manages medical shop, dispenses medicines, generates bills |
| `admin` | Verifies doctor & shop registrations, views analytics |

## Development Notes

- **Android emulator** accesses the host machine at `10.0.2.2` (not `localhost`)
- **Physical device** requires the mobile app to point to the host machine's LAN IP
- OTP is logged to the console in `development` mode (no MSG91 key required for local dev)
- Prisma Studio: `cd apps/backend && npx prisma studio`

## Docker Compose (infrastructure only)

```bash
# Start
docker compose up -d

# Stop
docker compose down

# Destroy volumes (reset DB)
docker compose down -v
```

## Scripts

From the monorepo root:

```bash
npm run dev          # start backend + web in parallel
npm run build        # build all apps
npm run lint         # lint all packages
npm run typecheck    # type-check all packages
```
