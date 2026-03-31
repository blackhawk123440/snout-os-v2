/**
 * Service Events API (Owner Only)
 * POST /api/sitters/:id/service-events
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

    const { level, reasonCode, notes, effectiveFrom, effectiveTo } = body;

    if (!level || !reasonCode || !effectiveFrom) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const event = await (db as any).sitterServiceEvent.create({
      data: {
        sitterId,
        level,
        reasonCode,
        notes,
        effectiveFrom: new Date(effectiveFrom),
        effectiveTo: effectiveTo ? new Date(effectiveTo) : null,
        createdByUserId: session.user.id,
      },
    });

    return NextResponse.json({ event });
  } catch (error: any) {
    console.error('[Service Events API] Error:', error);
    return NextResponse.json(
      { error: 'Failed to create service event', message: error.message },
      { status: 500 }
    );
  }
}
