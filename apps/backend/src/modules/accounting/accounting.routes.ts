import { Router } from 'express';
import { requireRole } from '../../middleware/auth';
import * as service from './accounting.service';
import * as reconService from './gst-reconcile.service';
import { audit } from '../../utils/audit';

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

router.post('/suppliers/import', shopAuth, async (req, res, next) => {
  try {
    const items = req.body.items;
    if (!Array.isArray(items)) {
      return res.status(400).json({ success: false, error: 'items array is required' });
    }
    const data = await service.importSuppliers(req.user!.id, items);
    res.json({ success: true, data, message: `Imported ${data.length} suppliers` });
  } catch (err) { next(err); }
});

router.get('/suppliers/:id/ledger', shopAuth, async (req, res, next) => {
  try {
    const data = await service.getSupplierWithLedger(req.user!.id, req.params.id);
    res.json({ success: true, data });
  } catch (err) { next(err); }
});

router.put('/suppliers/:id', shopAuth, async (req, res, next) => {
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
    audit({
      action: 'purchase.created',
      userId: req.user!.id,
      actorRole: req.user!.role,
      shopId: data.shop_id,
      resource: 'purchase',
      resourceId: data.id,
      ipAddress: req.ip,
      metadata: { invoice_number: data.invoice_number, total_amount: Number(data.total_amount), supplier_id: data.supplier_id },
    });
    res.status(201).json({ success: true, data, message: 'Purchase entry created and inventory updated' });
  } catch (err) { next(err); }
});

router.get('/purchases/:id', shopAuth, async (req, res, next) => {
  try {
    const data = await service.getPurchaseEntryById(req.user!.id, req.params.id);
    res.json({ success: true, data });
  } catch (err) { next(err); }
});

