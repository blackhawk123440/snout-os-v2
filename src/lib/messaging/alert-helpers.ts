/**
 * Alert Helpers
 *
 * Persists operational alerts to EventLog (the existing audit model).
 * Uses eventType prefix 'alert.' for easy querying.
 * Deduplicates by checking for recent open alerts of the same type.
 */

import { prisma } from '@/lib/db';
import { logMessagingEvent } from './audit-trail';

/**
 * Create or deduplicate an operational alert.
 * Persists to EventLog with eventType 'alert.<type>' and status 'pending' (open).
 * Deduplication: if an open alert of the same type exists within the last 24h, updates it.
 */
export async function createAlert(params: {
  orgId: string;
  severity: 'critical' | 'warning' | 'info';
  type: string;
  title: string;
  description: string;
  entityType?: string;
  entityId?: string;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  const { orgId, severity, type, title, description, entityType, entityId, metadata } = params;
  const eventType = `alert.${type}`;
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000); // 24h dedup window

  try {
    // Check for existing open alert of same type within dedup window
    const existing = await prisma.eventLog.findFirst({
      where: {
        orgId,
        eventType,
        status: 'pending', // 'pending' = open alert
        createdAt: { gte: since },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (existing) {
      // Deduplicate: just log that we refreshed it
      await logMessagingEvent({
        orgId,
        eventType: 'policy_violation' as any,
        metadata: {
          alertType: type,
          severity,
          reason: 'Deduplication refresh — existing alert still open',
        },
      });
      return;
    }

    // Create new alert as EventLog entry
    await prisma.eventLog.create({
      data: {
        orgId,
        eventType,
        status: 'pending',
        metadata: JSON.stringify({
          severity,
          title,
          description,
          entityType: entityType ?? null,
          entityId: entityId ?? null,
          ...metadata,
        }),
      },
    });

    await logMessagingEvent({
      orgId,
      eventType: 'policy_violation' as any,
      metadata: {
        alertType: type,
        severity,
        title,
        entityType,
        entityId,
      },
    });
  } catch (error) {
    // Alert creation must not break the caller (pool exhaustion path, etc.)
    console.error('[alert-helpers] Failed to create alert:', error);
  }
}

/**
 * Get open alerts for an org (alerts with status 'pending' in EventLog).
 */
export async function getOpenAlerts(orgId: string): Promise<Array<{
  type: string;
  severity: 'critical' | 'warning' | 'info';
  title: string;
  description: string;
  entityType?: string;
  entityId?: string;
  metadata?: Record<string, unknown>;
}>> {
  try {
    const rows = await prisma.eventLog.findMany({
      where: {
        orgId,
        eventType: { startsWith: 'alert.' },
        status: 'pending',
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    return rows.map((row: any) => {
      let parsed: Record<string, any> = {};
      try { parsed = JSON.parse(row.metadata || '{}'); } catch {}
      return {
        type: row.eventType.replace('alert.', ''),
        severity: (parsed.severity as 'critical' | 'warning' | 'info') || 'info',
        title: parsed.title || row.eventType,
        description: parsed.description || '',
        entityType: parsed.entityType || undefined,
        entityId: parsed.entityId || undefined,
        metadata: parsed,
      };
    });
  } catch (error) {
    console.error('[alert-helpers] Failed to get alerts:', error);
    return [];
  }
}
