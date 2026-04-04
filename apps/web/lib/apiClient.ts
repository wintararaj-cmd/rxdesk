import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import { useAuthStore } from '../store/authStore';
import { useConfigStore } from '../store/configStore';

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000/api/v1';

export const apiClient = axios.create({
  baseURL: BASE_URL,
  timeout: 15_000,
  headers: { 'Content-Type': 'application/json' },
});

apiClient.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  if (typeof window !== 'undefined') {
    const token = useAuthStore.getState().accessToken;
    const fy = useConfigStore.getState().financialYear;
    if (token) config.headers.set('Authorization', `Bearer ${token}`);
    if (fy) config.headers.set('x-financial-year', fy);
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
  deactivateAccount: () => apiClient.delete('/auth/account'),
};

export const shopApi = {
  getMyShop: () => apiClient.get('/shops/me'),
  getDashboard: () => apiClient.get('/shops/me/dashboard'),
  getTodayAppointments: (date?: string) => apiClient.get('/appointments/today', { params: date ? { date } : undefined }),
  createShop: (data: object) => apiClient.post('/shops', data),
  updateProfile: (data: object) => apiClient.put('/shops/me', data),
  search: (params: { q?: string; city?: string; pin_code?: string }) =>
    apiClient.get('/shops/search', { params }),
  generateBackupApiKey: () => apiClient.post('/shops/me/backup-key'),
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
  catalog: (params?: { page?: number; q?: string; pageSize?: number }) => apiClient.get('/medicines', { params }),
  search: (q: string) => apiClient.get('/medicines/search', { params: { q } }),
  compositionSearch: (q: string, shopId?: string) =>
    apiClient.get('/medicines/composition-search', { params: { q, ...(shopId ? { shop_id: shopId } : {}) } }),
  checkAvailability: (name: string, pincode?: string) =>
    apiClient.get('/medicines/availability', { params: { name, ...(pincode ? { pincode } : {}) } }),
};


