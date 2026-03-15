import { Router } from 'express';
import { requireRole } from '../../middleware/auth';
import * as service from './accounting.service';

const router = Router();

// All accounting routes require shop_owner role
const shopAuth = requireRole('shop_owner');

// ─── Suppliers ────────────────────────────────────────────────────────────────

router.get('/suppliers', shopAuth, async (req, res, next) => {
  try {
    const data = await service.listSuppliers(req.user!.id);
    res.json({ success: true, data });
  } catch (err) { next(err); }
});

router.post('/suppliers', shopAuth, async (req, res, next) => {
  try {
    const supplier = await service.createSupplier(req.user!.id, req.body);
    res.status(201).json({ success: true, data: supplier, message: 'Supplier created' });
  } catch (err) { next(err); }
});

router.get('/suppliers/:id/ledger', shopAuth, async (req, res, next) => {
  try {
    const data = await service.getSupplierWithLedger(req.user!.id, req.params.id);
    res.json({ success: true, data });
  } catch (err) { next(err); }
});

router.patch('/suppliers/:id', shopAuth, async (req, res, next) => {
  try {
    const data = await service.updateSupplier(req.user!.id, req.params.id, req.body);
    res.json({ success: true, data });
  } catch (err) { next(err); }
});

router.delete('/suppliers/:id', shopAuth, async (req, res, next) => {
  try {
    await service.deactivateSupplier(req.user!.id, req.params.id);
    res.json({ success: true, message: 'Supplier deactivated' });
  } catch (err) { next(err); }
});

// ─── Purchase Entries ─────────────────────────────────────────────────────────

router.get('/purchases', shopAuth, async (req, res, next) => {
  try {
    const data = await service.listPurchaseEntries(req.user!.id, {
      page: req.query.page ? Number(req.query.page) : undefined,
      limit: req.query.limit ? Number(req.query.limit) : undefined,
      supplier_id: req.query.supplier_id as string | undefined,
      from: req.query.from as string | undefined,
      to: req.query.to as string | undefined,
    });
    res.json({ success: true, data });
  } catch (err) { next(err); }
});

router.post('/purchases', shopAuth, async (req, res, next) => {
  try {
    const data = await service.createPurchaseEntry(req.user!.id, req.body);
    res.status(201).json({ success: true, data, message: 'Purchase entry created and inventory updated' });
  } catch (err) { next(err); }
});

router.get('/purchases/:id', shopAuth, async (req, res, next) => {
  try {
    const data = await service.getPurchaseEntryById(req.user!.id, req.params.id);
    res.json({ success: true, data });
  } catch (err) { next(err); }
});

// ─── Supplier Payments ────────────────────────────────────────────────────────

router.get('/supplier-payments', shopAuth, async (req, res, next) => {
  try {
    const data = await service.listSupplierPayments(req.user!.id, {
      supplier_id: req.query.supplier_id as string | undefined,
      from: req.query.from as string | undefined,
      to: req.query.to as string | undefined,
    });
    res.json({ success: true, data });
  } catch (err) { next(err); }
});

router.post('/supplier-payments', shopAuth, async (req, res, next) => {
  try {
    const data = await service.recordSupplierPayment(req.user!.id, req.body);
    res.status(201).json({ success: true, data, message: 'Payment recorded' });
  } catch (err) { next(err); }
});

// ─── Expenses ─────────────────────────────────────────────────────────────────

router.get('/expenses', shopAuth, async (req, res, next) => {
  try {
    const data = await service.listExpenses(req.user!.id, {
      category: req.query.category as string | undefined,
      from: req.query.from as string | undefined,
      to: req.query.to as string | undefined,
      page: req.query.page ? Number(req.query.page) : undefined,
      limit: req.query.limit ? Number(req.query.limit) : undefined,
    });
    res.json({ success: true, data });
  } catch (err) { next(err); }
});

router.post('/expenses', shopAuth, async (req, res, next) => {
  try {
    const data = await service.createExpense(req.user!.id, req.body);
    res.status(201).json({ success: true, data, message: 'Expense logged' });
  } catch (err) { next(err); }
});

router.patch('/expenses/:id', shopAuth, async (req, res, next) => {
  try {
    const data = await service.updateExpense(req.user!.id, req.params.id, req.body);
    res.json({ success: true, data });
  } catch (err) { next(err); }
});

router.delete('/expenses/:id', shopAuth, async (req, res, next) => {
  try {
    await service.deleteExpense(req.user!.id, req.params.id);
    res.json({ success: true, message: 'Expense entry deleted' });
  } catch (err) { next(err); }
});

