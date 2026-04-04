import cron from 'node-cron';
import prisma from '../../config/database';
import logger from '../../utils/logger';
import { sendSubscriptionReminderSms } from '../../utils/smsService';
import { startOfDay, endOfDay, addDays } from 'date-fns';

/**
 * Checks for expiring subscriptions and sends SMS & Notification alerts.
 * Targets: 3 days before expiry, and 1 day before expiry.
 */
export function startSubscriptionReminderCron() {
  // Run daily at 09:00 AM
  cron.schedule('0 9 * * *', async () => {
    logger.info('Starting daily Subscription Reminder Cron Job...');
    try {
      await processReminders(3); // 3 days before
      await processReminders(1); // 1 day before
    } catch (error) {
      logger.error(`Error in Subscription Reminder Cron Job: ${error}`);
    }
  });
}

async function processReminders(daysLeft: number) {
  const targetDate = addDays(new Date(), daysLeft);
  const startTarget = startOfDay(targetDate);
  const endTarget = endOfDay(targetDate);

  // 1. Process Trial Subscriptions
  const trialSubscriptions = await prisma.shopSubscription.findMany({
    where: {
      status: 'trial',
      trial_ends_at: {
        gte: startTarget,
        lte: endTarget,
      },
    },
    include: {
      shop: {
        include: { owner: true }
      }
    }
  });

  for (const sub of trialSubscriptions) {
    await sendAlert(sub.shop, 'trial', daysLeft);
  }

  // 2. Process Active/Premium Subscriptions
  const activeSubscriptions = await prisma.shopSubscription.findMany({
    where: {
      status: 'active',
      current_period_end: {
        gte: startTarget,
        lte: endTarget,
      },
    },
    include: {
      shop: {
        include: { owner: true }
      }
    }
  });

  for (const sub of activeSubscriptions) {
    await sendAlert(sub.shop, 'active', daysLeft);
  }

  logger.info(`Processed reminders for ${daysLeft} days left. (Trials: ${trialSubscriptions.length}, Active: ${activeSubscriptions.length})`);
}

async function sendAlert(shop: any, type: 'trial' | 'active', daysLeft: number) {
  const actionText = type === 'trial' ? 'recharge your account' : 'renew your subscription';
  const timeText = daysLeft === 1 ? 'tomorrow' : `in ${daysLeft} days`;
  const messageBody = `Your ${type === 'trial' ? 'trial' : 'premium'} plan expires ${timeText}. Please ${actionText} to keep using RxDesk without interruption.`;

  // Prevent duplicate notifications sent on the same day for the same shop
  const todayStart = startOfDay(new Date());
  
  const existingNotif = await prisma.notification.findFirst({
    where: {
      user_id: shop.owner_user_id,
      category: 'subscription_expiry',
      created_at: { gte: todayStart }
    }
  });

  if (existingNotif) {
    return; // Already sent an alert to this owner today
  }

  // 1. Create In-App Notification (which shows on dashboard Bell)
  await prisma.notification.create({
    data: {
      user_id: shop.owner_user_id,
      type: 'sms', // Represents the primary method we used, although it shows in-app too
      category: 'subscription_expiry',
      title: 'Subscription Expiring Soon',
      body: messageBody,
      reference_id: shop.id,
      reference_type: 'medical_shop',
    }
  });

  // 2. Send actual SMS
  if (shop.owner.phone) {
    await sendSubscriptionReminderSms(shop.owner.phone, shop.shop_name, type, daysLeft);
  }
}