export const inventoryApi = {
  list: (params?: { page?: number; q?: string; low_stock?: boolean; limit?: number }) => apiClient.get('/inventory', { params }),
  masterList: (params?: { q?: string }) => apiClient.get('/inventory/master', { params }),
  masterBatches: (id: string) => apiClient.get(`/inventory/master/${id}/batches`),
  updateMaster: (id: string, data: { rack_location?: string; reorder_level?: number }) => apiClient.patch(`/inventory/master/${id}`, data),
  add: (data: object) => apiClient.post('/inventory', data),
  update: (id: string, data: object) => apiClient.patch(`/inventory/${id}`, data),
  remove: (id: string) => apiClient.delete(`/inventory/${id}`),
  lowStock: () => apiClient.get('/inventory', { params: { low_stock: true } }),
  importBulk: (items: object[]) => apiClient.post('/inventory/import', { items }, { timeout: 120_000 }),
  expiringItems: (days = 90) => apiClient.get('/inventory/expiring', { params: { days } }),
  exportExpiryExcel: (days = 90) =>
    apiClient.get('/inventory/reports/expiry-excel', { params: { days }, responseType: 'blob' }),
  stockSupplierReport: (q?: string) => apiClient.get('/inventory/reports/batch-supplier', { params: { q } }),
  purchaseOrderSuggestions: () => apiClient.get('/inventory/purchase-order-suggestions'),
  // Insights
  getDeadStock: () => apiClient.get('/inventory/insights/dead-stock'),
  getPredictiveOrders: () => apiClient.get('/inventory/insights/predictive-orders'),
  getRefillReminders: () => apiClient.get('/inventory/insights/refill-reminders'),
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
  searchCustomers: (q: string) =>
    apiClient.get<{ success: boolean; data: any[] }>(
      '/bills/customers/search', { params: { q } }
    ),
  void: (id: string) => apiClient.delete(`/bills/${id}`),
  update: (id: string, data: object) => apiClient.patch(`/bills/${id}`, data),
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
  importSuppliers: (items: any[]) => apiClient.post('/accounting/suppliers/import', { items }),
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
  importCreditCustomers: (items: any[]) => apiClient.post('/accounting/credit-customers/import', { items }),
  updateCreditCustomer: (id: string, data: object) => apiClient.put(`/accounting/credit-customers/${id}`, data),
  deleteCreditCustomer: (id: string) => apiClient.delete(`/accounting/credit-customers/${id}`),
  getCreditLedger: (id: string) => apiClient.get(`/accounting/credit-customers/${id}/ledger`),
  recordCreditPayment: (id: string, data: object) =>
    apiClient.post(`/accounting/credit-customers/${id}/payment`, data),
  getOutstandings: () => apiClient.get('/accounting/outstandings'),

  // Reports
  getPL: (from: string, to: string) =>
    apiClient.get('/accounting/reports/pl', { params: { from, to } }),
  getSalesSummary: (month: number, year: number) =>
    apiClient.get('/accounting/reports/sales-summary', { params: { month, year } }),
  getDetailedSalesReport: (from: string, to: string) =>
    apiClient.get('/accounting/reports/sales-detailed', { params: { from, to } }),
  getGstSummary: (month: number, year: number) =>
    apiClient.get('/accounting/reports/gst-summary', { params: { month, year } }),
  getCompositionGstReport: (quarter: number, year: number) =>
    apiClient.get('/accounting/reports/gst-composition', { params: { quarter, year } }),
  getCompositionGstExcel: (quarter: number, year: number) =>
    apiClient.get('/accounting/reports/gst-composition-excel', { params: { quarter, year }, responseType: 'blob' }),
  getGstr1Excel: (month: number, year: number) =>
    apiClient.get('/accounting/reports/gstr1-excel', { params: { month, year }, responseType: 'blob' }),
  getGstr2Excel: (month: number, year: number) =>
    apiClient.get('/accounting/reports/gstr2-excel', { params: { month, year }, responseType: 'blob' }),
  getGstr3bExcel: (month: number, year: number) =>
    apiClient.get('/accounting/reports/gstr3b-excel', { params: { month, year }, responseType: 'blob' }),
  getGstr4Excel: (year: number) =>
    apiClient.get('/accounting/reports/gstr4-excel', { params: { year }, responseType: 'blob' }),
  getStockValuation: () => apiClient.get('/accounting/reports/stock-valuation'),
  getPaymentSplit: (from: string, to: string) =>
    apiClient.get('/accounting/reports/payment-split', { params: { from, to } }),
  getCashRegister: (date: string) =>
    apiClient.get('/accounting/reports/cash-register', { params: { date } }),
  closeCashRegister: (data: object) =>
    apiClient.post('/accounting/reports/cash-register/close', data),

  // Purchases
  voidPurchase: (id: string) => apiClient.delete(`/accounting/purchases/${id}`),
  updatePurchase: (id: string, data: object) => apiClient.put(`/accounting/purchases/${id}`, data),

  // Sale Returns
  listSaleReturns: (params?: object) => apiClient.get('/accounting/sale-returns', { params }),
  createSaleReturn: (data: object) => apiClient.post('/accounting/sale-returns', data),
  getSaleReturnById: (id: string) => apiClient.get(`/accounting/sale-returns/${id}`),
  deleteSaleReturn: (id: string) => apiClient.delete(`/accounting/sale-returns/${id}`),

  // Purchase Returns
  listPurchaseReturns: (params?: object) => apiClient.get('/accounting/purchase-returns', { params }),
  createPurchaseReturn: (data: object) => apiClient.post('/accounting/purchase-returns', data),
  getPurchaseReturnById: (id: string) => apiClient.get(`/accounting/purchase-returns/${id}`),
  deletePurchaseReturn: (id: string) => apiClient.delete(`/accounting/purchase-returns/${id}`),

  // Contra Entries
  listContraEntries: (params?: object) => apiClient.get('/accounting/contra-entries', { params }),
  createContraEntry: (data: object) => apiClient.post('/accounting/contra-entries', data),
  updateContraEntry: (id: string, data: object) => apiClient.put(`/accounting/contra-entries/${id}`, data),
  deleteContraEntry: (id: string) => apiClient.delete(`/accounting/contra-entries/${id}`),

  // Books
  getStatus: () => apiClient.get('/accounting/status'),
  updateOpeningBalances: (data: { cash: number; bank: number }) => apiClient.put('/accounting/settings/opening-balances', data),
  getCashbook: (from: string, to: string) =>
    apiClient.get('/accounting/reports/cashbook', { params: { from, to } }),
  getBankbook: (from: string, to: string, method?: string) =>
    apiClient.get('/accounting/reports/bankbook', { params: { from, to, method } }),

  // Backup & Restore
  backup: () => apiClient.get('/accounting/backup'),
  restore: (data: object) => apiClient.post('/accounting/restore', data),
  getBackupList: () => apiClient.get('/accounting/backups/list'),
  triggerServerBackup: () => apiClient.post('/accounting/backups/trigger'),

  // Chart of Accounts (Phase 2)
  listAccountGroups: () => apiClient.get('/accounting/account-groups'),
  listChartOfAccounts: (type?: string) => 
    apiClient.get('/accounting/chart-of-accounts', { params: type ? { type } : undefined }),
  createChartOfAccount: (data: object) => apiClient.post('/accounting/chart-of-accounts', data),
  initializeCOA: () => apiClient.post('/accounting/initialize-coa'),
  getGLStatement: (id: string, from: string, to: string) =>
    apiClient.get('/accounting/reports/gl-statement', { params: { id, from, to } }),

  // Journal & Balance Sheet (Phase 3)
  listJournalEntries: (from?: string, to?: string) =>
    apiClient.get('/accounting/journal-entries', { params: { from, to } }),
  createJournalEntry: (data: object) => apiClient.post('/accounting/journal-entries', data),
  deleteJournalEntry: (id: string) => apiClient.delete(`/accounting/journal-entries/${id}`),
  getBalanceSheet: (date: string) => apiClient.get('/accounting/reports/balance-sheet', { params: { date } }),
  getTrialBalance: (date: string) => apiClient.get('/accounting/reports/trial-balance', { params: { date } }),
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
  getEarnings: () => apiClient.get('/doctors/me/earnings'),
  getTemplates: () => apiClient.get('/prescriptions/templates'),
  createTemplate: (data: object) => apiClient.post('/prescriptions/templates', data),
  deleteTemplate: (id: string) => apiClient.delete(`/prescriptions/templates/${id}`),
};

