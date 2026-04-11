import { Router, Request, Response } from 'express';
import { Server } from 'socket.io';
import { authenticate } from '../../middleware/auth';

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

    // Target the specific shop room. 
    // Shop_id can come from body or user's active shop session
    const targetShopId = shop_id || user.shop_id; 

    if (!targetShopId) {
      return res.status(400).json({ status: 'error', message: 'Shop session required' });
    }

    // Emit event to all web clients joined in this shop's room
    io.to(`shop:${targetShopId}`).emit('item_scanned', { 
      barcode, 
      scanned_by: user.name || user.id,
      timestamp: new Date()
    });

    res.json({ status: 'success', message: 'Barcode transmitted to POS' });
  } catch (error) {
    console.error('Remote scan error:', error);
    res.status(500).json({ status: 'error', message: 'Internal server error during remote scan' });
  }
});

export default router;
