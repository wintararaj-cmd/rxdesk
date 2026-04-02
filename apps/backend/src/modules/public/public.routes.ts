import { Router } from 'express';
import * as service from './public.service';

const router = Router();

// GET /api/v1/public/seo-metadata
router.get('/seo-metadata', async (req, res, next) => {
  try {
    const data = await service.getSEOMetadata();
    res.json({ success: true, data });
  } catch (err) { next(err); }
});

export default router;
