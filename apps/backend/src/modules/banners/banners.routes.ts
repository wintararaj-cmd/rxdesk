import { Router } from 'express';
import { requireRole } from '../../middleware/auth';
import * as service from './banners.service';
import { upload, processFile } from '../../utils/upload';
import { AppError } from '../../middleware/errorHandler';

const router = Router();

// GET /banners (public)
router.get('/', async (_req, res, next) => {
    try {
        const banners = await service.getAllBanners(true);
        res.json({ success: true, data: banners });
    } catch (err) { next(err); }
});

// GET /banners/all (admin)
router.get('/all', requireRole('admin'), async (_req, res, next) => {
    try {
        const banners = await service.getAllBanners(false);
        res.json({ success: true, data: banners });
    } catch (err) { next(err); }
});

// POST /banners (admin) — Handles both file upload and link creation
router.post('/', requireRole('admin'), upload.single('image'), async (req, res, next) => {
    try {
        let imageUrl = req.body.image_url;

        // If a file is uploaded, process it
        if (req.file) {
            imageUrl = await processFile(req.file, 'banners');
        }

        if (!imageUrl) {
            throw new AppError(400, 'VALIDATION_ERROR', 'Image is required');
        }

        const { title, link_url, is_active, sort_order } = req.body;

        const banner = await service.createBanner({
            title,
            image_url: imageUrl,
            link_url,
            is_active: is_active === 'true' || is_active === true,
            sort_order: parseInt(sort_order ?? '0'),
        });

        res.status(201).json({ success: true, data: banner });
    } catch (err) { next(err); }
});

// PATCH /banners/:id (admin)
router.patch('/:id', requireRole('admin'), upload.single('image'), async (req, res, next) => {
    try {
        let imageUrl = req.body.image_url;

        // If a file is uploaded, process it
        if (req.file) {
            imageUrl = await processFile(req.file, 'banners');
        }

        const { title, link_url, is_active, sort_order } = req.body;

        const banner = await service.updateBanner(req.params.id, {
            title,
            ...(imageUrl && { image_url: imageUrl }),
            link_url,
            ...(is_active !== undefined && { is_active: is_active === 'true' || is_active === true }),
            ...(sort_order !== undefined && { sort_order: parseInt(sort_order) }),
        });

        res.json({ success: true, data: banner });
    } catch (err) { next(err); }
});

// DELETE /banners/:id (admin)
router.delete('/:id', requireRole('admin'), async (req, res, next) => {
    try {
        await service.deleteBanner(req.params.id);
        res.json({ success: true, message: 'Banner deleted successfully' });
    } catch (err) { next(err); }
});

export default router;
