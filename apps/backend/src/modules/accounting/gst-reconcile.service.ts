import prisma from '../../config/database';
import { AppError } from '../../middleware/errorHandler';
import ExcelJS from 'exceljs';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function num(v: any): number {
  const n = parseFloat(String(v));
  return isNaN(n) ? 0 : n;
}

function normDoc(s: string): string {
  return s.replace(/[\s\-/]/g, '').toUpperCase().replace(/O/g, '0');
}

function docsMatch(a: string, b: string): boolean {
  if (!a || !b || a === '-' || b === '-') return false;
  const an = normDoc(a), bn = normDoc(b);
  return an === bn || an.endsWith(bn) || bn.endsWith(an) || an.startsWith(bn) || bn.startsWith(an);
}

function fmtDate(d: any): string {
  if (!d) return '-';
  try {
    const dt = d instanceof Date ? d : new Date(d);
    return `${String(dt.getDate()).padStart(2,'0')}/${String(dt.getMonth()+1).padStart(2,'0')}/${dt.getFullYear()}`;
  } catch { return String(d); }
}

async function getShop(userId: string) {
  const shop = await prisma.medicalShop.findUnique({ where: { owner_user_id: userId } });
  if (!shop) throw new AppError(403, 'FORBIDDEN', 'Only shop owners can access accounting');
  return shop;
}

// ─── Fetch Books from DB ───────────────────────────────────────────────────────

export async function getBooksForReconciliation(userId: string, month: number, year: number) {
  const shop = await getShop(userId);
  const start = new Date(year, month - 1, 1);
  const end   = new Date(year, month, 0, 23, 59, 59);

  const [purchases, purchaseReturns] = await Promise.all([
    prisma.purchaseEntry.findMany({
      where: { shop_id: shop.id, invoice_date: { gte: start, lte: end } },
      include: { supplier: true, items: true },
    }),
    prisma.purchaseReturn.findMany({
      where: { shop_id: shop.id, return_date: { gte: start, lte: end } },
      include: { supplier: true, items: true },
    }),
  ]);

  const shopStateCode = shop.state ? shop.state.substring(0, 2).toUpperCase() : '';

  const books: any[] = [];

  for (const p of purchases) {
    if (!p.supplier?.gst_number) continue; // skip unregistered
    const totalLine = p.items.reduce((s, i) => s + num(i.line_total), 0);
    const totalGstRate = p.items.reduce((s, i) => s + num(i.gst_rate) * num(i.line_total), 0) / (totalLine || 1);
    const taxable = totalLine / (1 + totalGstRate / 100);
    const gstAmt = totalLine - taxable;
    const supplierState = p.supplier.state ? p.supplier.state.substring(0, 2).toUpperCase() : '';
    const isInterState = supplierState && shopStateCode && supplierState !== shopStateCode;

    books.push({
      date: p.invoice_date,
      name: p.supplier.name,
      gstin: p.supplier.gst_number,
      doc_no: p.invoice_number || '',
      vch_type: 'Purchase',
      inv_type: 'Regular',
      pos: supplierState || shopStateCode,
      rcm: 'N',
      taxable: Math.round(taxable * 100) / 100,
      igst: isInterState ? Math.round(gstAmt * 100) / 100 : 0,
      cgst: isInterState ? 0 : Math.round((gstAmt / 2) * 100) / 100,
      sgst: isInterState ? 0 : Math.round((gstAmt / 2) * 100) / 100,
      cess: 0,
      inv_val: Math.round(num(p.total_amount) * 100) / 100,
      itc_avail: 'Inputs',
    });
  }

  for (const r of purchaseReturns) {
    if (!r.supplier?.gst_number) continue;
    const totalLine = r.items.reduce((s, i) => s + num(i.line_total), 0);
    const totalGstRate = r.items.reduce((s, i) => s + num(i.gst_rate) * num(i.line_total), 0) / (totalLine || 1);
    const taxable = totalLine / (1 + totalGstRate / 100);
    const gstAmt = totalLine - taxable;
    const supplierState = r.supplier.state ? r.supplier.state.substring(0, 2).toUpperCase() : '';
    const isInterState = supplierState && shopStateCode && supplierState !== shopStateCode;

    books.push({
      date: r.return_date,
      name: r.supplier.name,
      gstin: r.supplier.gst_number,
      doc_no: r.invoice_ref || r.return_number || '',
      vch_type: 'Debit/Credit Note',
      inv_type: 'Regular',
      pos: supplierState || shopStateCode,
      rcm: 'N',
      taxable: Math.round(taxable * 100) / 100,
      igst: isInterState ? Math.round(gstAmt * 100) / 100 : 0,
      cgst: isInterState ? 0 : Math.round((gstAmt / 2) * 100) / 100,
      sgst: isInterState ? 0 : Math.round((gstAmt / 2) * 100) / 100,
      cess: 0,
      inv_val: Math.round(num(r.total_amount) * 100) / 100,
      itc_avail: 'Inputs',
    });
  }

  return books;
}

