# RxDesk — Tech Stack & MVP Execution Guide

---

## 1. Full Tech Stack Decision Matrix

### Mobile Apps (Patient, Doctor, Shop Panel)

| Decision | Choice | Why |
|---|---|---|
| **Framework** | React Native (Expo SDK 50+) | Single codebase for Patient, Doctor, and Shop roles. Android-first (95% rural India uses Android). Expo simplifies builds & OTA updates. |
| **Language** | TypeScript | Type safety reduces runtime bugs, especially critical for prescription and billing logic |
| **State Management** | Zustand | Lightweight, no boilerplate. Better than Redux for a smaller team |
| **API Layer** | TanStack Query (React Query) | Caching, background refresh, offline stale data — essential for poor connectivity |
| **Local Database** | WatermelonDB | Offline-first, SQLite-based, syncs with server. Critical for areas with intermittent internet |
| **Navigation** | Expo Router (file-based) | Intuitive, type-safe deep linking |
| **UI Library** | NativeWind + custom components | Tailwind CSS for React Native — fast UI development |
| **Forms** | React Hook Form + Zod | Validated forms with TypeScript schema |
| **PDF View** | react-native-pdf | View generated PDF prescriptions/bills |
| **QR Scanner** | expo-barcode-scanner | Scan prescription QR at shop |
| **Maps** | react-native-maps (Google Maps) | Shops on map, nearby search |
| **Push Notifications** | expo-notifications + FCM | Firebase free push for Android |
| **Biometrics** | expo-local-authentication | Optional biometric unlock for returning users |
| **Barcode Scanner** | expo-barcode-scanner | Scan medicine barcodes (EAN-13) at billing counter |
| **Camera** | expo-camera | Fallback camera for receipt photo capture |
| **Thermal Print** | react-native-bluetooth-escpos-printer | Print bills/prescriptions to Bluetooth thermal printers |

---

### Web Panel (Medical Shop — Desktop)

| Decision | Choice | Why |
|---|---|---|
| **Framework** | Next.js 14 (App Router) | SSR + CSR hybrid, optimised for shop's desktop browser use |
| **Language** | TypeScript | Consistent with mobile |
| **Styling** | Tailwind CSS + shadcn/ui | Production-grade component library, fast development |
| **State** | Zustand + TanStack Query | Same pattern as mobile |
| **Real-time** | Socket.io client | WebSocket for live appointment queue |
| **PDF Print** | Browser print API + react-to-print | Print prescription/bill directly from browser |
| **Charts** | Recharts | Sales analytics dashboards |
| **Tables** | TanStack Table | Inventory management, appointment lists |
| **Barcode** | zxing-js/library | Browser-based barcode scanning (camera) for web billing |
| **Excel Export** | xlsx (SheetJS) | Export GST reports, inventory, P&L as Excel/CSV for CA |

---

### Backend API

| Decision | Choice | Why |
|---|---|---|
| **Runtime** | Node.js 20 LTS | Handles I/O-heavy (concurrent appointments, notifications) well |
| **Framework** | Express.js + TypeScript | Mature, battle-tested, large plugin ecosystem |
| **ORM** | Prisma ORM | Type-safe DB queries, migrations, schema-driven |
| **Validation** | Zod | Schema validation shared between frontend and backend |
| **Auth** | Custom JWT (jsonwebtoken) + Redis | Full control over token lifecycle |
| **File Uploads** | Multer + AWS S3 (via @aws-sdk/client-s3) | Prescription PDFs, doctor certificates |
| **PDF Generation** | Puppeteer (headless Chrome on server) | Pixel-perfect HTML-to-PDF prescription & GST bill |
| **QR Code** | qrcode + crypto (HMAC-SHA256) | Signed QR on each prescription |
| **SMS** | MSG91 (primary), Fast2SMS (fallback) | Best OTP delivery in India, DLT-registered |
| **WebSocket** | Socket.io | Real-time shop appointment queue |
| **Job Queue** | Bull (Redis-based) | SMS reminders, PDF generation, stock alerts run async |
| **Logging** | Winston + Morgan | Structured logs, HTTP request logging |
| **API Docs** | Swagger (swagger-jsdoc) | Auto-generated docs from JSDoc comments |

---

### Database & Storage

| Decision | Choice | Why |
|---|---|---|
| **Primary DB** | PostgreSQL 15 | ACID compliance for prescriptions & billing. JSONB for vitals. Spatial index for nearby shop search |
| **Cache & Queue** | Redis 7 | JWT refresh tokens, Bull job queue, WebSocket room state, rate limiting |
| **File Storage** | AWS S3 (or Cloudflare R2 for cost) | Prescription PDFs, certificates. Pre-signed URLs for secure access |
| **Search** | PostgreSQL Full-Text Search | Sufficient for doctor/medicine search in MVP. Can migrate to Meilisearch at scale |
| **Backups** | AWS RDS automated backups | Point-in-time recovery, 30-day retention |

