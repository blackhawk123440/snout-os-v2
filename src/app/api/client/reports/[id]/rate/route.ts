import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getRequestContext } from '@/lib/request-context';
import { ForbiddenError, requireRole, requireClientContext } from '@/lib/rbac';
import { getScopedDb } from '@/lib/tenancy';
import { logEvent } from '@/lib/log-event';

const RateSchema = z.object({
  rating: z.number().int().min(1).max(5),
  feedback: z.string().max(2000).optional(),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  let ctx;
  try {
    ctx = await getRequestContext();
    requireRole(ctx, 'client');
    requireClientContext(ctx);
  } catch (error) {
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;

  try {
    const body = await request.json();
    const parsed = RateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: parsed.error.issues },
        { status: 400 }
      );
    }

    const db = getScopedDb(ctx);

    // Verify report belongs to this client and update atomically
    const updatedReport = await db.$transaction(async (tx) => {
      const report = await tx.report.findFirst({
        where: {
          id,
          booking: { clientId: ctx.clientId },
        },
        select: { id: true },
      });

      if (!report) return null;

      return tx.report.update({
        where: { id },
        data: {
          clientRating: parsed.data.rating,
          clientFeedback: parsed.data.feedback?.trim() || null,
          ratedAt: new Date(),
        },
        select: { id: true, bookingId: true },
      });
    });

    if (!updatedReport) {
      return NextResponse.json({ error: 'Report not found' }, { status: 404 });
    }

    // Trigger review automation if rating is high enough
    if (parsed.data.rating >= 4 && updatedReport.bookingId) {
      void triggerReviewAutomation(ctx.orgId, ctx.clientId, updatedReport.bookingId, parsed.data.rating);
    }

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: 'Failed to rate report', message },
      { status: 500 }
    );
  }
}

/**
 * After a high rating, check review automation config and send a Google review request.
 * Runs fire-and-forget — never blocks the rating response.
 */
async function triggerReviewAutomation(orgId: string, clientId: string, bookingId: string, rating: number) {
  try {
    const db = getScopedDb({ orgId });

    // Load review automation config from Setting table
    const configRow = await db.setting.findFirst({
      where: { key: 'review_automation_config' },
    });
    if (!configRow?.value) return;

    let config: { enabled?: boolean; googlePlaceId?: string; minStarRating?: number; frequencyCapDays?: number; minVisitsBeforeAsking?: number };
    try { config = JSON.parse(configRow.value); } catch { return; }

    if (!config.enabled || !config.googlePlaceId) return;
    if (rating < (config.minStarRating ?? 4)) return;

    // Frequency cap: check if we already sent a review request to this client recently
    const capDays = config.frequencyCapDays ?? 30;
    const cutoff = new Date(Date.now() - capDays * 24 * 60 * 60 * 1000);
    // EventLog has 'action' column not fully typed in generated Prisma client
    const recentRequest = await (db.eventLog as any).findFirst({
      where: {
        action: 'review_request.sent',
        createdAt: { gte: cutoff },
        metadata: { contains: clientId },
      },
    });
    if (recentRequest) return;

    // Minimum visits check
    const minVisits = config.minVisitsBeforeAsking ?? 3;
    const completedCount = await db.booking.count({
      where: { clientId, status: 'completed' },
    });
    if (completedCount < minVisits) return;

    // Get client phone for SMS
    const client = await db.client.findUnique({
      where: { id: clientId },
      select: { phone: true, firstName: true },
    });
    if (!client?.phone) return;

    // Get first pet name for personalization
    const booking = await db.booking.findUnique({
      where: { id: bookingId },
      select: { pets: { select: { name: true }, take: 1 } },
    });
    const petName = booking?.pets?.[0]?.name || 'your pet';

    // Send the review request via SMS (delayed 1 hour via automation queue)
    const reviewUrl = `https://search.google.com/local/writereview?placeid=${config.googlePlaceId}`;
    const msg = `Thanks for trusting us with ${petName}! If you had a great experience, we'd love a Google review: ${reviewUrl}`;

    try {
      const { enqueueAutomation } = await import('@/lib/automation-queue');
      await enqueueAutomation(
        'reviewRequest',
        'client',
        { orgId, clientId, bookingId, phone: client.phone, message: msg },
        `reviewRequest:client:${clientId}:${bookingId}`,
      );
    } catch {
      // Fallback: send immediately if queue unavailable
      const { guardedSend } = await import('@/lib/messaging-guard');
      const { sendMessage } = await import('@/lib/message-utils');
      await guardedSend(orgId, 'review_request', async () => {
        await sendMessage(client.phone, msg);
        return true;
      });
    }

    await logEvent({
      orgId,
      action: 'review_request.sent',
      status: 'success',
      metadata: { clientId, bookingId, rating },
    }).catch(() => {});
  } catch (err) {
    console.error('[review-automation] Trigger failed:', err);
  }
}
