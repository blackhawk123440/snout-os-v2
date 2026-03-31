/**
 * Pool Release Job
 * 
 * Repeatable worker/cron that releases pool numbers based on rotation settings:
 * - postBookingGraceHours
 * - inactivityReleaseDays
 * - maxPoolThreadLifetimeDays
 * 
 * Must write audit events and update number usage counts.
 */

import { prisma } from '@/lib/db';
import { logMessagingEvent } from './audit-trail';

interface PoolReleaseStats {
  releasedByGracePeriod: number;
  releasedByInactivity: number;
  releasedByMaxLifetime: number;
  totalReleased: number;
  errors: string[];
}

/**
 * Release pool numbers based on rotation settings
 */
export async function releasePoolNumbers(orgId?: string): Promise<PoolReleaseStats> {
  const stats: PoolReleaseStats = {
    releasedByGracePeriod: 0,
    releasedByInactivity: 0,
    releasedByMaxLifetime: 0,
    totalReleased: 0,
    errors: [],
  };

  try {
    const rotationSettings = await (prisma as any).setting.findMany({
      where: {
        ...(orgId ? { orgId } : {}),
        key: { startsWith: 'rotation.' },
      },
      select: { key: true, value: true },
    });

    const settings: Record<string, string> = {};
    for (const setting of rotationSettings) {
      const key = setting.key.replace('rotation.', '');
      settings[key] = setting.value;
    }

    const postBookingGraceHours = parseInt(settings.postBookingGraceHours || '72', 10) || 72;
    const inactivityReleaseDays = parseInt(settings.inactivityReleaseDays || '7', 10) || 7;
    const maxPoolThreadLifetimeDays = parseInt(settings.maxPoolThreadLifetimeDays || '30', 10) || 30;

    const now = new Date();
    const gracePeriodCutoff = new Date(now.getTime() - postBookingGraceHours * 60 * 60 * 1000);
    const inactivityCutoff = new Date(now.getTime() - inactivityReleaseDays * 24 * 60 * 60 * 1000);
    const maxLifetimeCutoff = new Date(now.getTime() - maxPoolThreadLifetimeDays * 24 * 60 * 60 * 1000);

    // Find pool numbers with active threads
    const whereClause: any = {
      numberClass: 'pool',
      status: 'active',
      MessageThread: {
        some: {
          status: { not: 'archived' },
        },
      },
    };

    if (orgId) {
      whereClause.orgId = orgId;
    }

    const poolNumbers = await (prisma as any).messageNumber.findMany({
      where: whereClause,
      include: {
        MessageThread: {
          where: {
            status: 'open',
          },
          include: {
            assignmentWindows: {
              where: { status: 'active' },
              orderBy: {
                endAt: 'desc',
              },
              take: 1,
            },
          },
        },
      },
    });

    for (const poolNumber of poolNumbers) {
      try {
        // Check each thread using this pool number
        for (const thread of poolNumber.MessageThread) {
          let shouldRelease = false;
          let releaseReason = '';

          // Check 1: Post-booking grace period
          const lastWindow = thread.assignmentWindows[0];
          if (lastWindow && lastWindow.endAt < gracePeriodCutoff) {
            shouldRelease = true;
            releaseReason = `postBookingGraceHours (${postBookingGraceHours}h) expired`;
            stats.releasedByGracePeriod++;
          }

          // Check 2: Inactivity (no messages for inactivityReleaseDays)
          const lastMessageAt = thread.lastMessageAt || thread.updatedAt || thread.createdAt;
          if (lastMessageAt < inactivityCutoff) {
            shouldRelease = true;
            releaseReason = `inactivityReleaseDays (${inactivityReleaseDays}d) expired`;
            stats.releasedByInactivity++;
          }

          // Check 3: Max thread lifetime
          if (thread.createdAt < maxLifetimeCutoff) {
            shouldRelease = true;
            releaseReason = `maxPoolThreadLifetimeDays (${maxPoolThreadLifetimeDays}d) expired`;
            stats.releasedByMaxLifetime++;
          }

          if (shouldRelease) {
            await (prisma as any).messageThread.update({
              where: { id: thread.id },
              data: {
                messageNumberId: null,
                numberClass: 'front_desk',
                maskedNumberE164: null,
              },
            });

            // Log audit event
            await logMessagingEvent({
              orgId: poolNumber.orgId,
              eventType: 'pool.number.released' as any, // pool.number.released not in MessagingAuditEventType, but needed for audit
              metadata: {
                numberId: poolNumber.id,
                e164: poolNumber.e164,
                threadId: thread.id,
                reason: releaseReason,
                settings: {
                  postBookingGraceHours,
                  inactivityReleaseDays,
                  maxPoolThreadLifetimeDays,
                },
              },
            });

            stats.totalReleased++;
          }
        }

        // Update number usage count (lastAssignedAt reset if no open threads remain)
        const activeThreadCount = await (prisma as any).messageThread.count({
          where: {
            orgId: poolNumber.orgId,
            messageNumberId: poolNumber.id,
            status: 'open',
          },
        });

        if (activeThreadCount === 0) {
          await (prisma as any).messageNumber.update({
            where: { id: poolNumber.id },
            data: { lastAssignedAt: null },
          });
        }
      } catch (error: any) {
        stats.errors.push(`Error processing pool number ${poolNumber.id}: ${error.message}`);
      }
    }
  } catch (error: any) {
    stats.errors.push(`Fatal error in pool release job: ${error.message}`);
  }

  return stats;
}

/**
 * Run pool release job (called by cron/worker)
 */
export async function runPoolReleaseJob(): Promise<PoolReleaseStats> {
  return await releasePoolNumbers();
}