// ─── 2A Reconciliation ────────────────────────────────────────────────────────

function reconcile2A(books: any[], portal: any[]) {
  const byGstin: Record<string, Array<[number, any]>> = {};
  portal.forEach((pr, pi) => {
    (byGstin[pr.gstin] = byGstin[pr.gstin] || []).push([pi, pr]);
  });
  const used = new Set<number>();
  const results: any[] = [];

  for (const br of books) {
    const cands = (byGstin[br.gstin] || []).filter(([pi, pr]) => !used.has(pi) && docsMatch(br.doc_no, pr.doc_no));
    if (cands.length) {
      const [pi, pr] = cands[0]; used.add(pi);
      const td = round(br.taxable - num(pr.taxable));
      const id_ = round(br.igst - num(pr.igst));
      const cd = round((br.cgst + br.sgst) - (num(pr.cgst) + num(pr.sgst)));
      const csd = round(br.cess - num(pr.cess));
      const vd = round(br.inv_val - num(pr.inv_val));
      const ms = (Math.abs(td) < 1 && Math.abs(id_) < 1 && Math.abs(cd) < 1) ? 'Matched' : 'Partially Matched';
      results.push(makeRow2A(br, pr, td, id_, cd, csd, vd, ms));
    } else {
      results.push(makeRow2A(br, null, br.taxable, br.igst, br.cgst + br.sgst, br.cess, br.inv_val, 'In Books Only'));
    }
  }
  portal.forEach((pr, pi) => {
    if (!used.has(pi)) {
      results.push(makeRow2A(null, pr, -num(pr.taxable), -num(pr.igst), -(num(pr.cgst)+num(pr.sgst)), -num(pr.cess), -num(pr.inv_val), 'In 2A Only'));
    }
  });
  return results;
}

function reconcile2B(books: any[], portal: any[]) {
  const byGstin: Record<string, Array<[number, any]>> = {};
  portal.forEach((pr, pi) => {
    (byGstin[pr.gstin] = byGstin[pr.gstin] || []).push([pi, pr]);
  });
  const used = new Set<number>();
  const results: any[] = [];

  for (const br of books) {
    const cands = (byGstin[br.gstin] || []).filter(([pi, pr]) => !used.has(pi) && docsMatch(br.doc_no, pr.doc_no));
    if (cands.length) {
      const [pi, pr] = cands[0]; used.add(pi);
      const td = round(br.taxable - num(pr.taxable));
      const id_ = round(br.igst - num(pr.igst));
      const cd = round((br.cgst + br.sgst) - (num(pr.cgst) + num(pr.sgst)));
      const csd = round(br.cess - num(pr.cess));
      const vd = round(br.inv_val - num(pr.inv_val));
      const ms = (Math.abs(td) < 1 && Math.abs(id_) < 1 && Math.abs(cd) < 1) ? 'Matched' : 'Partially Matched';
      results.push(makeRow2B(br, pr, td, id_, cd, csd, vd, ms));
    } else {
      results.push(makeRow2B(br, null, br.taxable, br.igst, br.cgst + br.sgst, br.cess, br.inv_val, 'In Books Only'));
    }
  }
  portal.forEach((pr, pi) => {
    if (!used.has(pi)) {
      results.push(makeRow2B(null, pr, -num(pr.taxable), -num(pr.igst), -(num(pr.cgst)+num(pr.sgst)), -num(pr.cess), -num(pr.inv_val), 'In 2B Only'));
    }
  });
  return results;
}

function round(v: number) { return Math.round(v * 100) / 100; }