router.put('/purchases/:id', shopAuth, async (req, res, next) => {
  try {
    const data = await service.updatePurchaseEntry(req.user!.id, req.params.id, req.body);
    audit({
      action: 'purchase.updated',
      userId: req.user!.id,
      actorRole: req.user!.role,
      shopId: data.shop_id,
      resource: 'purchase',
      resourceId: data.id,
      ipAddress: req.ip,
      metadata: { invoice_number: data.invoice_number, total_amount: Number(data.total_amount) },
    });
    res.json({ success: true, data, message: 'Purchase updated' });
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
    audit({
      action: 'supplier_payment.recorded',
      userId: req.user!.id,
      actorRole: req.user!.role,
      shopId: data.shop_id,
      resource: 'supplier_payment',
      resourceId: data.id,
      ipAddress: req.ip,
      metadata: { amount: Number(data.amount), method: data.payment_method, supplier_id: data.supplier_id },
    });
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

router.post('/credit-customers/import', shopAuth, async (req, res, next) => {
  try {
    const items = req.body.items;
    if (!Array.isArray(items)) {
      return res.status(400).json({ success: false, error: 'items array is required' });
    }
    const data = await service.importCreditCustomers(req.user!.id, items);
    res.json({ success: true, data, message: `Imported ${data.length} credit customers` });
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
    audit({
      action: 'customer_credit.payment',
      userId: req.user!.id,
      actorRole: req.user!.role,
      shopId: data.shop_id,
      resource: 'credit_transaction',
      resourceId: data.id,
      ipAddress: req.ip,
      metadata: { amount: Number(data.amount), customer_id: data.customer_id, method: data.payment_method },
    });
    res.status(201).json({ success: true, data, message: 'Payment received and outstanding updated' });
  } catch (err) { next(err); }
});

router.put('/credit-customers/:id', shopAuth, async (req, res, next) => {
  try {
    const data = await service.updateCreditCustomer(req.user!.id, req.params.id, req.body);
    res.json({ success: true, data, message: 'Credit customer updated' });
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

// GET /accounting/reports/sales-detailed?from=YYYY-MM-DD&to=YYYY-MM-DD
router.get('/reports/sales-detailed', shopAuth, async (req, res, next) => {
  try {
    const { from, to } = req.query as { from: string; to: string };
    if (!from || !to) {
      return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: '`from` and `to` dates are required' } });
    }
    const data = await service.getDetailedSalesReport(req.user!.id, from, to);
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

router.get('/reports/gstr1-json', shopAuth, async (req, res, next) => {
  try {
    const month = parseInt(req.query.month as string);
    const year = parseInt(req.query.year as string);
    if (!month || !year) return res.status(400).json({ success: false, message: 'Month and year are required' });
    const data = await service.generateGstr1Json(req.user!.id, month, year);
    res.json({ success: true, data });
  } catch (err) { next(err); }
});

router.get('/reports/gst-composition', shopAuth, async (req, res, next) => {
  try {
    const quarter = req.query.quarter ? Number(req.query.quarter) : Math.floor(new Date().getMonth() / 3) + 1;
    const year = req.query.year ? Number(req.query.year) : new Date().getFullYear();
    const data = await service.getCompositionGstReport(req.user!.id, quarter, year);
    res.json({ success: true, data });
  } catch (err) { next(err); }
});

router.get('/reports/gst-composition-excel', shopAuth, async (req, res, next) => {
  try {
    const quarter = req.query.quarter ? Number(req.query.quarter) : Math.floor(new Date().getMonth() / 3) + 1;
    const year = req.query.year ? Number(req.query.year) : new Date().getFullYear();
    const buffer = await service.generateCompositionGstExcel(req.user!.id, quarter, year);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=CMP08_Q${quarter}_${year}.xlsx`);
    res.send(buffer);
  } catch (err) { next(err); }
});

router.get('/reports/gstr1-excel', shopAuth, async (req, res, next) => {
  try {
    const month = req.query.month ? Number(req.query.month) : new Date().getMonth() + 1;
    const year = req.query.year ? Number(req.query.year) : new Date().getFullYear();
    const buffer = await service.generateGstr1Excel(req.user!.id, month, year);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=GSTR1_${month}_${year}.xlsx`);
    res.send(buffer);
  } catch (err) { next(err); }
});

router.get('/reports/gstr2-excel', shopAuth, async (req, res, next) => {
  try {
    const month = req.query.month ? Number(req.query.month) : new Date().getMonth() + 1;
    const year = req.query.year ? Number(req.query.year) : new Date().getFullYear();
    const buffer = await service.generateGstr2Excel(req.user!.id, month, year);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=GSTR2_${month}_${year}.xlsx`);
    res.send(buffer);
  } catch (err) { next(err); }
});

router.get('/reports/gstr3b-excel', shopAuth, async (req, res, next) => {
  try {
    const month = req.query.month ? Number(req.query.month) : new Date().getMonth() + 1;
    const year = req.query.year ? Number(req.query.year) : new Date().getFullYear();
    const buffer = await service.generateGstr3bExcel(req.user!.id, month, year);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=GSTR3B_${month}_${year}.xlsx`);
    res.send(buffer);
  } catch (err) { next(err); }
});

router.get('/reports/gstr4-excel', shopAuth, async (req, res, next) => {
  try {
    const year = req.query.year ? Number(req.query.year) : new Date().getFullYear();
    const buffer = await service.generateGstr4Excel(req.user!.id, year);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=GSTR4_${year}.xlsx`);
    res.send(buffer);
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

router.get('/sale-returns/:id', shopAuth, async (req, res, next) => {
  try {
    const data = await service.getSaleReturnById(req.user!.id, req.params.id);
    if (!data) return res.status(404).json({ success: false, error: 'Return not found' });
    res.json({ success: true, data });
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

router.get('/purchase-returns/:id', shopAuth, async (req, res, next) => {
  try {
    const data = await service.getPurchaseReturnById(req.user!.id, req.params.id);
    res.json({ success: true, data });
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

router.get('/status', shopAuth, async (req, res, next) => {
  try {
    const data = await service.getAccountingStatus(req.user!.id);
    res.json({ success: true, data });
  } catch (err) { next(err); }
});

router.put('/settings/opening-balances', shopAuth, async (req, res, next) => {
  try {
    const { cash, bank } = req.body;
    const data = await service.updateOpeningBalances(req.user!.id, { cash, bank });
    res.json({ success: true, data, message: 'Opening balances updated' });
  } catch (err) { next(err); }
});

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

// ─── Local Drive Backups (Server-side files) ──────────────────────────────────

router.get('/backups/list', shopAuth, async (req, res, next) => {
  try {
    const data = await service.listLocalBackups(req.user!.id);
    res.json({ success: true, data });
  } catch (err) { next(err); }
});

router.get('/backups/download/:filename', shopAuth, async (req, res, next) => {
  try {
    const filePath = await service.getBackupFilePath(req.user!.id, req.params.filename);
    res.download(filePath);
  } catch (err) { next(err); }
});

router.post('/backups/trigger', shopAuth, async (req, res, next) => {
  try {
    const data = await service.triggerManualLocalBackup(req.user!.id);
    res.json({ success: true, message: 'Backup created on server', data });
  } catch (err) { next(err); }
});

// ─── GSTR Reports (Excel) ────────────────────────────────────────────────────────
router.get('/reports/gstr1-excel', shopAuth, async (req, res, next) => {
  try {
    const month = parseInt(req.query.month as string);
    const year = parseInt(req.query.year as string);
    if (!month || !year) return res.status(400).json({ success: false, message: 'Month and year are required' });
    
    const buffer = await service.generateGstr1Excel(req.user!.id, month, year);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=GSTR1_${month}_${year}.xlsx`);
    res.send(buffer);
  } catch (err) { next(err); }
});

router.get('/reports/gstr2-excel', shopAuth, async (req, res, next) => {
  try {
    const month = parseInt(req.query.month as string);
    const year = parseInt(req.query.year as string);
    if (!month || !year) return res.status(400).json({ success: false, message: 'Month and year are required' });

    const buffer = await service.generateGstr2Excel(req.user!.id, month, year);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=GSTR2_${month}_${year}.xlsx`);
    res.send(buffer);
  } catch (err) { next(err); }
});

router.get('/reports/gstr3b-excel', shopAuth, async (req, res, next) => {
  try {
    const month = parseInt(req.query.month as string);
    const year = parseInt(req.query.year as string);
    if (!month || !year) return res.status(400).json({ success: false, message: 'Month and year are required' });

    const buffer = await service.generateGstr3bExcel(req.user!.id, month, year);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=GSTR3B_${month}_${year}.xlsx`);
    res.send(buffer);
  } catch (err) { next(err); }
});

router.delete('/purchases/:id', shopAuth, async (req, res, next) => {
  try {
    const data = await service.voidPurchase(req.user!.id, req.params.id);
    audit({
      action: 'purchase.voided',
      userId: req.user!.id,
      actorRole: req.user!.role,
      shopId: data.shop_id,
      resource: 'purchase',
      resourceId: req.params.id,
      ipAddress: req.ip,
    });
    res.json({ success: true, data, message: 'Purchase voided and items reversed' });
  } catch (err) { next(err); }
});

router.delete('/credit-customers/:id', shopAuth, async (req, res, next) => {
  try {
    const data = await service.deleteCreditCustomer(req.user!.id, req.params.id);
    res.json({ success: true, data, message: 'Credit customer deactivated' });
  } catch (err) { next(err); }
});

router.delete('/sale-returns/:id', shopAuth, async (req, res, next) => {
  try {
    const data = await service.deleteSaleReturn(req.user!.id, req.params.id);
    res.json({ success: true, data, message: 'Sale return deleted and items reversed' });
  } catch (err) { next(err); }
});

router.delete('/purchase-returns/:id', shopAuth, async (req, res, next) => {
  try {
    const data = await service.deletePurchaseReturn(req.user!.id, req.params.id);
    res.json({ success: true, data, message: 'Purchase return deleted and items reversed' });
  } catch (err) { next(err); }
});

router.delete('/contra-entries/:id', shopAuth, async (req, res, next) => {
  try {
    const data = await service.deleteContraEntry(req.user!.id, req.params.id);
    res.json({ success: true, data, message: 'Contra entry deleted' });
  } catch (err) { next(err); }
});

router.put('/contra-entries/:id', shopAuth, async (req, res, next) => {
  try {
    const data = await service.updateContraEntry(req.user!.id, req.params.id, req.body);
    res.json({ success: true, data, message: 'Contra entry updated' });
  } catch (err) { next(err); }
});

// ─── External Agent Backup ───────────────────────────────────────────────────────

router.get('/agent-backup', async (req, res, next) => {
  try {
    const apiKey = req.headers['x-api-key'];
    if (!apiKey || typeof apiKey !== 'string') {
      return res.status(401).json({ success: false, error: 'API key is missing' });
    }
    
    // Import prisma directly to check the key since this isn't in accounting service
    const { PrismaClient } = require('@prisma/client');
    const prisma = new PrismaClient();
    
    const shop = await prisma.medicalShop.findUnique({
      where: { backup_api_key: apiKey },
      select: { owner_user_id: true, id: true, shop_name: true }
    });
    
    if (!shop) {
      return res.status(403).json({ success: false, error: 'Invalid API key' });
    }

    const systemName = req.headers['x-system-name'] || 'Unknown System';
    await prisma.medicalShop.update({
      where: { id: shop.id },
      data: { 
        last_backup_system: String(systemName),
        last_backup_at: new Date()
      }
    });

    const data = await service.exportAccountingData(shop.owner_user_id);
    
    res.json({ success: true, shop_name: shop.shop_name, data });
  } catch (err) { next(err); }
});

// ─── Chart of Accounts (Phase 2) ─────────────────────────────────────────────

router.get('/account-groups', shopAuth, async (req, res, next) => {
  try {
    const data = await service.listAccountGroups(req.user!.id);
    res.json({ success: true, data });
  } catch (err) { next(err); }
});

router.get('/chart-of-accounts', shopAuth, async (req, res, next) => {
  try {
    const data = await service.listChartOfAccounts(req.user!.id, req.query.type as any);
    res.json({ success: true, data });
  } catch (err) { next(err); }
});

router.post('/chart-of-accounts', shopAuth, async (req, res, next) => {
  try {
    const data = await service.createChartOfAccount(req.user!.id, req.body);
    res.status(201).json({ success: true, data, message: 'Account created' });
  } catch (err) { next(err); }
});

router.patch('/chart-of-accounts/:id', shopAuth, async (req, res, next) => {
  try {
    const data = await service.updateChartOfAccount(req.user!.id, req.params.id, req.body);
    res.json({ success: true, data, message: 'Account updated successfully' });
  } catch (err) { next(err); }
});

router.post('/initialize-coa', shopAuth, async (req, res, next) => {
  try {
    const shop = await service.getShopOrThrow(req.user!.id);
    await service.initializeShopAccounts(shop.id);
    res.json({ success: true, message: 'Accounting system initialized' });
  } catch (err) { next(err); }
});

router.get('/reports/gl-statement', shopAuth, async (req, res, next) => {
  try {
    const { id, from, to } = req.query as { id: string; from: string; to: string };
    const data = await service.getGeneralLedgerStatement(req.user!.id, id, from, to);
    res.json({ success: true, data });
  } catch (err) { next(err); }
});

// ─── Journal Entries (Phase 3) ─────────────────────────────────────────────

router.get('/journal-entries', shopAuth, async (req, res, next) => {
  try {
    const { from, to } = req.query as { from: string; to: string };
    const data = await service.listJournalEntries(req.user!.id, from, to);
    res.json({ success: true, data });
  } catch (err) { next(err); }
});

router.post('/journal-entries', shopAuth, async (req, res, next) => {
  try {
    const data = await service.createJournalEntry(req.user!.id, req.body);
    res.status(201).json({ success: true, data, message: 'Journal entry recorded' });
  } catch (err) { next(err); }
});

router.delete('/journal-entries/:id', shopAuth, async (req, res, next) => {
  try {
    const data = await service.deleteJournalEntry(req.user!.id, req.params.id);
    res.json({ success: true, data, message: 'Journal entry deleted' });
  } catch (err) { next(err); }
});

// ─── Financial Reports: Balance Sheet (Phase 3) ──────────────────────────────

router.get('/reports/balance-sheet', shopAuth, async (req, res, next) => {
  try {
    const { date } = req.query as { date: string };
    const data = await service.getBalanceSheet(req.user!.id, date || new Date().toISOString().split('T')[0]);
    res.json({ success: true, data });
  } catch (err) { next(err); }
});

router.get('/reports/trial-balance', shopAuth, async (req, res, next) => {
  try {
    const { date } = req.query as { date: string };
    const data = await service.getTrialBalance(req.user!.id, date || new Date().toISOString().split('T')[0]);
    res.json({ success: true, data });
  } catch (err) { next(err); }
});

// ─── GST Reconciliation ───────────────────────────────────────────────────────

// GET /accounting/reports/gst-recon/books?month=3&year=2026
router.get('/reports/gst-recon/books', shopAuth, async (req, res, next) => {
  try {
    const month = parseInt(req.query.month as string);
    const year = parseInt(req.query.year as string);
    if (!month || !year) return res.status(400).json({ success: false, message: 'month and year required' });
    const data = await reconService.getBooksForReconciliation(req.user!.id, month, year);
    res.json({ success: true, data });
  } catch (err) { next(err); }
});

// POST /accounting/reports/gst-recon/2a  — portalData in body
router.post('/reports/gst-recon/2a', shopAuth, async (req, res, next) => {
  try {
    const { month, year, portal_data } = req.body;
    if (!month || !year || !Array.isArray(portal_data)) {
      return res.status(400).json({ success: false, message: 'month, year and portal_data[] required' });
    }
    const data = await reconService.reconcileGst2A(req.user!.id, Number(month), Number(year), portal_data);
    res.json({ success: true, data });
  } catch (err) { next(err); }
});

// POST /accounting/reports/gst-recon/2b
router.post('/reports/gst-recon/2b', shopAuth, async (req, res, next) => {
  try {
    const { month, year, portal_data } = req.body;
    if (!month || !year || !Array.isArray(portal_data)) {
      return res.status(400).json({ success: false, message: 'month, year and portal_data[] required' });
    }
    const data = await reconService.reconcileGst2B(req.user!.id, Number(month), Number(year), portal_data);
    res.json({ success: true, data });
  } catch (err) { next(err); }
});

// POST /accounting/reports/gst-recon/2a-excel
router.post('/reports/gst-recon/2a-excel', shopAuth, async (req, res, next) => {
  try {
    const { month, year, portal_data } = req.body;
    if (!month || !year || !Array.isArray(portal_data)) {
      return res.status(400).json({ success: false, message: 'month, year and portal_data[] required' });
    }
    const buffer = await reconService.reconcileGst2AExcel(req.user!.id, Number(month), Number(year), portal_data);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=GSTR2A_Recon_${month}_${year}.xlsx`);
    res.send(buffer);
  } catch (err) { next(err); }
});

// POST /accounting/reports/gst-recon/2b-excel
router.post('/reports/gst-recon/2b-excel', shopAuth, async (req, res, next) => {
  try {
    const { month, year, portal_data } = req.body;
    if (!month || !year || !Array.isArray(portal_data)) {
      return res.status(400).json({ success: false, message: 'month, year and portal_data[] required' });
    }
    const buffer = await reconService.reconcileGst2BExcel(req.user!.id, Number(month), Number(year), portal_data);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=GSTR2B_Recon_${month}_${year}.xlsx`);
    res.send(buffer);
  } catch (err) { next(err); }
});

export default router;