export const adminApi = {
  getAnalytics: () => apiClient.get('/admin/analytics'),
  // Doctors
  getDoctors: (status?: string, q?: string) => apiClient.get('/admin/doctors', { params: { status, q } }),
  verifyDoctor: (id: string, status: 'approved' | 'rejected', rejection_reason?: string) =>
    apiClient.patch(`/admin/doctors/${id}/verify`, { status, rejection_reason }),
  bulkActionDoctors: (ids: string[], status: 'approved' | 'rejected') =>
    apiClient.post('/admin/doctors/bulk-action', { ids, status }),
  // Shops
  getShops: (status?: string, q?: string) => apiClient.get('/admin/shops', { params: { status, q } }),
  getShopDetail: (id: string) => apiClient.get(`/admin/shops/${id}`),
  verifyShop: (id: string, status: 'approved' | 'rejected', rejection_reason?: string) =>
    apiClient.patch(`/admin/shops/${id}/verify`, { status, rejection_reason }),
  bulkActionShops: (ids: string[], status: 'approved' | 'rejected') =>
    apiClient.post('/admin/shops/bulk-action', { ids, status }),
  rechargeShop: (id: string, data: { plan_id: string; months: number }) =>
    apiClient.post(`/admin/shops/${id}/recharge`, data),
  // Users
  getUsers: (role?: string, q?: string) => apiClient.get('/admin/users', { params: { role, q } }),
  toggleUserActive: (id: string) => apiClient.patch(`/admin/users/${id}/toggle-active`),
  exportUsersCsvUrl: (role?: string) => `${apiClient.defaults.baseURL}/admin/users/export-csv${role ? `?role=${role}` : ''}`,
  // Subscriptions
  getSubscriptions: (status?: string) => apiClient.get('/admin/subscriptions', { params: { status } }),
  // Subscription Plans
  getPlans: () => apiClient.get('/admin/plans'),
  createPlan: (data: object) => apiClient.post('/admin/plans', data),
  updatePlan: (id: string, data: object) => apiClient.patch(`/admin/plans/${id}`, data),
  // Medicine Catalog
  getMedicineCatalog: (q?: string, page?: number) => apiClient.get('/admin/medicine-catalog', { params: { q, page } }),
  createMedicine: (data: object) => apiClient.post('/admin/medicine-catalog', data),
  updateMedicine: (id: string, data: object) => apiClient.put(`/admin/medicine-catalog/${id}`, data),
  deleteMedicine: (id: string) => apiClient.delete(`/admin/medicine-catalog/${id}`),
  // Activity Log
  getActivityLog: (page?: number) => apiClient.get('/admin/activity-log', { params: { page } }),
  // Broadcast
  broadcast: (data: { title: string; body: string; target_role?: string }) =>
    apiClient.post('/admin/broadcast', data),
  // Audit Logs
  getAuditLogs: (params: Record<string, string | number | undefined>) => 
    apiClient.get('/admin/audit-logs', { params }),
  getAuditLogsExportUrl: (params: Record<string, string | undefined>) => {
    const q = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => { if (v) q.set(k, v); });
    return `${apiClient.defaults.baseURL}/admin/audit-logs/export-csv?${q}`;
  },
  // Sessions
  flushSessions: () => apiClient.post('/admin/sessions/flush'),
  // Recharges
  getRechargeReport: () => apiClient.get('/admin/recharges/report'),
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
  getDoctorStats: (chamberId: string) =>
    apiClient.get(`/chambers/${chamberId}/stats`),
  removeDoctor: (chamberId: string) =>
    apiClient.delete(`/chambers/${chamberId}`),
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
  cancelAppointment: (id: string) => apiClient.patch(`/appointments/${id}/cancel`),
};

export const notificationApi = {
  getAll: () => apiClient.get('/notifications'),
  readAll: () => apiClient.patch('/notifications/read-all'),
  markRead: (id: string) => apiClient.patch(`/notifications/${id}/read`),
};