---

### Infrastructure & DevOps

| Decision | Choice | Why |
|---|---|---|
| **API Hosting** | AWS EC2 (t3.medium, 2 vCPU, 4GB) or Railway.app | EC2 for production scale, Railway for early-stage low cost |
| **Database** | AWS RDS PostgreSQL (db.t3.micro → scale up) | Managed, auto-backup, failover |
| **Redis** | AWS ElastiCache or Upstash | Managed Redis, no ops overhead |
| **CDN** | CloudFlare | Free DDoS protection, CDN for static assets, DNS |
| **Container** | Docker + Docker Compose | Consistent dev/prod environments |
| **CI/CD** | GitHub Actions | Auto-test on PR, auto-deploy on merge to main |
| **Monitoring** | Sentry (error tracking) + UptimeRobot | Real-time error alerts, uptime monitoring |
| **App Distribution** | Expo EAS Build (Android APK/AAB) | OTA updates without Play Store review cycle |
| **Play Store** | Google Play Store (Android) | Primary distribution channel |

---

### Third-Party Services

| Service | Provider | Purpose |
|---|---|---|
| **SMS / OTP** | MSG91 | OTP login, appointment reminders. DLT-compliant |
| **Payments** | Razorpay | Shop subscription (UPI, cards, netbanking), consultation fee |
| **Push Notifications** | Firebase (FCM) | Free Android push, high delivery rate |
| **Maps & Geocoding** | Google Maps Platform | Shop location, address autocomplete, nearby search |
| **WhatsApp** | WhatsApp Business API (via 360dialog) | Phase 2 — prescription sharing on WhatsApp |
| **Email** | SendGrid / AWS SES | Admin emails, invoice receipts (low volume) |

---

## 2. Development Environment Setup

### Prerequisites

```bash
Node.js 20 LTS
PostgreSQL 15
Redis 7
Docker Desktop
Git
Expo CLI (npm install -g expo-cli)
EAS CLI (npm install -g eas-cli)
```

### Monorepo Structure

```
rxdesk/
├── packages/
│   └── shared/           # shared TypeScript types, Zod schemas, constants
├── apps/
│   ├── backend/          # Express.js API
│   ├── mobile/           # React Native (Expo) — all 3 roles
│   └── web/              # Next.js — shop web panel
├── docker-compose.yml    # local PostgreSQL + Redis
├── .env.example
└── package.json          # Turborepo root
```

### Turborepo Setup

```bash
npx create-turbo@latest rxdesk
cd rxdesk

# Install workspace packages
npm install --workspace=apps/backend
npm install --workspace=apps/mobile
npm install --workspace=apps/web
```

### docker-compose.yml (Local Dev)

```yaml
version: '3.8'
services:
  postgres:
    image: postgres:15
    environment:
      POSTGRES_DB: rxdesk_dev
      POSTGRES_USER: rxdesk
      POSTGRES_PASSWORD: secret
    ports:
      - "5432:5432"
    volumes:
      - pgdata:/var/lib/postgresql/data

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"

volumes:
  pgdata:
```

---

## 3. Backend Folder Structure

