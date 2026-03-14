import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import { useAuthStore } from '../store/authStore';

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000/api/v1';

export const apiClient = axios.create({
  baseURL: BASE_URL,
  timeout: 15_000,
  headers: { 'Content-Type': 'application/json' },
});

apiClient.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  if (typeof window !== 'undefined') {
    const token = useAuthStore.getState().accessToken;
    if (token) config.headers.set('Authorization', `Bearer ${token}`);
  }
  return config;
});

let isRefreshing = false;
let failedQueue: { resolve: (v: unknown) => void; reject: (e: unknown) => void }[] = [];

const processQueue = (error: unknown, token: string | null = null) => {
  failedQueue.forEach(({ resolve, reject }) => (error ? reject(error) : resolve(token)));
  failedQueue = [];
};

apiClient.interceptors.response.use(
  (res) => res,
  async (error: AxiosError) => {
    const original = error.config as InternalAxiosRequestConfig & { _retry?: boolean };
    if (error.response?.status === 401 && !original._retry && typeof window !== 'undefined') {
      if (isRefreshing) {
        return new Promise((resolve, reject) => { failedQueue.push({ resolve, reject }); })
          .then((token) => { original.headers.set('Authorization', `Bearer ${token}`); return apiClient(original); });
      }
      original._retry = true;
      isRefreshing = true;
      try {
        const refreshToken = useAuthStore.getState().refreshToken;
        if (!refreshToken) throw new Error('No refresh token');
        const { data } = await axios.post(`${BASE_URL}/auth/token/refresh`, { refresh_token: refreshToken });
        const { access_token, refresh_token: newRefresh } = data.data;
        useAuthStore.getState().setTokens(access_token, newRefresh);
        processQueue(null, access_token);
        original.headers.set('Authorization', `Bearer ${access_token}`);
        return apiClient(original);
      } catch (err) {
        processQueue(err, null);
        useAuthStore.getState().clearAuth();
        window.location.href = '/login';
        return Promise.reject(err);
      } finally {
        isRefreshing = false;
      }
    }
    return Promise.reject(error);
  }
);

// ── API helpers ───────────────────────────────────────────────────────────────
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
  // Use raw axios (not apiClient) to avoid the 401-refresh interceptor loop
  refreshToken: (refreshToken: string) =>
    axios.post(`${BASE_URL}/auth/token/refresh`, { refresh_token: refreshToken }),
  logout: () => apiClient.post('/auth/logout'),
};

export const shopApi = {
  getMyShop: () => apiClient.get('/shops/me'),
  getDashboard: () => apiClient.get('/shops/me/dashboard'),
  getTodayAppointments: (date?: string) => apiClient.get('/appointments/today', { params: date ? { date } : undefined }),
  createShop: (data: object) => apiClient.post('/shops', data),
  updateProfile: (data: object) => apiClient.put('/shops/me', data),
  search: (params: { q?: string; city?: string; pin_code?: string }) =>
    apiClient.get('/shops/search', { params }),
};

export const subscriptionApi = {
  getCurrent: () => apiClient.get('/subscriptions/current'),
  getPlans: () => apiClient.get('/subscriptions/plans'),
  subscribe: (planId: string, period: string = '1') => apiClient.post('/subscriptions/subscribe', { plan_id: planId, period }),
};

export const appointmentApi = {
  getTodayForDoctor: (chamberId: string) =>
    apiClient.get('/appointments/today', { params: { chamber_id: chamberId } }),
  getHistory: (params?: object) => apiClient.get('/appointments/history', { params }),
  updateStatus: (id: string, status: string) =>
    apiClient.patch(`/appointments/${id}/status`, { status }),
  bookWalkIn: (data: object) => apiClient.post('/appointments/walk-in', data),
};

export const medicinesApi = {
  catalog: (params?: { page?: number; q?: string }) => apiClient.get('/medicines', { params }),
};

export const inventoryApi = {
  list: (params?: { page?: number; q?: string; low_stock?: boolean; limit?: number }) => apiClient.get('/inventory', { params }),
  add: (data: object) => apiClient.post('/inventory', data),
  update: (id: string, data: object) => apiClient.patch(`/inventory/${id}`, data),
  remove: (id: string) => apiClient.delete(`/inventory/${id}`),
  lowStock: () => apiClient.get('/inventory', { params: { low_stock: true } }),
  importBulk: (items: object[]) => apiClient.post('/inventory/import', { items }, { timeout: 120_000 }),
};

export const billApi = {
  list: (params?: object) => apiClient.get('/bills', { params }),
  stats: (params?: object) => apiClient.get('/bills/stats', { params }),
  generate: (prescriptionId: string, data?: object) =>
    apiClient.post(`/bills/from-prescription/${prescriptionId}`, data ?? {}),
  createManual: (data: object) => apiClient.post('/bills/manual', data),
  getById: (id: string) => apiClient.get(`/bills/${id}`),
  markPaid: (id: string, method: string) =>
    apiClient.patch(`/bills/${id}/pay`, { payment_method: method }),
  searchCustomers: (phone: string) =>
    apiClient.get<{ success: boolean; data: { customer_name: string | null; customer_phone: string }[] }>(
      '/bills/customers/search', { params: { phone } }
    ),
};

