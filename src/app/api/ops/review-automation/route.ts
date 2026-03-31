/**
 * Google Review Automation API
 *
 * GET  /api/ops/review-automation — returns the org's review automation config
 * POST /api/ops/review-automation — sends a review request to a client after a positive visit
 */

import { NextRequest, NextResponse } from 'next/server';
import { getRequestContext } from '@/lib/request-context';
import { requireAnyRole, ForbiddenError } from '@/lib/rbac';
import { getScopedDb } from '@/lib/tenancy';
import { guardedSend } from '@/lib/messaging-guard';
import { sendMessage } from '@/lib/message-utils';
import { logEvent } from '@/lib/log-event';

const SETTING_KEY = 'review_automation_config';

interface ReviewAutomationConfig {
  enabled: boolean;
  googlePlaceId: string | null;
  minStarRating: number;
  frequencyCapDays: number;
  minVisitsBeforeAsking: number;
}

const DEFAULT_CONFIG: ReviewAutomationConfig = {
  enabled: false,
  googlePlaceId: null,
  minStarRating: 4,
  frequencyCapDays: 30,
  minVisitsBeforeAsking: 3,
};

async function loadConfig(db: any, orgId: string): Promise<ReviewAutomationConfig> {
  const setting = await db.setting.findFirst({
    where: { key: SETTING_KEY },
  });

  if (!setting?.value) return { ...DEFAULT_CONFIG };

  try {
    const parsed = JSON.parse(setting.value);
    return {
      enabled: typeof parsed.enabled === 'boolean' ? parsed.enabled : DEFAULT_CONFIG.enabled,
      googlePlaceId: parsed.googlePlaceId ?? DEFAULT_CONFIG.googlePlaceId,
      minStarRating: typeof parsed.minStarRating === 'number' ? parsed.minStarRating : DEFAULT_CONFIG.minStarRating,
      frequencyCapDays: typeof parsed.frequencyCapDays === 'number' ? parsed.frequencyCapDays : DEFAULT_CONFIG.frequencyCapDays,
      minVisitsBeforeAsking: typeof parsed.minVisitsBeforeAsking === 'number' ? parsed.minVisitsBeforeAsking : DEFAULT_CONFIG.minVisitsBeforeAsking,
    };
  } catch {
    return { ...DEFAULT_CONFIG };
  }
}

// ---------------------------------------------------------------------------
// GET — return the current config
// ---------------------------------------------------------------------------

export async function GET() {
  let ctx;
  try {
    ctx = await getRequestContext();
    requireAnyRole(ctx, ['owner', 'admin']);
  } catch (error) {
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const db = getScopedDb(ctx);
    const config = await loadConfig(db, ctx.orgId);
    return NextResponse.json(config);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: 'Failed to load review automation config', message }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// POST — send a review request to a client after a positive visit
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  let ctx;
  try {
    ctx = await getRequestContext();
    requireAnyRole(ctx, ['owner', 'admin']);
  } catch (error) {
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { bookingId, clientId } = body;

    if (!bookingId || !clientId) {
      return NextResponse.json(
        { error: 'Missing required fields: bookingId, clientId' },
        { status: 400 },
      );
    }

    const db = getScopedDb(ctx);
    const config = await loadConfig(db, ctx.orgId);

    if (!config.enabled) {
      return NextResponse.json(
        { error: 'Review automation is disabled', sent: false },
        { status: 400 },
      );
    }

    if (!config.googlePlaceId) {
      return NextResponse.json(
        { error: 'Google Place ID is not configured', sent: false },
        { status: 400 },
      );
    }

    // 1. Load the booking's visit report and check for a positive rating
    const report = await (db as any).report.findFirst({
      where: { bookingId },
      orderBy: { createdAt: 'desc' },
      select: { clientRating: true },
    });

    if (!report) {
      return NextResponse.json(
        { error: 'No visit report found for this booking', sent: false },
        { status: 404 },
      );
    }

    if (report.clientRating == null || report.clientRating < config.minStarRating) {
      return NextResponse.json({
        sent: false,
        reason: 'rating_too_low',
        message: `Client rating (${report.clientRating ?? 'none'}) is below the minimum threshold (${config.minStarRating}).`,
      });
    }

    // 2. Frequency cap: check if a review request was sent in the last N days
    const capCutoff = new Date();
    capCutoff.setDate(capCutoff.getDate() - config.frequencyCapDays);

    const recentReviewRequest = await (db as any).eventLog.findFirst({
      where: {
        eventType: 'review_request.sent',
        createdAt: { gte: capCutoff },
        metadata: { contains: clientId },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (recentReviewRequest) {
      return NextResponse.json({
        sent: false,
        reason: 'frequency_cap',
        message: `A review request was already sent to this client within the last ${config.frequencyCapDays} days.`,
      });
    }

    // 3. Minimum visits: client must have at least N completed bookings
    const completedCount = await (db as any).booking.count({
      where: { clientId, status: 'completed' },
    });

    if (completedCount < config.minVisitsBeforeAsking) {
      return NextResponse.json({
        sent: false,
        reason: 'insufficient_visits',
        message: `Client has ${completedCount} completed visit(s), but ${config.minVisitsBeforeAsking} are required.`,
      });
    }

    // 4. Load client info for the message
    const client = await (db as any).client.findFirst({
      where: { id: clientId },
      select: { phone: true, firstName: true },
    });

    if (!client?.phone) {
      return NextResponse.json(
        { error: 'Client phone number not found', sent: false },
        { status: 404 },
      );
    }

    // Get a pet name for a personal touch
    const pet = await (db as any).pet.findFirst({
      where: { clientId },
      select: { name: true },
      orderBy: { createdAt: 'asc' },
    });

    const petName = pet?.name || 'your pet';
    const reviewUrl = `https://search.google.com/local/writereview?placeid=${config.googlePlaceId}`;
    const messageBody = `Thanks for trusting us with ${petName}! If you had a great experience, we'd love a Google review: ${reviewUrl}`;

    // 5. Send the SMS via guardedSend + sendMessage
    const sent = await guardedSend(ctx.orgId, 'review_request', async () => {
      return sendMessage(client.phone, messageBody, bookingId);
    });

    // 6. Log the review request
    await logEvent({
      orgId: ctx.orgId,
      actorUserId: ctx.userId ?? undefined,
      action: 'review_request.sent',
      entityType: 'booking',
      entityId: bookingId,
      bookingId,
      status: sent ? 'success' : 'failed',
      metadata: {
        clientId,
        petName,
        googlePlaceId: config.googlePlaceId,
        sent,
      },
    }).catch(() => {});

    return NextResponse.json({
      sent,
      message: sent
        ? 'Review request sent successfully.'
        : 'Review request could not be delivered (messaging may not be provisioned).',
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: 'Failed to process review request', message },
      { status: 500 },
    );
  }
}
