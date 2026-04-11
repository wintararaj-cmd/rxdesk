import { Router, Request, Response } from 'express';
import { Server } from 'socket.io';
import { authenticate } from '../../middleware/auth';
import prisma from '../../config/database';
import logger from '../../utils/logger';

const router = Router();

/**
 * Remote Scanner Bridge
 * Mobile app calls this to push a scanned barcode to the web app in real-time
 */
router.post('/scan', authenticate, async (req: Request, res: Response) => {
  try {
    const { barcode, shop_id } = req.body;
    const user = (req as any).user;
    const io: Server = req.app.get('io');

    if (!barcode) {
      return res.status(400).json({ status: 'error', message: 'Barcode is required' });
    }

    let targetShopId = shop_id || user.shop_id; 

    // Auto-resolve shop ID if not present in token or body
    if (!targetShopId) {
      const shop = await prisma.medicalShop.findFirst({
        where: { owner_user_id: user.id },
        select: { id: true }
      });
      if (shop) targetShopId = shop.id;
    }

    if (!targetShopId) {
      logger.error(`WS: Failed to resolve shop for user ${user.id}`);
      return res.status(400).json({ status: 'error', message: 'Shop session required. Please ensure you are logged in as a shop owner.' });
    }

    // Emit event to target shop room (for all staff in that shop)
    io.to(`shop:${targetShopId}`).emit('item_scanned', { 
      barcode, 
      scanned_by: user.name || user.id,
      timestamp: new Date()
    });

    // Also emit directly to the current user's room (for redundancy)
    io.to(`user:${user.id}`).emit('item_scanned', { 
      barcode, 
      scanned_by: 'You (Mobile)',
      timestamp: new Date()
    });

    res.json({ status: 'success', message: 'Barcode transmitted to POS' });
  } catch (error) {
    logger.error('Remote scan error:', error);
    res.status(500).json({ status: 'error', message: 'Internal server error during remote scan' });
  }
});

export default router;