```
apps/backend/
├── src/
│   ├── app.ts                  # Express app setup
│   ├── server.ts               # Entry point, socket.io setup
│   ├── config/
│   │   ├── database.ts         # Prisma client
│   │   ├── redis.ts            # Redis client
│   │   ├── s3.ts               # AWS S3 client
│   │   └── env.ts              # Zod-validated environment variables
│   ├── middleware/
│   │   ├── auth.ts             # JWT verification
│   │   ├── rbac.ts             # Role-based access control
│   │   ├── rateLimit.ts        # Redis-backed rate limiting
│   │   ├── errorHandler.ts     # Global error handler
│   │   └── requestLogger.ts    # Morgan + Winston
│   ├── modules/
│   │   ├── auth/
│   │   │   ├── auth.routes.ts
│   │   │   ├── auth.controller.ts
│   │   │   ├── auth.service.ts
│   │   │   └── auth.schema.ts   # Zod validation schemas
│   │   ├── patients/
│   │   ├── doctors/
│   │   ├── shops/
│   │   ├── chambers/
│   │   ├── appointments/
│   │   ├── prescriptions/
│   │   ├── bills/
│   │   ├── medicines/
│   │   ├── inventory/
│   │   ├── notifications/
│   │   ├── subscriptions/
│   │   ├── accounting/         # suppliers, purchases, expenses, credit, P&L reports
│   │   └── admin/
│   ├── jobs/                   # Bull queue workers
│   │   ├── smsReminder.job.ts
│   │   ├── pdfGeneration.job.ts
│   │   ├── stockAlert.job.ts
│   │   └── creditOverdueAlert.job.ts  # Daily: flag overdue credit customers
│   ├── utils/
│   │   ├── pdfGenerator.ts     # Puppeteer HTML → PDF (prescriptions + GST invoices)
│   │   ├── excelExport.ts      # SheetJS — P&L, GST, inventory export
│   │   ├── gstCalculator.ts    # GST slab lookup, CGST/SGST/IGST split helper
│   │   ├── smsService.ts       # MSG91 wrapper
│   │   ├── qrSigner.ts        # HMAC QR code generator
│   │   ├── pagination.ts
│   │   └── geoUtils.ts        # Haversine distance calculation
│   └── types/
│       └── express.d.ts        # req.user type augmentation
├── prisma/
│   ├── schema.prisma
│   └── migrations/
├── tests/
│   ├── unit/
│   └── integration/
├── .env.example
├── Dockerfile
└── package.json
```

---

## 4. Mobile App Folder Structure

```
apps/mobile/
├── app/
│   ├── (auth)/               # Login, OTP screens
│   ├── (patient)/            # Patient tab layout
│   │   ├── home.tsx
│   │   ├── search.tsx
│   │   ├── appointments.tsx
│   │   ├── prescriptions.tsx
│   │   └── profile.tsx
│   ├── (doctor)/             # Doctor tab layout
│   │   ├── dashboard.tsx
│   │   ├── appointments.tsx
│   │   ├── prescriptions/
│   │   │   └── write.tsx
│   │   ├── chambers.tsx
│   │   └── patients.tsx
│   └── (shop)/               # Shop tab layout
│       ├── dashboard.tsx
│       ├── appointments.tsx
│       ├── prescriptions.tsx
│       ├── billing.tsx
│       ├── inventory.tsx
│       ├── accounting/
│       │   ├── index.tsx        # P&L overview
│       │   ├── expenses.tsx     # Log & list expenses
│       │   ├── purchases.tsx    # Supplier purchases
│       │   ├── suppliers.tsx    # Supplier list + ledger
│       │   ├── credit.tsx       # Credit customers book
│       │   └── cash-register.tsx # End-of-day closing
│       └── reports.tsx
├── components/
│   ├── ui/                   # Button, Input, Card, Badge, etc.
│   ├── patient/              # PatientCard, AppointmentSlot, etc.
│   ├── doctor/               # PrescriptionForm, MedicineSearch, etc.
│   └── shop/                 # QueueCard, InventoryRow, BillPreview, etc.
├── store/
│   ├── authStore.ts          # User session, role
│   ├── appointmentStore.ts
│   └── notificationStore.ts
├── api/
│   ├── client.ts             # Axios instance with auth interceptor
│   ├── auth.api.ts
│   ├── appointments.api.ts
│   ├── prescriptions.api.ts
│   └── ...
├── hooks/
│   ├── useAppointments.ts    # TanStack Query hooks
│   └── useOfflineSync.ts
└── utils/
    ├── formatting.ts         # Date, currency, phone formatting
    └── permissions.ts        # Camera, location permissions
```

---

## 5. Environment Variables

```bash
# apps/backend/.env

# Server
PORT=3000
NODE_ENV=development

# Database
DATABASE_URL="postgresql://rxdesk:secret@localhost:5432/rxdesk_dev"

# Redis
REDIS_URL="redis://localhost:6379"

# JWT
JWT_ACCESS_SECRET="your-access-secret-min-32-chars"
JWT_REFRESH_SECRET="your-refresh-secret-min-32-chars"

# AWS S3
AWS_ACCESS_KEY_ID="..."
AWS_SECRET_ACCESS_KEY="..."
AWS_REGION="ap-south-1"
S3_BUCKET_NAME="rxdesk-files"

# SMS - MSG91
MSG91_AUTH_KEY="..."
MSG91_TEMPLATE_ID_OTP="..."
MSG91_TEMPLATE_ID_REMINDER="..."
MSG91_SENDER_ID="DOCNER"

# Firebase
FIREBASE_SERVICE_ACCOUNT_JSON='{"type":"service_account",...}'

# Razorpay
RAZORPAY_KEY_ID="rzp_live_..."
RAZORPAY_KEY_SECRET="..."
RAZORPAY_WEBHOOK_SECRET="..."

# Google Maps
GOOGLE_MAPS_API_KEY="..."

# Prescription QR
PRESCRIPTION_HMAC_SECRET="your-prescription-signing-secret"

# App URLs
FRONTEND_URL="https://shop.rxdesk.in"
API_URL="https://api.rxdesk.in"
```

