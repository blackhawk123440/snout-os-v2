/**
 * SRS Snapshot Ops Endpoint (Owner Only)
 *
 * POST /api/ops/srs/run-snapshot?date=YYYY-MM-DD
 *
 * Manually trigger daily snapshot for all sitters
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { scheduleDailySnapshots } from '@/lib/tiers/srs-queue';
import { getScopedDb } from '@/lib/tenancy';
import { resolveCorrelationId } from '@/lib/correlation-id';

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

  // Guardrail
  if (process.env.NODE_ENV === 'production' && process.env.ENABLE_OPS_SRS !== 'true') {
    return NextResponse.json({ error: 'Not available in production' }, { status: 403 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const dateParam = searchParams.get('date');
    const asOfDate = dateParam ? new Date(dateParam) : new Date();

    const orgId = (session.user as any).orgId;
    if (!orgId) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 400 });
    }

    const db = getScopedDb({ orgId });

    // Get all sitters in org
    const sitters = await (db as any).sitter.findMany({
      where: { active: true },
    });

    // Filter to org sitters (derive orgId from related entities)
    const orgSitters = [];
    for (const sitter of sitters) {
      const thread = await (db as any).messageThread.findFirst({
        where: { assignedSitterId: sitter.id },
        select: { orgId: true },
      });
      if (thread?.orgId === orgId) {
        orgSitters.push(sitter);
      }
    }

    // Schedule snapshots
    const correlationId = resolveCorrelationId(request);
    await scheduleDailySnapshots(orgId, asOfDate, correlationId);

    // Wait a bit for jobs to process
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Get created snapshots
    const snapshots = await (db as any).sitterTierSnapshot.findMany({
      where: {
        asOfDate: {
          gte: new Date(asOfDate.getTime() - 24 * 60 * 60 * 1000),
          lte: new Date(asOfDate.getTime() + 24 * 60 * 60 * 1000),
        },
      },
      include: {
        sitter: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    return NextResponse.json({
      success: true,
      sittersProcessed: orgSitters.length,
      snapshotsCreated: snapshots.length,
      snapshotIds: snapshots.map((s: any) => s.id),
      snapshots: snapshots.map((s: any) => ({
        sitterId: s.sitterId,
        sitterName: `${s.sitter.firstName} ${s.sitter.lastName}`,
        score: s.rolling30dScore,
        tier: s.tier,
        provisional: s.provisional,
        visits30d: s.visits30d,
      })),
    });
  } catch (error: any) {
    console.error('[SRS Snapshot Ops] Error:', error);
    return NextResponse.json(
      { error: 'Failed to run snapshot', message: error.message },
      { status: 500 }
    );
  }
}
