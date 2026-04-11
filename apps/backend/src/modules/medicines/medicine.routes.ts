import { Router } from 'express';
import { searchRateLimiter } from '../../middleware/rateLimit';
import prisma from '../../config/database';
import redis, { RedisKeys } from '../../config/redis';

const router = Router();

// GET /medicines?page=1&q=paracetamol  — paginated catalog list (shop_owner)
router.get('/', async (req, res, next) => {
  try {
    const q = (req.query.q as string) || '';
    const PAGE_SIZE = req.query.pageSize ? Math.min(100, Math.max(1, Number(req.query.pageSize))) : 50;
    const page = Math.max(1, req.query.page ? Number(req.query.page) : 1);
    const skip = (page - 1) * PAGE_SIZE;

    // ── Redis Cache Check ───────────────────────────────────────────────────
    const cacheKey = RedisKeys.medicineSearch(`cat:${q}:${page}:${PAGE_SIZE}`);
    const cached = await redis.get(cacheKey);
    if (cached) return res.json(JSON.parse(cached));

    const where = {
      is_active: true,
      ...(q ? {
        OR: [
          { name: { contains: q, mode: 'insensitive' as const } },
          { generic_name: { contains: q, mode: 'insensitive' as const } },
          { brand_name: { contains: q, mode: 'insensitive' as const } },
        ],
      } : {}),
    };

    const [medicines, total] = await Promise.all([
      prisma.medicine.findMany({
        where,
        select: { id: true, name: true, generic_name: true, brand_name: true, form: true, strength: true, manufacturer: true, gst_rate: true, is_schedule_h: true, hsn_code: true },
        orderBy: { name: 'asc' },
        skip,
        take: PAGE_SIZE,
      }),
      prisma.medicine.count({ where }),
    ]);

    const result = {
      success: true,
      data: medicines,
      pagination: { page, pageSize: PAGE_SIZE, total, totalPages: Math.ceil(total / PAGE_SIZE) },
    };

    // Store in Redis (1 hour)
    await redis.setex(cacheKey, 3600, JSON.stringify(result));
    
    res.json(result);
  } catch (err) { next(err); }
});

// GET /medicines/composition-search?q=Crocin&shop_id=xxx
// Finds all medicines sharing the same generic composition
router.get('/composition-search', searchRateLimiter, async (req, res, next) => {
  try {
    const q = (req.query.q as string || '').trim();
    const shopId = req.query.shop_id as string | undefined;
    if (!q || q.length < 2) {
      res.json({ success: true, data: { query: q, generic_name: null, alternatives: [] } });
      return;
    }

    // Step 1: find any matching medicine to extract its generic_name
    const matched = await prisma.medicine.findFirst({
      where: {
        is_active: true,
        OR: [
          { name: { contains: q, mode: 'insensitive' } },
          { brand_name: { contains: q, mode: 'insensitive' } },
          { generic_name: { contains: q, mode: 'insensitive' } },
        ],
      },
      select: { generic_name: true, name: true },
    });

    if (!matched || !matched.generic_name) {
      // If no generic_name found, return a simple name-based search result
      const results = await prisma.medicine.findMany({
        where: {
          is_active: true,
          OR: [
            { name: { contains: q, mode: 'insensitive' } },
            { brand_name: { contains: q, mode: 'insensitive' } },
          ],
        },
        select: { id: true, name: true, generic_name: true, brand_name: true, form: true, strength: true, manufacturer: true, gst_rate: true, is_schedule_h: true },
        take: 20,
      });
      res.json({ success: true, data: { query: q, generic_name: null, alternatives: results.map(m => ({ ...m, is_in_stock: false })) } });
      return;
    }

    // Step 2: find all medicines with the same generic_name
    const alternatives = await prisma.medicine.findMany({
      where: {
        is_active: true,
        generic_name: { contains: matched.generic_name, mode: 'insensitive' },
      },
      select: { id: true, name: true, generic_name: true, brand_name: true, form: true, strength: true, manufacturer: true, gst_rate: true, is_schedule_h: true },
      orderBy: { name: 'asc' },
      take: 50,
    });

    // Step 3: if shop_id provided, check which are in the shop's inventory
    let inventoryNames = new Set<string>();
    if (shopId) {
      const inv = await prisma.shopInventory.findMany({
        where: { shop_id: shopId, stock_qty: { gt: 0 } },
        select: { medicine_name: true },
      });
      inventoryNames = new Set(inv.map(i => i.medicine_name.toLowerCase()));
    }

    const result = alternatives.map(m => ({
      ...m,
      is_in_stock: shopId
        ? inventoryNames.has(m.name.toLowerCase()) || inventoryNames.has((m.brand_name || '').toLowerCase())
        : null,
    }));

    res.json({
      success: true,
      data: {
        query: q,
        generic_name: matched.generic_name,
        alternatives: result,
      },
    });
  } catch (err) { next(err); }
});