function makeRow2A(br: any, pr: any, td: number, id_: number, cd: number, csd: number, vd: number, ms: string) {
  const bv = (k: string, d: any = '-') => br ? (br[k] ?? d) : d;
  const pv = (k: string, d: any = '-') => pr ? (pr[k] ?? d) : d;
  return {
    supplier_name: br ? bv('name') : pv('name'),
    gstin: br ? bv('gstin') : pv('gstin'),
    b_doc_no: bv('doc_no'), b_doc_date: fmtDate(bv('date', null)),
    b_taxable: bv('taxable', 0), b_igst: bv('igst', 0),
    b_cgst_sgst: br ? (bv('cgst',0)+bv('sgst',0)) : 0,
    b_cess: bv('cess', 0), b_inv_val: bv('inv_val', 0),
    b_rcm: bv('rcm'), b_itc: bv('itc_avail'),
    p_doc_no: pv('doc_no'), p_doc_date: fmtDate(pv('doc_date', null)),
    p_taxable: pv('taxable', 0), p_igst: pv('igst', 0),
    p_cgst: pv('cgst', 0), p_sgst: pv('sgst', 0),
    p_cess: pv('cess', 0), p_inv_val: pv('inv_val', 0),
    p_rcm: pv('rcm'), p_itc: pv('itc_avail'),
    p_period: pv('period'), p_filing_date: pv('filing_date'),
    p_gstr3b: pv('gstr3b'), p_irn: pv('irn'),
    diff_taxable: td, diff_igst: id_, diff_cgst_sgst: cd, diff_cess: csd, diff_inv_val: vd,
    match_status: ms, remarks: '',
  };
}

function makeRow2B(br: any, pr: any, td: number, id_: number, cd: number, csd: number, vd: number, ms: string) {
  const bv = (k: string, d: any = '-') => br ? (br[k] ?? d) : d;
  const pv = (k: string, d: any = '-') => pr ? (pr[k] ?? d) : d;
  return {
    supplier_name: br ? bv('name') : pv('name'),
    gstin: br ? bv('gstin') : pv('gstin'),
    b_doc_no: bv('doc_no'), b_doc_date: fmtDate(bv('date', null)),
    b_taxable: bv('taxable', 0), b_igst: bv('igst', 0),
    b_cgst_sgst: br ? (bv('cgst',0)+bv('sgst',0)) : 0,
    b_cess: bv('cess', 0), b_inv_val: bv('inv_val', 0),
    b_rcm: bv('rcm'), b_itc: bv('itc_avail'),
    p_doc_no: pv('doc_no'), p_doc_date: fmtDate(pv('doc_date', null)),
    p_taxable: pv('taxable', 0), p_igst: pv('igst', 0),
    p_cgst: pv('cgst', 0), p_sgst: pv('sgst', 0),
    p_cess: pv('cess', 0), p_inv_val: pv('inv_val', 0),
    p_rcm: pv('rcm'), p_itc: pv('itc_avail'),
    p_period: pv('gstr1_period'), p_irn: pv('irn'),
    diff_taxable: td, diff_igst: id_, diff_cgst_sgst: cd, diff_cess: csd, diff_inv_val: vd,
    match_status: ms, remarks: '',
  };
}

// ─── Excel Writer ─────────────────────────────────────────────────────────────

