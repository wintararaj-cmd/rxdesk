import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import * as SecureStore from 'expo-secure-store';
import { getRefreshToken, useAuthStore } from '../store/authStore';

const BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://10.0.2.2:3000/api/v1';

export const apiClient = axios.create({
  baseURL: BASE_URL,
  timeout: 15_000,
  headers: { 'Content-Type': 'application/json' },
});

// ── Request interceptor: attach access token ──────────────────────────────────
apiClient.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = useAuthStore.getState().accessToken;
  if (token) config.headers.set('Authorization', `Bearer ${token}`);
  return config;
});

// ── Response interceptor: silent refresh on 401 ───────────────────────────────
let isRefreshing = false;
let failedQueue: { resolve: (v: unknown) => void; reject: (e: unknown) => void }[] = [];

const processQueue = (error: unknown, token: string | null = null) => {
  failedQueue.forEach(({ resolve, reject }) => (error ? reject(error) : resolve(token)));
  failedQueue = [];
};

apiClient.interceptors.response.use(
  (res) => res,
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

    if (error.response?.status === 401 && !originalRequest._retry) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        }).then((token) => {
          originalRequest.headers.set('Authorization', `Bearer ${token}`);
          return apiClient(originalRequest);
        });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const refreshToken = await getRefreshToken();
        if (!refreshToken) throw new Error('No refresh token');

        const { data } = await axios.post(`${BASE_URL}/auth/token/refresh`, { refresh_token: refreshToken });
        const { access_token, refresh_token: newRefresh } = data.data;

        await useAuthStore.getState().setTokens(access_token, newRefresh);
        processQueue(null, access_token);
        originalRequest.headers.set('Authorization', `Bearer ${access_token}`);
        return apiClient(originalRequest);
      } catch (refreshError) {
        processQueue(refreshError, null);
        await useAuthStore.getState().clearAuth();
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);

// ── Typed API helpers ─────────────────────────────────────────────────────────

export const authApi = {
  sendOtp: (phone: string) => apiClient.post('/auth/otp/send', { phone }),
  verifyOtp: (phone: string, otp: string, ref: string) =>
    apiClient.post('/auth/otp/verify', { phone, otp, otp_ref: ref }),
  loginWithPassword: (phone: string, password: string) =>
    apiClient.post('/auth/login', { phone, password }),
  setPassword: (password: string, confirm_password: string) =>
    apiClient.post('/auth/password/set', { password, confirm_password }),
  resetPassword: (phone: string, otp_ref: string, password: string, confirm_password: string) =>
    apiClient.post('/auth/password/reset', { phone, otp_ref, password, confirm_password }),
  updateRole: (role: string) => apiClient.patch('/auth/role', { role }),
  logout: () => apiClient.post('/auth/logout'),
  getMe: () => apiClient.get('/auth/me'),
};

export const patientApi = {
  getProfile: () => apiClient.get('/patients/me'),
  updateProfile: (data: Record<string, unknown>) => apiClient.put('/patients/profile', data),
  getAppointments: (params?: object) => apiClient.get('/patients/me/appointments', { params }),
  getPrescriptions: (params?: object) => apiClient.get('/prescriptions/my', { params }),
};

export const doctorApi = {
  search: (params: object) => apiClient.get('/doctors/search', { params }),
  getProfile: (id: string) => apiClient.get(`/doctors/${id}`),
  getStats: () => apiClient.get('/doctors/me/stats'),
  createProfile: (data: object) => apiClient.post('/doctors', data),
  updateProfile: (data: object) => apiClient.put('/doctors/me', data),
};

export const chamberApi = {
  getMyChambers: () => apiClient.get('/chambers/mine'),
  create: (data: object) => apiClient.post('/chambers', data),
  approve: (id: string) => apiClient.post(`/chambers/${id}/approve`),
  shopAddDoctor: (data: object) => apiClient.post('/chambers/shop-add-doctor', data),
  getShopChambers: (status?: string) =>
    apiClient.get('/chambers/shop-mine', { params: status ? { status } : undefined }),
  getAvailableSlots: (chamberId: string, date: string) =>
    apiClient.get(`/chambers/${chamberId}/slots`, { params: { date } }),
  setSchedule: (chamberId: string, schedule: unknown[]) =>
    apiClient.put(`/chambers/${chamberId}/schedule`, schedule),
  markLeave: (chamberId: string, data: object) =>
    apiClient.post(`/chambers/${chamberId}/leave`, data),
};

export const appointmentApi = {
  book: (data: object) => apiClient.post('/appointments', data),
  bookWalkIn: (data: object) => apiClient.post('/appointments/walk-in', data),
  getById: (id: string) => apiClient.get(`/appointments/${id}`),
  updateStatus: (id: string, status: string) =>
    apiClient.patch(`/appointments/${id}/status`, { status }),
  getTodayForDoctor: (chamberId: string) =>
    apiClient.get('/appointments/today', { params: { chamber_id: chamberId } }),
  getDoctorHistory: (params?: { chamber_id?: string; status?: string; page?: number; limit?: number }) =>
    apiClient.get('/appointments/history', { params }),
};

export const prescriptionApi = {
  create: (data: object) => apiClient.post('/prescriptions', data),
  getById: (id: string) => apiClient.get(`/prescriptions/${id}`),
  verifyQR: (qrContent: string) => apiClient.post('/prescriptions/verify', { qr_content: qrContent }),
  getPdf: (id: string) => apiClient.get(`/prescriptions/${id}/pdf`),
};