// GET /medicines/search?q=paracetamol
router.get('/search', searchRateLimiter, async (req, res, next) => {
  try {
    const q = (req.query.q as string) || '';

    // ── Redis Cache Check ───────────────────────────────────────────────────
    const cacheKey = RedisKeys.medicineSearch(`quick:${q}`);
    const cached = await redis.get(cacheKey);
    if (cached) return res.json(JSON.parse(cached));

    const medicines = await prisma.medicine.findMany({
      where: {
        is_active: true,
        OR: [
          { name: { contains: q, mode: 'insensitive' } },
          { generic_name: { contains: q, mode: 'insensitive' } },
          { brand_name: { contains: q, mode: 'insensitive' } },
        ],
      },
      take: 30,
      select: { id: true, name: true, generic_name: true, brand_name: true, form: true, strength: true, is_schedule_h: true },
    });

    const result = { success: true, data: medicines };
    await redis.setex(cacheKey, 3600, JSON.stringify(result));
    
    res.json(result);
  } catch (err) { next(err); }
});

// GET /medicines/availability?name=Crocin&pincode=411001
// Also accepts: ?medicine=Crocin&pin_code=411001  (mobile client format)
router.get('/availability', searchRateLimiter, async (req, res, next) => {
  try {
    const name = ((req.query.name ?? req.query.medicine) as string) || '';
    const pincode = (req.query.pincode ?? req.query.pin_code) as string | undefined;

    const inventory = await prisma.shopInventory.findMany({
      where: {
        medicine_name: { contains: name, mode: 'insensitive' },
        stock_qty: { gt: 0 },
        ...(pincode && { shop: { pin_code: pincode } }),
      },
      include: {
        shop: {
          select: { id: true, shop_name: true, address_line: true, city: true, pin_code: true, contact_phone: true, latitude: true, longitude: true },
        },
      },
      orderBy: { stock_qty: 'desc' },
      take: 20,
    });

    const result = inventory.map((i) => ({
      shop_name: i.shop.shop_name,
      shop_id: i.shop.id,
      address: i.shop.address_line,
      city: i.shop.city,
      contact: i.shop.contact_phone,
      latitude: i.shop.latitude,
      longitude: i.shop.longitude,
      stock_qty: i.stock_qty,
      mrp: i.mrp,
      unit: i.unit,
    }));

    res.json({ success: true, data: result });
  } catch (err) { next(err); }
});

