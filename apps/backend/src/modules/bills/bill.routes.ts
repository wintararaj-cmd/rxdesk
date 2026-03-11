import { Router } from 'express';
import { requireRole } from '../../middleware/auth';
import * as service from './bill.service';

const router = Router();

// GET /bills  (list / search / filter)
router.get('/', requireRole('shop_owner'), async (req, res, next) => {
  try {
    const data = await service.listBills(req.user!.id, {
      page: req.query.page ? parseInt(req.query.page as string, 10) : undefined,
      limit: req.query.limit ? parseInt(req.query.limit as string, 10) : undefined,
      search: req.query.search as string | undefined,
      status: req.query.status as string | undefined,
      payment_method: req.query.payment_method as string | undefined,
      from_date: req.query.from_date as string | undefined,
      to_date: req.query.to_date as string | undefined,
      sort: req.query.sort as string | undefined,
      order: req.query.order as 'asc' | 'desc' | undefined,
    });
    res.json({ success: true, data });
  } catch (err) { next(err); }
});

// GET /bills/stats  (summary stats for dashboard cards)
router.get('/stats', requireRole('shop_owner'), async (req, res, next) => {
  try {
    const data = await service.getBillStats(
      req.user!.id,
      req.query.from_date as string | undefined,
      req.query.to_date as string | undefined,
    );
    res.json({ success: true, data });
  } catch (err) { next(err); }
});

// POST /bills/manual  (walk-in / takeaway bill — no prescription required)
router.post('/manual', requireRole('shop_owner'), async (req, res, next) => {
  try {
    const bill = await service.createManualBill(req.user!.id, req.body);
    res.status(201).json({ success: true, data: bill, message: 'Bill created' });
  } catch (err) { next(err); }
});

// POST /bills/from-prescription/:prescriptionId
router.post('/from-prescription/:prescriptionId', requireRole('shop_owner'), async (req, res, next) => {
  try {
    const bill = await service.generateBillFromPrescription(
      req.params.prescriptionId, req.user!.id, req.body
    );
    res.status(201).json({ success: true, data: bill, message: 'Bill generated' });
  } catch (err) { next(err); }
});

// GET /bills/customers/search?phone=...  (typeahead for known customers)
router.get('/customers/search', requireRole('shop_owner'), async (req, res, next) => {
  try {
    const phone = ((req.query.phone as string) ?? '').trim();
    if (phone.length < 3) return res.json({ success: true, data: [] });
    const data = await service.searchCustomersByPhone(req.user!.id, phone);
    res.json({ success: true, data });
  } catch (err) { next(err); }
});

// GET /bills/:id
router.get('/:id', requireRole('patient', 'shop_owner', 'admin'), async (req, res, next) => {
  try {
    const bill = await service.getBillById(req.params.id, req.user!.id, req.user!.role);
    res.json({ success: true, data: bill });
  } catch (err) { next(err); }
});

// PATCH /bills/:id/pay  (mobile uses this alias)
router.patch('/:id/pay', requireRole('shop_owner'), async (req, res, next) => {
  try {
    const { payment_method } = req.body as { payment_method: 'cash' | 'upi' | 'card' | 'credit' };
    const bill = await service.markBillPaid(req.params.id, req.user!.id, payment_method);
    res.json({ success: true, data: bill, message: 'Payment recorded' });
  } catch (err) { next(err); }
});

// PATCH /bills/:id/payment  (original route kept for compatibility)
router.patch('/:id/payment', requireRole('shop_owner'), async (req, res, next) => {
  try {
    const { payment_method } = req.body as { payment_method: 'cash' | 'upi' | 'card' | 'credit' };
    const bill = await service.markBillPaid(req.params.id, req.user!.id, payment_method);
    res.json({ success: true, data: bill, message: 'Payment recorded' });
  } catch (err) { next(err); }
});

export default router;
