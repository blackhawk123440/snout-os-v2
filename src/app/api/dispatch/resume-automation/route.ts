/**
 * Resume Automation API
 * 
 * POST: Resume automation for a booking (owner override)
 * Validates dispatch status transitions and records audit events
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { resumeAutomation } from '@/lib/dispatch-control';
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
    const body = await request.json();
    const { bookingId, reason } = body;

    if (!bookingId) {
      return NextResponse.json(
        { error: 'bookingId is required' },
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

    await resumeAutomation(
      orgId,
      bookingId,
      reason || 'Owner resumed automation',
      user.id,
      { correlationId: resolveCorrelationId(request) }
    );

    return NextResponse.json({
      success: true,
      message: 'Automation resumed successfully',
    });
  } catch (error: any) {
    console.error('[Resume Automation API] Failed to resume automation:', error);
    return NextResponse.json(
      { error: 'Failed to resume automation', message: error.message },
      { status: 400 }
    );
  }
}
