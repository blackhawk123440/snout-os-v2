/**
 * Time Off API (Owner Only)
 * POST /api/sitters/:id/time-off
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getScopedDb } from '@/lib/tenancy';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const user = session.user as any;
  if (user.role !== 'owner' && user.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const resolvedParams = await params;
    const sitterId = resolvedParams.id;
    const orgId = (session.user as any).orgId;
    const db = getScopedDb({ orgId });
    const body = await request.json();

    const { type, startsAt, endsAt } = body;

    if (!type || !startsAt || !endsAt) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const timeOff = await (db as any).sitterTimeOff.create({
      data: {
        sitterId,
        type,
        startsAt: new Date(startsAt),
        endsAt: new Date(endsAt),
        approvedByUserId: session.user.id,
      },
    });

    // Exclude responses during time off
    const { excludeTimeOffResponses } = await import('@/lib/tiers/message-instrumentation');
    await excludeTimeOffResponses(orgId, sitterId, {
      startsAt: new Date(startsAt),
      endsAt: new Date(endsAt),
    });

    return NextResponse.json({ timeOff });
  } catch (error: any) {
    console.error('[Time Off API] Error:', error);
    return NextResponse.json(
      { error: 'Failed to create time off', message: error.message },
      { status: 500 }
    );
  }
}