// ─── Income ───────────────────────────────────────────────────────────────────

router.get('/income', shopAuth, async (req, res, next) => {
  try {
    const data = await service.listIncome(req.user!.id, {
      from: req.query.from as string | undefined,
      to: req.query.to as string | undefined,
      page: req.query.page ? Number(req.query.page) : undefined,
      limit: req.query.limit ? Number(req.query.limit) : undefined,
    });
    res.json({ success: true, data });
  } catch (err) { next(err); }
});

router.post('/income', shopAuth, async (req, res, next) => {
  try {
    const data = await service.createManualIncome(req.user!.id, req.body);
    res.status(201).json({ success: true, data, message: 'Income entry created' });
  } catch (err) { next(err); }
});

// ─── Credit Customers ─────────────────────────────────────────────────────────

router.get('/credit-customers', shopAuth, async (req, res, next) => {
  try {
    const data = await service.listCreditCustomers(req.user!.id);
    res.json({ success: true, data });
  } catch (err) { next(err); }
});

router.post('/credit-customers', shopAuth, async (req, res, next) => {
  try {
    const data = await service.createCreditCustomer(req.user!.id, req.body);
    res.status(201).json({ success: true, data, message: 'Credit customer created' });
  } catch (err) { next(err); }
});

router.get('/credit-customers/:id/ledger', shopAuth, async (req, res, next) => {
  try {
    const data = await service.getCreditCustomerLedger(req.user!.id, req.params.id);
    res.json({ success: true, data });
  } catch (err) { next(err); }
});

router.post('/credit-customers/:id/payment', shopAuth, async (req, res, next) => {
  try {
    const data = await service.recordCreditPayment(req.user!.id, req.params.id, req.body);
    res.status(201).json({ success: true, data, message: 'Payment received and outstanding updated' });
  } catch (err) { next(err); }
});

router.get('/outstandings', shopAuth, async (req, res, next) => {
  try {
    const data = await service.listOutstandings(req.user!.id);
    res.json({ success: true, data });
  } catch (err) { next(err); }
});

// ─── Reports ──────────────────────────────────────────────────────────────────

// GET /accounting/reports/pl?from=YYYY-MM-DD&to=YYYY-MM-DD
router.get('/reports/pl', shopAuth, async (req, res, next) => {
  try {
    const { from, to } = req.query as { from: string; to: string };
    if (!from || !to) {
      return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: '`from` and `to` dates are required' } });
    }
    const data = await service.getProfitAndLoss(req.user!.id, from, to);
    res.json({ success: true, data });
  } catch (err) { next(err); }
});

// GET /accounting/reports/sales-summary?month=3&year=2026
router.get('/reports/sales-summary', shopAuth, async (req, res, next) => {
  try {
    const month = req.query.month ? Number(req.query.month) : new Date().getMonth() + 1;
    const year = req.query.year ? Number(req.query.year) : new Date().getFullYear();
    const data = await service.getSalesSummary(req.user!.id, month, year);
    res.json({ success: true, data });
  } catch (err) { next(err); }
});

// GET /accounting/reports/stock-valuation
router.get('/reports/stock-valuation', shopAuth, async (req, res, next) => {
  try {
    const data = await service.getStockValuation(req.user!.id);
    res.json({ success: true, data });
  } catch (err) { next(err); }
});

// GET /accounting/reports/gst-summary?month=3&year=2026
router.get('/reports/gst-summary', shopAuth, async (req, res, next) => {
  try {
    const month = req.query.month ? Number(req.query.month) : new Date().getMonth() + 1;
    const year = req.query.year ? Number(req.query.year) : new Date().getFullYear();
    const data = await service.getGstSummary(req.user!.id, month, year);
    res.json({ success: true, data });
  } catch (err) { next(err); }
});

// GET /accounting/reports/payment-split?from=YYYY-MM-DD&to=YYYY-MM-DD
router.get('/reports/payment-split', shopAuth, async (req, res, next) => {
  try {
    const { from, to } = req.query as { from: string; to: string };
    if (!from || !to) {
      return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: '`from` and `to` dates are required' } });
    }
    const data = await service.getPaymentSplit(req.user!.id, from, to);
    res.json({ success: true, data });
  } catch (err) { next(err); }
});

