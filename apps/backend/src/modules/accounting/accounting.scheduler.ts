import cron from 'node-cron';
import path from 'path';
import fs from 'fs/promises';
import prisma from '../../config/database';
import { exportAccountingData } from './accounting.service';
import logger from '../../utils/logger';

// Backup root directory as requested: /rxdesk
// path.resolve('/') on Windows usually gives the current drive root (e.g. E:\)
const BACKUP_ROOT = path.resolve('/rxdesk');

export function initAccountingScheduler() {
  // Check every minute if any shop needs a backup
  // Pattern: * * * * * (At every minute)
  cron.schedule('* * * * *', async () => {
    const now = new Date();
    // Use HH:mm format (24h) for matching
    const currentTime = now.toLocaleString('en-GB', { 
      hour: '2-digit', 
      minute: '2-digit', 
      timeZone: 'Asia/Kolkata' // Default shop timezone based on context
    });
    
    try {
      const shops = await prisma.medicalShop.findMany({
        where: {
          auto_backup_enabled: true,
          backup_time: currentTime,
        },
      });

      if (shops.length > 0) {
        logger.info(`[AccountingScheduler] Starting auto-backups for ${shops.length} shop(s) scheduled at ${currentTime}`);
      }

      for (const shop of shops) {
        await performAutoBackup(shop);
      }
    } catch (err) {
      logger.error('[AccountingScheduler] Error during scheduled check:', err);
    }
  });
  
  logger.info('Accounting Scheduler: Daily auto-backup monitor is active');
}

async function performAutoBackup(shop: any) {
  try {
    const data = await exportAccountingData(shop.owner_user_id);
    // Sanitize shop name for folder creation
    const sanitizedName = (shop.shop_name || 'shop').replace(/[^a-z0-9]/gi, '_').toLowerCase();
    
    // Resolve backup path: use shop.backup_path if available, otherwise fallback to /rxdesk
    const customPath = (shop.backup_path || '/rxdesk').trim();
    // On Windows, /rxdesk resolves to the root of the current drive. 
    // If the user provides a full path like D:\Backups, path.resolve will preserve it.
    const resolvedRoot = path.isAbsolute(customPath) ? customPath : path.resolve(customPath);
    const shopFolder = path.join(resolvedRoot, sanitizedName);
    
    // Ensure shop folder exists
    await fs.mkdir(shopFolder, { recursive: true });
    
    // Create timestamped filename
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const fileName = `rxdesk_backup_${timestamp}.json`;
    const filePath = path.join(shopFolder, fileName);
    
    // Write backup data
    await fs.writeFile(filePath, JSON.stringify(data, null, 2));
    logger.info(`[AccountingScheduler] Auto-backup successful: ${shop.shop_name} -> ${filePath}`);
    
    // Cleanup: Keep only the 3 most recent backups
    const files = await fs.readdir(shopFolder);
    const backups = files
      .filter(f => f.startsWith('rxdesk_backup_') && f.endsWith('.json'))
      .sort((a, b) => b.localeCompare(a)); // Sort descending (newest first)
    
    if (backups.length > 3) {
      const toDelete = backups.slice(3);
      for (const f of toDelete) {
        const delPath = path.join(shopFolder, f);
        await fs.unlink(delPath);
      }
      logger.info(`[AccountingScheduler] Cleaned up ${toDelete.length} old backup(s) for ${shop.shop_name}`);
    }
  } catch (err) {
    logger.error(`[AccountingScheduler] Auto-backup FAILED for ${shop.shop_name}:`, err);
  }
}