export const shopApi = {
  register: (data: object) => apiClient.post('/shops', data),
  search: (params: object) => apiClient.get('/shops/search', { params }),
  getMyShop: () => apiClient.get('/shops/me'),
  getDashboard: () => apiClient.get('/shops/me/dashboard'),
  updateProfile: (data: object) => apiClient.put('/shops/me', data),
  getNearby: (params: object) => apiClient.get('/shops/nearby', { params }),
  getTodayAppointments: (chamberId?: string) =>
    apiClient.get('/appointments/today', { params: chamberId ? { chamber_id: chamberId } : undefined }),
};

export const inventoryApi = {
  list: (params?: object) => apiClient.get('/inventory', { params }),
  add: (data: object) => apiClient.post('/inventory', data),
  update: (id: string, data: object) => apiClient.put(`/inventory/${id}`, data),
  remove: (id: string) => apiClient.delete(`/inventory/${id}`),
  lowStock: () => apiClient.get('/inventory/low-stock'),
};

export const billApi = {
  generate: (prescriptionId: string, data?: object) =>
    apiClient.post(`/bills/from-prescription/${prescriptionId}`, data ?? {}),
  getById: (id: string) => apiClient.get(`/bills/${id}`),
  markPaid: (id: string, method: string) =>
    apiClient.patch(`/bills/${id}/pay`, { payment_method: method }),
};

export const medicineApi = {
  search: (query: string) => apiClient.get('/medicines/search', { params: { q: query } }),
  availability: (name: string, pinCode: string) =>
    apiClient.get('/medicines/availability', { params: { medicine: name, pin_code: pinCode } }),
};

export const notificationApi = {
  list: () => apiClient.get('/notifications'),
  markRead: (id: string) => apiClient.patch(`/notifications/${id}/read`),
  markAllRead: () => apiClient.patch('/notifications/read-all'),
  registerPushToken: (pushToken: string) =>
    apiClient.patch('/auth/push-token', { push_token: pushToken }),
};

export const subscriptionApi = {
  getCurrent: () => apiClient.get('/subscriptions/current'),
  getPlans: () => apiClient.get('/subscriptions/plans'),
  subscribe: (planId: string) => apiClient.post('/subscriptions/subscribe', { plan_id: planId }),
};

export const accountingApi = {
  // Suppliers
  listSuppliers: (params?: object) => apiClient.get('/accounting/suppliers', { params }),
  createSupplier: (data: object) => apiClient.post('/accounting/suppliers', data),
  updateSupplier: (id: string, data: object) => apiClient.put(`/accounting/suppliers/${id}`, data),
  deactivateSupplier: (id: string) => apiClient.delete(`/accounting/suppliers/${id}`),
  getSupplierLedger: (id: string) => apiClient.get(`/accounting/suppliers/${id}/ledger`),

  // Purchases
  listPurchases: (params?: object) => apiClient.get('/accounting/purchases', { params }),
  createPurchase: (data: object) => apiClient.post('/accounting/purchases', data),
  getPurchaseById: (id: string) => apiClient.get(`/accounting/purchases/${id}`),
  recordSupplierPayment: (data: object) => apiClient.post('/accounting/supplier-payments', data),
  listSupplierPayments: (params?: object) =>
    apiClient.get('/accounting/supplier-payments', { params }),

  // Expenses
  listExpenses: (params?: object) => apiClient.get('/accounting/expenses', { params }),
  createExpense: (data: object) => apiClient.post('/accounting/expenses', data),
  updateExpense: (id: string, data: object) => apiClient.put(`/accounting/expenses/${id}`, data),
  deleteExpense: (id: string) => apiClient.delete(`/accounting/expenses/${id}`),

  // Income
  listIncome: (params?: object) => apiClient.get('/accounting/income', { params }),
  createManualIncome: (data: object) => apiClient.post('/accounting/income', data),

  // Credit customers
  listCreditCustomers: () => apiClient.get('/accounting/credit-customers'),
  createCreditCustomer: (data: object) => apiClient.post('/accounting/credit-customers', data),
  getCreditLedger: (id: string) => apiClient.get(`/accounting/credit-customers/${id}/ledger`),
  recordCreditPayment: (id: string, data: object) =>
    apiClient.post(`/accounting/credit-customers/${id}/payment`, data),

  // Reports
  getPL: (from: string, to: string) =>
    apiClient.get('/accounting/reports/pl', { params: { from, to } }),
  getSalesSummary: (month: number, year: number) =>
    apiClient.get('/accounting/reports/sales-summary', { params: { month, year } }),
  getGstSummary: (month: number, year: number) =>
    apiClient.get('/accounting/reports/gst-summary', { params: { month, year } }),
  getStockValuation: () => apiClient.get('/accounting/reports/stock-valuation'),
  getPaymentSplit: (from: string, to: string) =>
    apiClient.get('/accounting/reports/payment-split', { params: { from, to } }),
  getCashRegister: (date: string) =>
    apiClient.get('/accounting/reports/cash-register', { params: { date } }),
  closeCashRegister: (data: object) =>
    apiClient.post('/accounting/reports/cash-register/close', data),
};