async function writeReconExcel(rows: any[], type: '2A' | '2B', period: string, shopName: string, gstin: string) {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'RxDesk';
  const ws = wb.addWorksheet(`Invoice Wise ${type}`);

  const STATUS_FILLS: Record<string, string> = {
    'Matched':           'FF90EE90',
    'Partially Matched': 'FFFFD700',
    'In Books Only':     'FFFFA500',
    [`In ${type} Only`]: 'FFFF6666',
  };

  // Header rows
  ws.getRow(1).values = ['RxDesk GST Reconciliation', '', '', '', `Type: GSTR-${type}`, '', `Period: ${period}`, '', `Generated: ${new Date().toLocaleDateString('en-IN')}`, '', `Shop: ${shopName}`, '', `GSTIN: ${gstin}`];
  ws.getRow(1).font = { bold: true, size: 12 };

  // Column headers
  const headers = [
    'Supplier Name', 'GSTIN',
    'Books: Doc No', 'Books: Date', 'Books: Taxable', 'Books: IGST', 'Books: CGST+SGST', 'Books: Cess', 'Books: Inv Val', 'Books: RCM', 'Books: ITC',
    `${type}: Doc No`, `${type}: Date`, `${type}: Taxable`, `${type}: IGST`, `${type}: CGST`, `${type}: SGST`, `${type}: Cess`, `${type}: Inv Val`, `${type}: RCM`, `${type}: ITC`, `${type}: Period`,
    'Diff Taxable', 'Diff IGST', 'Diff CGST+SGST', 'Diff Cess', 'Diff Inv Val',
    'Match Status', 'Remarks',
  ];
  const hRow = ws.getRow(3);
  hRow.values = headers;
  hRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  hRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF32719C' } };
  hRow.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
  hRow.height = 32;

  ws.columns = headers.map((h, i) => ({
    key: String(i), width: [28,18,16,14,14,12,14,10,12,8,10,16,14,14,12,12,12,10,12,8,10,12,12,12,14,10,12,14,20][i] || 12,
  }));

  // Data rows
  const numCols = new Set([4,5,6,7,8,13,14,15,16,17,18,22,23,24,25,26]);
  rows.forEach((r, i) => {
    const ms = r.match_status;
    const vals = [
      r.supplier_name, r.gstin,
      r.b_doc_no, r.b_doc_date, r.b_taxable, r.b_igst, r.b_cgst_sgst, r.b_cess, r.b_inv_val, r.b_rcm, r.b_itc,
      r.p_doc_no, r.p_doc_date, r.p_taxable, r.p_igst, r.p_cgst, r.p_sgst, r.p_cess, r.p_inv_val, r.p_rcm, r.p_itc, r.p_period,
      r.diff_taxable, r.diff_igst, r.diff_cgst_sgst, r.diff_cess, r.diff_inv_val,
      ms, r.remarks,
    ];
    const row = ws.getRow(i + 4);
    row.values = vals;
    const fillColor = STATUS_FILLS[ms];
    if (fillColor) {
      row.eachCell(cell => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: fillColor } };
      });
    }
    row.eachCell((cell, colNum) => {
      cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
      if (numCols.has(colNum - 1)) cell.numFmt = '#,##0.00';
    });
  });

  // Summary sheet
  const ws2 = wb.addWorksheet('Summary');
  const statuses = ['Matched', 'Partially Matched', 'In Books Only', `In ${type} Only`];
  ws2.getRow(1).values = ['Match Status', 'Count', 'Books Taxable', 'Books IGST', 'Books CGST+SGST', 'Books Inv Val', `${type} Taxable`, `${type} IGST`, `${type} CGST+SGST`, `${type} Inv Val`, 'Diff Taxable', 'Diff IGST'];
  ws2.getRow(1).font = { bold: true };
  ws2.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFC7D72' } };

  statuses.forEach((st, i) => {
    const filtered = rows.filter(r => r.match_status === st);
    const sumB = (k: string) => filtered.reduce((s, r) => s + num(r[k]), 0);
    ws2.getRow(i + 2).values = [
      st, filtered.length,
      round(sumB('b_taxable')), round(sumB('b_igst')), round(sumB('b_cgst_sgst')), round(sumB('b_inv_val')),
      round(sumB('p_taxable')), round(sumB('p_igst')), round(sumB('p_cgst') + sumB('p_sgst')), round(sumB('p_inv_val')),
      round(sumB('diff_taxable')), round(sumB('diff_igst')),
    ];
  });
  ws2.columns = Array(12).fill(null).map((_, i) => ({ width: i === 0 ? 22 : 15 }));

  return wb.xlsx.writeBuffer();
}

// ─── Main exported functions ──────────────────────────────────────────────────

export async function reconcileGst2A(userId: string, month: number, year: number, portalData: any[]) {
  const books = await getBooksForReconciliation(userId, month, year);
  const results = reconcile2A(books, portalData);
  return results;
}

export async function reconcileGst2B(userId: string, month: number, year: number, portalData: any[]) {
  const books = await getBooksForReconciliation(userId, month, year);
  const results = reconcile2B(books, portalData);
  return results;
}

export async function reconcileGst2AExcel(userId: string, month: number, year: number, portalData: any[]) {
  const shop = await getShop(userId);
  const results = await reconcileGst2A(userId, month, year, portalData);
  const period = `${String(month).padStart(2,'0')}/${year}`;
  return writeReconExcel(results, '2A', period, shop.shop_name, shop.gst_number || '');
}

export async function reconcileGst2BExcel(userId: string, month: number, year: number, portalData: any[]) {
  const shop = await getShop(userId);
  const results = await reconcileGst2B(userId, month, year, portalData);
  const period = `${String(month).padStart(2,'0')}/${year}`;
  return writeReconExcel(results, '2B', period, shop.shop_name, shop.gst_number || '');
}