// GET /accounting/reports/cash-register?date=YYYY-MM-DD
router.get('/reports/cash-register', shopAuth, async (req, res, next) => {
  try {
    const date = (req.query.date as string) ?? new Date().toISOString().split('T')[0];
    const data = await service.getDailyCashRegister(req.user!.id, date);
    res.json({ success: true, data });
  } catch (err) { next(err); }
});

// POST /accounting/reports/cash-register/close
router.post('/reports/cash-register/close', shopAuth, async (req, res, next) => {
  try {
    const { date, actual_closing_bal, notes } = req.body as {
      date?: string;
      actual_closing_bal: number;
      notes?: string;
    };
    if (actual_closing_bal === undefined || actual_closing_bal === null) {
      return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'actual_closing_bal is required' } });
    }
    const registerDate = date ?? new Date().toISOString().split('T')[0];
    const data = await service.closeCashRegister(req.user!.id, registerDate, actual_closing_bal, notes);
    res.json({ success: true, data, message: 'Cash register closed' });
  } catch (err) { next(err); }
});

// ─── Sale Returns ──────────────────────────────────────────────────────────────────────────────────

router.get('/sale-returns', shopAuth, async (req, res, next) => {
  try {
    const data = await service.listSaleReturns(req.user!.id, {
      from: req.query.from as string | undefined,
      to: req.query.to as string | undefined,
      page: req.query.page ? Number(req.query.page) : undefined,
      limit: req.query.limit ? Number(req.query.limit) : undefined,
    });
    res.json({ success: true, data });
  } catch (err) { next(err); }
});

router.post('/sale-returns', shopAuth, async (req, res, next) => {
  try {
    const data = await service.createSaleReturn(req.user!.id, req.body);
    res.status(201).json({ success: true, data, message: 'Sale return recorded and inventory restocked' });
  } catch (err) { next(err); }
});

// ─── Purchase Returns ─────────────────────────────────────────────────────────────────────────

router.get('/purchase-returns', shopAuth, async (req, res, next) => {
  try {
    const data = await service.listPurchaseReturns(req.user!.id, {
      from: req.query.from as string | undefined,
      to: req.query.to as string | undefined,
      page: req.query.page ? Number(req.query.page) : undefined,
      limit: req.query.limit ? Number(req.query.limit) : undefined,
    });
    res.json({ success: true, data });
  } catch (err) { next(err); }
});

router.post('/purchase-returns', shopAuth, async (req, res, next) => {
  try {
    const data = await service.createPurchaseReturn(req.user!.id, req.body);
    res.status(201).json({ success: true, data, message: 'Purchase return recorded and inventory updated' });
  } catch (err) { next(err); }
});

// ─── Contra Entries ────────────────────────────────────────────────────────────────────────────

router.get('/contra-entries', shopAuth, async (req, res, next) => {
  try {
    const data = await service.listContraEntries(req.user!.id, {
      from: req.query.from as string | undefined,
      to: req.query.to as string | undefined,
    });
    res.json({ success: true, data });
  } catch (err) { next(err); }
});

router.post('/contra-entries', shopAuth, async (req, res, next) => {
  try {
    const data = await service.createContraEntry(req.user!.id, req.body);
    res.status(201).json({ success: true, data, message: 'Contra entry recorded' });
  } catch (err) { next(err); }
});

// ─── Book Reports (Cashbook / Bankbook) ───────────────────────────────────────────────

router.get('/reports/cashbook', shopAuth, async (req, res, next) => {
  try {
    const now = new Date();
    const from = (req.query.from as string) ?? new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
    const to = (req.query.to as string) ?? now.toISOString().split('T')[0];
    const data = await service.getCashbook(req.user!.id, { from, to });
    res.json({ success: true, data });
  } catch (err) { next(err); }
});

router.get('/reports/bankbook', shopAuth, async (req, res, next) => {
  try {
    const now = new Date();
    const from = (req.query.from as string) ?? new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
    const to = (req.query.to as string) ?? now.toISOString().split('T')[0];
    const data = await service.getBankbook(req.user!.id, { from, to, method: req.query.method as string | undefined });
    res.json({ success: true, data });
  } catch (err) { next(err); }
});

// ─── Backup & Restore ─────────────────────────────────────────────────────────

router.get('/backup', shopAuth, async (req, res, next) => {
  try {
    const data = await service.exportAccountingData(req.user!.id);
    res.json({ success: true, data });
  } catch (err) { next(err); }
});

router.post('/restore', shopAuth, async (req, res, next) => {
  try {
    const data = await service.restoreAccountingData(req.user!.id, req.body);
    res.json({ success: true, data });
  } catch (err) { next(err); }
});

export default router;