export const prescriptionApi = {
  verifyQR: (qrContent: string) => apiClient.post('/prescriptions/verify', { qr_content: qrContent }),
  getById: (id: string) => apiClient.get(`/prescriptions/${id}/verify`),
  getPdf: (id: string) => apiClient.get(`/prescriptions/${id}/pdf`),
  create: (data: object) => apiClient.post('/prescriptions', data),
};

export const reportsApi = {
  getAnalytics: (days = 30) => apiClient.get('/shops/me/analytics', { params: { days } }),
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
  getOutstandings: () => apiClient.get('/accounting/outstandings'),

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

  // Sale Returns
  listSaleReturns: (params?: object) => apiClient.get('/accounting/sale-returns', { params }),
  createSaleReturn: (data: object) => apiClient.post('/accounting/sale-returns', data),

  // Purchase Returns
  listPurchaseReturns: (params?: object) => apiClient.get('/accounting/purchase-returns', { params }),
  createPurchaseReturn: (data: object) => apiClient.post('/accounting/purchase-returns', data),

  // Contra Entries
  listContraEntries: (params?: object) => apiClient.get('/accounting/contra-entries', { params }),
  createContraEntry: (data: object) => apiClient.post('/accounting/contra-entries', data),

  // Books
  getCashbook: (from: string, to: string) =>
    apiClient.get('/accounting/reports/cashbook', { params: { from, to } }),
  getBankbook: (from: string, to: string, method?: string) =>
    apiClient.get('/accounting/reports/bankbook', { params: { from, to, method } }),
};

export const doctorApi = {
  search: (params: object) => apiClient.get('/doctors/search', { params }),
  getProfile: () => apiClient.get('/doctors/me'),
  createProfile: (data: object) => apiClient.post('/doctors', data),
  updateProfile: (data: object) => apiClient.put('/doctors/me', data),
  getStats: () => apiClient.get('/doctors/me/stats'),
  getMyChambers: () => apiClient.get('/chambers/mine'),
  getTodayAppointments: (chamberId?: string) =>
    apiClient.get('/appointments/today', { params: chamberId ? { chamber_id: chamberId } : undefined }),
  getMyPrescriptions: (params?: object) => apiClient.get('/prescriptions/my-issued', { params }),
};

export const adminApi = {
  getAnalytics: () => apiClient.get('/admin/analytics'),
  getDoctors: (status?: string) => apiClient.get('/admin/doctors', { params: status ? { status } : undefined }),
  verifyDoctor: (id: string, status: 'approved' | 'rejected', rejection_reason?: string) =>
    apiClient.patch(`/admin/doctors/${id}/verify`, { status, rejection_reason }),
  getShops: (status?: string) => apiClient.get('/admin/shops', { params: status ? { status } : undefined }),
  verifyShop: (id: string, status: 'approved' | 'rejected', rejection_reason?: string) =>
    apiClient.patch(`/admin/shops/${id}/verify`, { status, rejection_reason }),
  getUsers: (role?: string) => apiClient.get('/admin/users', { params: role ? { role } : undefined }),
  rechargeShop: (id: string, data: { plan_id: string; months: number }) => apiClient.post(`/admin/shops/${id}/recharge`, data),
  flushSessions: () => apiClient.post('/admin/sessions/flush'),
};

export const bannerApi = {
  getAll: (all: boolean = false) => apiClient.get(all ? '/banners/all' : '/banners'),
  create: (formData: FormData) =>
    apiClient.post('/banners', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),
  update: (id: string, formData: FormData) =>
    apiClient.patch(`/banners/${id}`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),
  delete: (id: string) => apiClient.delete(`/banners/${id}`),
};

export const chamberApi = {
  create: (data: object) => apiClient.post('/chambers', data),
  getShopChambers: (status?: string) =>
    apiClient.get('/chambers/shop-mine', { params: status ? { status } : undefined }),
  approve: (id: string) => apiClient.post(`/chambers/${id}/approve`),
  getAvailableSlots: (chamberId: string, date: string) =>
    apiClient.get(`/chambers/${chamberId}/slots`, { params: { date } }),
  /** Alias for getAvailableSlots — used in patient dashboard */
  getSlots: (chamberId: string, date: string) =>
    apiClient.get(`/chambers/${chamberId}/slots`, { params: { date } }),
  shopAddDoctor: (data: object) => apiClient.post('/chambers/shop-add-doctor', data),
  setSchedule: (chamberId: string, schedules: object[]) =>
    apiClient.put(`/chambers/${chamberId}/schedule`, schedules),
  updateFee: (chamberId: string, fee: number) =>
    apiClient.patch(`/chambers/${chamberId}/fee`, { consultation_fee: fee }),
};

/** Public doctor search — no authentication required */
export const doctorsApi = {
  search: (params: { q?: string; lat?: number; lng?: number; pincode?: string; specialization?: string; available_today?: boolean }) =>
    apiClient.get('/doctors/search', { params }),
  getById: (id: string) => apiClient.get(`/doctors/${id}`),
};

/** Patient-specific endpoints — requires patient role */
export const patientApi = {
  getProfile: () => apiClient.get('/patients/me'),
  createProfile: (data: object) => apiClient.post('/patients/profile', data),
  updateProfile: (data: object) => apiClient.patch('/patients/profile', data),
  getAppointments: () => apiClient.get('/patients/me/appointments'),
  bookAppointment: (data: {
    chamber_id: string;
    appointment_date: string;
    slot_start_time: string;
    chief_complaint?: string;
  }) => apiClient.post('/appointments', data),
};
