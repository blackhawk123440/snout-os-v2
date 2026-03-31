/**
 * Visit Capture Endpoint (Owner Only)
 * 
 * POST /api/ops/visits/capture
 * 
 * Creates VisitEvent records for SRS tracking
 * Used for ops to seed realistic visits for proof
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { onCreateVisit } from '@/lib/tiers/event-hooks';

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Owner only
  const user = session.user as any;
  if (user.role !== 'owner' && user.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // Guardrail: Only in dev/staging
  if (process.env.NODE_ENV === 'production' && !process.env.ENABLE_OPS_SRS) {
    return NextResponse.json({ error: 'Not available in production' }, { status: 403 });
  }

  try {
    const body = await request.json();
    const {
      orgId,
      sitterId,
      bookingId,
      scheduledStart,
      scheduledEnd,
      checkInAt,
      checkOutAt,
      status,
      lateMinutes,
      checklistMissedCount,
      mediaMissingCount,
      complaintVerified,
      safetyFlag,
      excluded,
      excludedReason,
      threadId,
    } = body;

    if (!orgId || !sitterId || !bookingId || !scheduledStart || !scheduledEnd || !status) {
      return NextResponse.json(
        { error: 'Missing required fields: orgId, sitterId, bookingId, scheduledStart, scheduledEnd, status' },
        { status: 400 }
      );
    }

    const visitEventId = await onCreateVisit(orgId, sitterId, bookingId, {
      scheduledStart: new Date(scheduledStart),
      scheduledEnd: new Date(scheduledEnd),
      checkInAt: checkInAt ? new Date(checkInAt) : undefined,
      checkOutAt: checkOutAt ? new Date(checkOutAt) : undefined,
      status,
      lateMinutes,
      checklistMissedCount,
      mediaMissingCount,
      complaintVerified,
      safetyFlag,
      excluded,
      excludedReason,
      threadId,
    });

    return NextResponse.json({
      success: true,
      visitEventId,
    });
  } catch (error: any) {
    console.error('[Visit Capture API] Error:', error);
    return NextResponse.json(
      { error: 'Failed to capture visit', message: error.message },
      { status: 500 }
    );
  }
}
