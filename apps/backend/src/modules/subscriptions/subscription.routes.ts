import { Router } from 'express';
import crypto from 'crypto';
import axios from 'axios';
import { requireRole } from '../../middleware/auth';
import prisma from '../../config/database';
import { env } from '../../config/env';
import logger from '../../utils/logger';

const router = Router();

// GET /subscriptions/plans  (public)
router.get('/plans', async (_req, res, next) => {
  try {
    const plans = await prisma.subscriptionPlan.findMany({
      where: { is_active: true },
      orderBy: { price_monthly: 'asc' },
    });
    res.json({ success: true, data: plans });
  } catch (err) { next(err); }
});

// GET /subscriptions/current  — shop's current subscription
router.get('/current', requireRole('shop_owner'), async (req, res, next) => {
  try {
    const shop = await prisma.medicalShop.findUnique({ where: { owner_user_id: req.user!.id } });
    if (!shop) { res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Shop not found' } }); return; }

    const subscription = await prisma.shopSubscription.findFirst({
      where: { shop_id: shop.id },
      orderBy: { created_at: 'desc' },
      include: { plan: true },
    });
    res.json({ success: true, data: subscription });
  } catch (err) { next(err); }
});

// POST /subscriptions/subscribe  — create a Razorpay subscription order for a plan
router.post('/subscribe', requireRole('shop_owner'), async (req, res, next) => {
  try {
    const { plan_id } = req.body as { plan_id: string };
    if (!plan_id) { res.status(400).json({ success: false, error: { code: 'VALIDATION', message: 'plan_id is required' } }); return; }

    const plan = await prisma.subscriptionPlan.findUnique({ where: { id: plan_id } });
    if (!plan) { res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Plan not found' } }); return; }

    const shop = await prisma.medicalShop.findUnique({ where: { owner_user_id: req.user!.id } });
    if (!shop) { res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Shop not found' } }); return; }

    const keyId = env.RAZORPAY_KEY_ID;
    const keySecret = env.RAZORPAY_KEY_SECRET;
    const isDevMode = env.NODE_ENV !== 'production' || !keyId || !keySecret;

    if (isDevMode) {
      // Dev/staging mode: activate subscription directly without payment
      const existingSub = await prisma.shopSubscription.findFirst({ where: { shop_id: shop.id } });
      const devSub = existingSub
        ? await prisma.shopSubscription.update({
            where: { id: existingSub.id },
            data: {
              plan_id,
              status: 'active',
              current_period_start: new Date(),
              current_period_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
            },
          })
        : await prisma.shopSubscription.create({
            data: {
              shop_id: shop.id,
              plan_id,
              status: 'active',
              current_period_start: new Date(),
              current_period_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
            },
          });
      res.json({ success: true, data: { dev_mode: true, subscription: devSub }, message: 'Subscription activated (dev mode)' });
      return;
    }

    // Production: use Razorpay
    // 1. Ensure a Razorpay plan exists — store razorpay_plan_id in features JSON
    const features = (plan.features as Record<string, unknown> | null) ?? {};
    let razorpayPlanId = features.razorpay_plan_id as string | undefined;

    if (!razorpayPlanId) {
      try {
        const rzpPlanRes = await axios.post(
          'https://api.razorpay.com/v1/plans',
          {
            period: 'monthly',
            interval: 1,
            item: {
              name: plan.name,
              amount: Math.round(Number(plan.price_monthly) * 100), // paise
              currency: 'INR',
              description: `RxDesk ${plan.name} plan`,
            },
            notes: { rxdesk_plan_id: plan.id },
          },
          { auth: { username: keyId!, password: keySecret! } }
        );
        razorpayPlanId = rzpPlanRes.data.id as string;
        // Persist the razorpay_plan_id in features so we reuse it
        await prisma.subscriptionPlan.update({
          where: { id: plan.id },
          data: { features: { ...features, razorpay_plan_id: razorpayPlanId } },
        });
        logger.info(`Created Razorpay plan ${razorpayPlanId} for RxDesk plan ${plan.id}`);
      } catch (rzpErr: any) {
        const rzpMsg = rzpErr?.response?.data?.error?.description ?? rzpErr?.message ?? 'Razorpay plan creation failed';
        logger.error('Razorpay plan creation error:', rzpErr?.response?.data ?? rzpErr?.message);
        res.status(502).json({ success: false, error: { code: 'RAZORPAY_ERROR', message: rzpMsg } });
        return;
      }
    }

    // 2. Create Razorpay subscription
    let rzpSub: { id: string; short_url: string; status: string };
    try {
      const rzpSubRes = await axios.post(
        'https://api.razorpay.com/v1/subscriptions',
        {
          plan_id: razorpayPlanId,
          total_count: 12, // 12 billing cycles
          quantity: 1,
          notes: { rxdesk_shop_id: shop.id, rxdesk_plan_id: plan.id },
        },
        { auth: { username: keyId!, password: keySecret! } }
      );
      rzpSub = rzpSubRes.data;
    } catch (rzpErr: any) {
      const rzpMsg = rzpErr?.response?.data?.error?.description ?? rzpErr?.message ?? 'Razorpay subscription creation failed';
      logger.error('Razorpay subscription creation error:', rzpErr?.response?.data ?? rzpErr?.message);
      res.status(502).json({ success: false, error: { code: 'RAZORPAY_ERROR', message: rzpMsg } });
      return;
    }

    // 3. Create or update ShopSubscription record as 'pending activation'
    const existingSubProd = await prisma.shopSubscription.findFirst({ where: { shop_id: shop.id } });
    if (existingSubProd) {
      await prisma.shopSubscription.update({
        where: { id: existingSubProd.id },
        data: { plan_id, status: 'trial', razorpay_sub_id: rzpSub.id },
      });
    } else {
      await prisma.shopSubscription.create({
        data: { shop_id: shop.id, plan_id, status: 'trial', razorpay_sub_id: rzpSub.id },
      });
    }

    res.json({
      success: true,
      data: {
        subscription_id: rzpSub.id,
        short_url: rzpSub.short_url,
        key_id: keyId,
        plan: { name: plan.name, price_monthly: plan.price_monthly },
      },
      message: 'Subscription created. Complete payment to activate.',
    });
  } catch (err) { next(err); }
});

// POST /subscriptions/webhook  — Razorpay webhook
router.post('/webhook', async (req, res) => {
  const webhookSecret = env.RAZORPAY_WEBHOOK_SECRET;

  // If secret is configured, verify signature; otherwise accept (dev mode)
  if (webhookSecret) {
    const signature = req.headers['x-razorpay-signature'] as string | undefined;
    if (!signature) {
      res.status(400).json({ error: 'Missing x-razorpay-signature header' });
      return;
    }
    const rawBody: Buffer | undefined = (req as any).rawBody;
    if (!rawBody) {
      res.status(400).json({ error: 'Raw body unavailable' });
      return;
    }
    const expected = crypto
      .createHmac('sha256', webhookSecret)
      .update(rawBody)
      .digest('hex');
    if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) {
      logger.warn('Razorpay webhook: invalid signature');
      res.status(400).json({ error: 'Invalid signature' });
      return;
    }
  }

  const event = req.body as { event: string; payload: Record<string, any> };
  logger.info(`Razorpay webhook received: ${event.event}`);

  try {
    switch (event.event) {
      case 'subscription.activated':
      case 'subscription.charged': {
        const sub = event.payload?.subscription?.entity as Record<string, any>;
        if (!sub?.id) break;
        const periodStart = sub.current_start ? new Date(sub.current_start * 1000) : undefined;
        const periodEnd   = sub.current_end   ? new Date(sub.current_end   * 1000) : undefined;
        await prisma.shopSubscription.updateMany({
          where: { razorpay_sub_id: sub.id },
          data: {
            status: 'active',
            current_period_start: periodStart,
            current_period_end:   periodEnd,
          },
        });
        logger.info(`Subscription activated/charged: ${sub.id}`);
        break;
      }

      case 'subscription.completed':
      case 'subscription.expired': {
        const sub = event.payload?.subscription?.entity as Record<string, any>;
        if (!sub?.id) break;
        await prisma.shopSubscription.updateMany({
          where: { razorpay_sub_id: sub.id },
          data: { status: 'expired' },
        });
        logger.info(`Subscription expired: ${sub.id}`);
        break;
      }

      case 'subscription.cancelled': {
        const sub = event.payload?.subscription?.entity as Record<string, any>;
        if (!sub?.id) break;
        await prisma.shopSubscription.updateMany({
          where: { razorpay_sub_id: sub.id },
          data: { status: 'cancelled' },
        });
        logger.info(`Subscription cancelled: ${sub.id}`);
        break;
      }

      // payment.captured: activate the subscription linked to this payment
      case 'payment.captured': {
        const payment = event.payload?.payment?.entity as Record<string, any>;
        const subscriptionId = payment?.subscription_id as string | undefined;
        if (subscriptionId) {
          await prisma.shopSubscription.updateMany({
            where: { razorpay_sub_id: subscriptionId },
            data: { status: 'active' },
          });
          logger.info(`Subscription activated via payment.captured: ${subscriptionId}`);
        } else {
          logger.info(`Payment captured (no subscription): ${payment?.id}`);
        }
        break;
      }

      default:
        logger.info(`Unhandled Razorpay event: ${event.event}`);
    }
  } catch (err) {
    logger.error('Webhook processing error', err);
    // Return 200 to prevent Razorpay from retrying for internal errors
  }

  res.json({ received: true });
});

export default router;