---

## 6. Key Implementation Notes

### Offline-First Appointments (Mobile)

```typescript
// WatermelonDB sync strategy
// Local SQLite mirrors: appointments, prescriptions (read-only for patient)
// When online: pull server changes → push local pending actions
// When offline: queue actions, show last-known state

// Bull job for SMS reminders (24hr + 1hr before appointment)
appointmentQueue.add('send-reminder', { appointmentId }, {
  delay: msUntilOneDayBefore,
  jobId: `reminder-24h-${appointmentId}`
});
```

### Prescription QR Signing

```typescript
import crypto from 'crypto';

function generatePrescriptionQR(prescriptionId: string, issuedAt: Date): string {
  const payload = `${prescriptionId}:${issuedAt.toISOString()}`;
  const hmac = crypto.createHmac('sha256', process.env.PRESCRIPTION_HMAC_SECRET!)
                     .update(payload)
                     .digest('hex');
  return `${payload}:${hmac}`;
}

function verifyPrescriptionQR(qrContent: string): boolean {
  const parts = qrContent.split(':');
  const [id, ...dateParts] = parts;
  const signature = parts[parts.length - 1];
  const payload = parts.slice(0, -1).join(':');
  const expected = crypto.createHmac('sha256', process.env.PRESCRIPTION_HMAC_SECRET!)
                         .update(payload)
                         .digest('hex');
  return crypto.timingSafeEqual(
    Buffer.from(signature, 'hex'),
    Buffer.from(expected, 'hex')
  );
}
```

### Slot Generation Algorithm

```typescript
// Generate all slots for a given chamber + date
function generateSlots(schedule: ChamberSchedule, bookedSlots: Appointment[]) {
  const slots = [];
  let current = parseTime(schedule.start_time);
  const end = parseTime(schedule.end_time);
  let token = 1;

  while (current < end && slots.length < schedule.max_patients) {
    const slotEnd = addMinutes(current, schedule.slot_duration);
    const isBooked = bookedSlots.some(b => b.slot_start_time === formatTime(current));
    slots.push({
      start: formatTime(current),
      end: formatTime(slotEnd),
      token: token++,
      status: isBooked ? 'booked' : 'available'
    });
    current = slotEnd;
  }
  return slots;
}
```

---

## 7. Testing Strategy

| Layer | Tool | Coverage Target |
|---|---|---|
| Unit Tests | Jest | Auth, billing calculations, slot generation, QR signing |
| Integration Tests | Supertest + Jest | All API endpoints with test DB |
| E2E Mobile Tests | Detox | Critical flows: book appointment, write prescription, generate bill |
| Load Testing | k6 | 500 concurrent shop appointments during peak |
| Security Testing | OWASP ZAP (manual quarterly) | SQL injection, auth bypass, prescription forgery |

---

## 8. Play Store Deployment

```bash
# Build Android AAB for Play Store
cd apps/mobile
eas build --platform android --profile production

# Submit to Play Store
eas submit --platform android

# OTA update (no review needed for JS-only changes)
eas update --branch production --message "Fix appointment booking bug"
```

**App Names on Play Store:**
- RxDesk – Find Doctors Near You (Patient app)
- RxDesk Doctor (Doctor app)
- RxDesk Shop (Medical Shop panel)

All three as separate apps under one Play Console developer account.

---

## 9. Cost Estimation (Monthly — at MVP scale, ~100 shops)

| Service | Cost/Month |
|---|---|
| AWS EC2 t3.medium (API server) | ~$35 |
| AWS RDS PostgreSQL db.t3.micro | ~$25 |
| AWS S3 (PDFs, 10GB) | ~$2 |
| AWS ElastiCache (Redis t3.micro) | ~$15 |
| CloudFlare (Free tier) | $0 |
| MSG91 SMS (2,000 SMS) | ~₹600 |
| Firebase FCM | Free |
| Google Maps API (10K requests) | ~$5 |
| Razorpay (2% per subscription) | Variable |
| Expo EAS Build (Production plan) | $99/month |
| **Total Infrastructure** | **~₹15,000–₹18,000/month** |

At 100 shops on Standard plan (₹999), monthly revenue = ₹99,900. Infrastructure is ~18% of revenue — healthy for SaaS.