// POST /medicines/check-interactions — Check drug-drug interactions for a list of medicines
// Accepts: { medicine_names: string[] }  (can be brand names or generic names)
router.post('/check-interactions', async (req, res, next) => {
  try {
    const { medicine_names } = req.body;
    if (!Array.isArray(medicine_names) || medicine_names.length < 2) {
      return res.json({ success: true, data: { interactions: [], safe: true } });
    }

    // 1. Resolve each name to its generic_name from the medicines catalog
    const resolved = await Promise.all(
      medicine_names.map(async (name: string) => {
        const med = await prisma.medicine.findFirst({
          where: {
            is_active: true,
            OR: [
              { name: { contains: name.trim(), mode: 'insensitive' } },
              { brand_name: { contains: name.trim(), mode: 'insensitive' } },
              { generic_name: { contains: name.trim(), mode: 'insensitive' } },
            ],
          },
          select: { id: true, name: true, generic_name: true, brand_name: true, is_schedule_h: true },
        });
        return { input: name, found: med };
      })
    );

    const generics = resolved
      .map(r => r.found?.generic_name?.toLowerCase().trim())
      .filter(Boolean) as string[];

    // 2. Curated interaction rules (expanded Indian pharma context)
    // Format: { pair: [generic_a_keyword, generic_b_keyword], severity, message }
    const INTERACTION_RULES = [
      // ── NSAIDs & Anticoagulants ──────────────────────────────────────────────
      { pair: ['aspirin', 'warfarin'], severity: 'HIGH', message: 'Aspirin + Warfarin: High bleeding risk. Avoid combination; monitor INR closely.' },
      { pair: ['ibuprofen', 'warfarin'], severity: 'HIGH', message: 'Ibuprofen + Warfarin: Increased bleeding risk. Use paracetamol instead.' },
      { pair: ['diclofenac', 'warfarin'], severity: 'HIGH', message: 'Diclofenac + Warfarin: Potentiates anticoagulant effect. Monitor closely.' },
      // ── Antibiotics ──────────────────────────────────────────────────────────
      { pair: ['metronidazole', 'alcohol'], severity: 'HIGH', message: 'Metronidazole reacts with alcohol causing severe nausea and vomiting. Advise no alcohol.' },
      { pair: ['ciprofloxacin', 'antacid'], severity: 'MODERATE', message: 'Antacids reduce ciprofloxacin absorption. Take 2 hours apart.' },
      { pair: ['azithromycin', 'antacid'], severity: 'LOW', message: 'Antacids may slightly reduce azithromycin absorption. Take separately.' },
      { pair: ['doxycycline', 'antacid'], severity: 'MODERATE', message: 'Calcium/Mg antacids chelate doxycycline, reducing efficacy. Take 2-3 hours apart.' },
      // ── Cardiac ──────────────────────────────────────────────────────────────
      { pair: ['digoxin', 'amiodarone'], severity: 'HIGH', message: 'Amiodarone inhibits digoxin clearance. Risk of digoxin toxicity — reduce digoxin dose.' },
      { pair: ['metoprolol', 'verapamil'], severity: 'HIGH', message: 'Combined beta-blocker + CCB can cause severe bradycardia and heart block.' },
      { pair: ['atenolol', 'verapamil'], severity: 'HIGH', message: 'Combined beta-blocker + verapamil risk of AV block and cardiac failure.' },
      { pair: ['amlodipine', 'simvastatin'], severity: 'MODERATE', message: 'Amlodipine increases simvastatin exposure 1.4–1.6x. Limit simvastatin to 20mg/day.' },
      // ── Diabetes ─────────────────────────────────────────────────────────────
      { pair: ['metformin', 'alcohol'], severity: 'HIGH', message: 'Metformin + heavy alcohol use increases lactic acidosis risk. Warn patient.' },
      { pair: ['glimepiride', 'fluconazole'], severity: 'HIGH', message: 'Fluconazole increases glimepiride levels causing severe hypoglycemia.' },
      { pair: ['glibenclamide', 'fluconazole'], severity: 'HIGH', message: 'Fluconazole inhibits glibenclamide metabolism — profound hypoglycemia risk.' },
      // ── CNS ──────────────────────────────────────────────────────────────────
      { pair: ['tramadol', 'ssri'], severity: 'HIGH', message: 'Tramadol + SSRIs risk serotonin syndrome. Avoid or monitor extremely closely.' },
      { pair: ['tramadol', 'sertraline'], severity: 'HIGH', message: 'Tramadol + sertraline: Serotonin syndrome and seizure risk.' },
      { pair: ['tramadol', 'fluoxetine'], severity: 'HIGH', message: 'Tramadol + fluoxetine: Serotoninergic crisis risk. Use alternative analgesic.' },
      { pair: ['clonazepam', 'alcohol'], severity: 'HIGH', message: 'Benzodiazepine + alcohol: CNS/respiratory depression. Strictly avoid.' },
      { pair: ['alprazolam', 'alcohol'], severity: 'HIGH', message: 'Alprazolam + alcohol: Severe respiratory depression. Contraindicated.' },
      // ── Steroids ─────────────────────────────────────────────────────────────
      { pair: ['dexamethasone', 'ibuprofen'], severity: 'MODERATE', message: 'Corticosteroid + NSAID: Increased risk of GI ulceration and bleeding.' },
      { pair: ['prednisolone', 'aspirin'], severity: 'MODERATE', message: 'Prednisolone reduces salicylate levels; discontinuation may cause toxicity.' },
      // ── Schedule H drugs ─────────────────────────────────────────────────────
      { pair: ['phenytoin', 'carbamazepine'], severity: 'MODERATE', message: 'Both induce CYP450 — mutual reduction in plasma levels. Monitor levels.' },
      { pair: ['phenytoin', 'warfarin'], severity: 'HIGH', message: 'Phenytoin can both inhibit and induce warfarin metabolism — unpredictable INR.' },
      // ── Antifungals ──────────────────────────────────────────────────────────
      { pair: ['ketoconazole', 'simvastatin'], severity: 'HIGH', message: 'Ketoconazole greatly increases simvastatin plasma levels — myopathy/rhabdomyolysis risk.' },
      { pair: ['fluconazole', 'simvastatin'], severity: 'HIGH', message: 'Fluconazole increases simvastatin AUC ~5-fold. Risk of rhabdomyolysis.' },
      // ── Antihistamines ───────────────────────────────────────────────────────
      { pair: ['cetirizine', 'alcohol'], severity: 'MODERATE', message: 'Cetirizine + alcohol can worsen sedation. Warn patients who drive.' },
      { pair: ['chlorpheniramine', 'alcohol'], severity: 'MODERATE', message: 'First-gen antihistamine + alcohol: Excessive sedation.' },
    ];

    // 3. Check each pair of generics against rules
    const interactions: { medicine_a: string; medicine_b: string; severity: string; message: string }[] = [];

    for (let i = 0; i < generics.length; i++) {
      for (let j = i + 1; j < generics.length; j++) {
        const a = generics[i];
        const b = generics[j];

        for (const rule of INTERACTION_RULES) {
          const [ruleA, ruleB] = rule.pair;
          const matchesAB = a.includes(ruleA) && b.includes(ruleB);
          const matchesBA = b.includes(ruleA) && a.includes(ruleB);

          if (matchesAB || matchesBA) {
            // Resolve back to original input names for display
            const nameA = resolved.find(r => r.found?.generic_name?.toLowerCase().trim() === a)?.input ?? a;
            const nameB = resolved.find(r => r.found?.generic_name?.toLowerCase().trim() === b)?.input ?? b;
            interactions.push({ medicine_a: nameA, medicine_b: nameB, ...rule });
          }
        }
      }
    }

    // 4. Also flag Schedule H combinations
    const scheduleHMeds = resolved.filter(r => r.found?.is_schedule_h).map(r => r.input);

    const hasCritical = interactions.some(i => i.severity === 'HIGH');

    res.json({
      success: true,
      data: {
        interactions,
        schedule_h_medicines: scheduleHMeds,
        safe: interactions.length === 0,
        has_critical: hasCritical,
        resolved_medicines: resolved.map(r => ({
          input: r.input,
          name: r.found?.name ?? null,
          generic_name: r.found?.generic_name ?? null,
          is_schedule_h: r.found?.is_schedule_h ?? false,
          not_found: !r.found,
        })),
      },
    });
  } catch (err) { next(err); }
});

// GET /medicines/:id
router.get('/:id', async (req, res, next) => {
  try {
    const medicine = await prisma.medicine.findUnique({ where: { id: req.params.id } });
    if (!medicine) { res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Medicine not found' } }); return; }
    res.json({ success: true, data: medicine });
  } catch (err) { next(err); }
});

export default router;
