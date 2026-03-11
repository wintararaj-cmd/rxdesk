import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';

import { env } from './config/env';
import logger from './utils/logger';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';

// ─── Route Imports ────────────────────────────
import authRoutes from './modules/auth/auth.routes';
import patientRoutes from './modules/patients/patient.routes';
import doctorRoutes from './modules/doctors/doctor.routes';
import shopRoutes from './modules/shops/shop.routes';
import chamberRoutes from './modules/chambers/chamber.routes';
import appointmentRoutes from './modules/appointments/appointment.routes';
import prescriptionRoutes from './modules/prescriptions/prescription.routes';
import billRoutes from './modules/bills/bill.routes';
import medicineRoutes from './modules/medicines/medicine.routes';
import inventoryRoutes from './modules/inventory/inventory.routes';
import notificationRoutes from './modules/notifications/notification.routes';
import subscriptionRoutes from './modules/subscriptions/subscription.routes';
import adminRoutes from './modules/admin/admin.routes';
import bannerRoutes from './modules/banners/banners.routes';
import accountingRoutes from './modules/accounting/accounting.routes';
import path from 'path';


const app = express();

// ─── Security ────────────────────────────────
app.use(helmet());
app.use(
  cors({
    origin: [
      env.FRONTEND_URL,
      ...(env.FRONTEND_URL_LAN ? [env.FRONTEND_URL_LAN] : []),
      'http://localhost:3001',
      'http://localhost:3002',
      'http://localhost:19006',
      /^http:\/\/192\.168\.\d{1,3}\.\d{1,3}:\d+$/,
    ],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  })
);

// ─── Body Parsing ────────────────────────────
// Capture raw body buffer so webhook handlers can verify HMAC signatures
app.use(
  express.json({
    limit: '10mb',
    verify: (_req, _res, buf) => {
      (_req as any).rawBody = buf;
    },
  })
);
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(compression());

// ─── Static Files ─────────────────────────────
// Serve the uploads directory locally for dev
app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));


// ─── Logging ────────────────────────────────
app.use(
  morgan(env.NODE_ENV === 'production' ? 'combined' : 'dev', {
    stream: { write: (msg) => logger.http(msg.trim()) },
  })
);

// ─── Health Check ────────────────────────────
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString(), env: env.NODE_ENV });
});

// ─── API Routes ──────────────────────────────
const API = '/api/v1';
app.use(`${API}/auth`, authRoutes);
app.use(`${API}/patients`, patientRoutes);
app.use(`${API}/doctors`, doctorRoutes);
app.use(`${API}/shops`, shopRoutes);
app.use(`${API}/chambers`, chamberRoutes);
app.use(`${API}/appointments`, appointmentRoutes);
app.use(`${API}/prescriptions`, prescriptionRoutes);
app.use(`${API}/bills`, billRoutes);
app.use(`${API}/medicines`, medicineRoutes);
app.use(`${API}/inventory`, inventoryRoutes);
app.use(`${API}/notifications`, notificationRoutes);
app.use(`${API}/subscriptions`, subscriptionRoutes);
app.use(`${API}/admin`, adminRoutes);
app.use(`${API}/banners`, bannerRoutes);
app.use(`${API}/accounting`, accountingRoutes);


// ─── Error Handling ──────────────────────────
app.use(notFoundHandler);
app.use(errorHandler);

export default app;
