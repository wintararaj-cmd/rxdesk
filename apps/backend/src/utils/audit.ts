/**
 * audit.ts — Fire-and-forget async audit logger
 *
 * Usage:
 *   audit({ action: 'bill.created', userId: req.user!.id, actorRole: req.user!.role,
 *            shopId, resource: 'bill', resourceId: bill.id, metadata: { amount } });
 *
 * Errors are swallowed with a console.error — auditing must NEVER crash the main request.
 */

import prisma from '../config/database';
import type { Prisma } from '@prisma/client';

export interface AuditParams {
  action: string;
  userId?: string;
  actorRole?: string;
  shopId?: string;
  resource?: string;
  resourceId?: string;
  ipAddress?: string;
  metadata?: Record<string, unknown>;
}

export function audit(params: AuditParams): void {
  // Fire-and-forget: deliberately not awaited
  prisma.auditLog
    .create({
      data: {
        action: params.action,
        user_id: params.userId ?? null,
        actor_role: params.actorRole ?? null,
        shop_id: params.shopId ?? null,
        resource: params.resource ?? null,
        resource_id: params.resourceId ?? null,
        ip_address: params.ipAddress ?? null,
        metadata: params.metadata ? (params.metadata as Prisma.InputJsonObject) : undefined,
      },
    })
    .catch((e: Error) => {
      console.error('[audit] Failed to write audit log:', e.message);
    });
}
