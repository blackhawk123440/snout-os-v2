/**
 * Force Assign Sitter API
 * 
 * POST: Force assign a sitter to a booking (owner override)
 * Validates dispatch status transitions and records audit events
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { forceAssignSitter } from '@/lib/dispatch-control';
import { AvailabilityConflictError } from '@/lib/availability/booking-conflict';
import { resolveCorrelationId } from '@/lib/correlation-id';

export async function POST(request: NextRequest) {
  const session = await auth();

  if (!session?.user) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    );
  }

  // Owner/admin only
  const user = session.user as any;
  if (user.role !== 'owner' && user.role !== 'admin') {
    return NextResponse.json(
      { error: 'Forbidden' },
      { status: 403 }
    );
  }

  try {
    const correlationId = resolveCorrelationId(request);
    const body = await request.json();
    const { bookingId, sitterId, reason, force } = body;

    if (!bookingId || !sitterId) {
      return NextResponse.json(
        { error: 'bookingId and sitterId are required' },
        { status: 400 }
      );
    }

    const orgId = user.orgId || (await import('@/lib/messaging/org-helpers')).getDefaultOrgId();

    if (!orgId) {
      return NextResponse.json(
        { error: 'Organization not found' },
        { status: 400 }
      );
    }

    await forceAssignSitter(
      orgId,
      bookingId,
      sitterId,
      reason || 'Owner force assignment',
      user.id,
      { force: force === true, correlationId }
    );

    return NextResponse.json({
      success: true,
      message: 'Sitter assigned successfully',
    });
  } catch (error: any) {
    if (error instanceof AvailabilityConflictError) {
      return NextResponse.json(
        {
          error: 'Availability conflict',
          conflicts: error.conflicts,
        },
        { status: 409 }
      );
    }
    console.error('[Force Assign API] Failed to assign sitter:', error);
    return NextResponse.json(
      { error: 'Failed to assign sitter', message: error.message },
      { status: 400 }
    );
  }
}
