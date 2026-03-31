/**
 * SRS API Endpoint (Owner Only)
 * GET /api/sitters/:id/srs
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getScopedDb } from '@/lib/tenancy';
import { calculateSRS, calculateRolling26WeekScore } from '@/lib/tiers/srs-engine';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Owner only
  const user = session.user as any;
  if (user.role !== 'owner' && user.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const resolvedParams = await params;
    const sitterId = resolvedParams.id;

    // Get orgId from session or derive
    const orgId = (session.user as any).orgId;
    if (!orgId) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 400 });
    }

    const db = getScopedDb({ orgId });

    // Get latest snapshot
    const latestSnapshot = await (db as any).sitterTierSnapshot.findFirst({
      where: { sitterId },
      orderBy: { asOfDate: 'desc' },
    });

    // Calculate current SRS if no snapshot
    const asOfDate = new Date();
    const currentSRS = latestSnapshot ? null : await calculateSRS(orgId, sitterId, asOfDate);
    const rolling26w = latestSnapshot ? null : await calculateRolling26WeekScore(orgId, sitterId, asOfDate);

    // Get compensation (use findFirst with flat fields — scoped proxy injects orgId)
    const compensation = await (db as any).sitterCompensation.findFirst({
      where: { sitterId },
    });

    return NextResponse.json({
      snapshot: latestSnapshot ? {
        ...latestSnapshot,
        rolling30dBreakdown: JSON.parse(latestSnapshot.rolling30dBreakdownJson),
        rolling26wBreakdown: latestSnapshot.rolling26wBreakdownJson ? JSON.parse(latestSnapshot.rolling26wBreakdownJson) : null,
      } : null,
      current: currentSRS,
      rolling26w,
      compensation,
    });
  } catch (error: any) {
    console.error('[SRS API] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch SRS data', message: error.message },
      { status: 500 }
    );
  }
}
