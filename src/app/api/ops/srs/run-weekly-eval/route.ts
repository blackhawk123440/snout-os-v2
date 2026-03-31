/**
 * SRS Weekly Evaluation Ops Endpoint (Owner Only)
 *
 * POST /api/ops/srs/run-weekly-eval?weekOf=YYYY-MM-DD
 *
 * Manually trigger weekly evaluation for all sitters
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { scheduleWeeklyEvaluations } from '@/lib/tiers/srs-queue';
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
    const weekOfParam = searchParams.get('weekOf');
    const asOfDate = weekOfParam ? new Date(weekOfParam) : new Date();

    const orgId = (session.user as any).orgId;
    if (!orgId) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 400 });
    }

    const db = getScopedDb({ orgId });

    // Schedule evaluations
    const correlationId = resolveCorrelationId(request);
    await scheduleWeeklyEvaluations(orgId, asOfDate, correlationId);

    // Wait a bit for jobs to process
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Get updated snapshots
    const snapshots = await (db as any).sitterTierSnapshot.findMany({
      where: {
        asOfDate: {
          gte: new Date(asOfDate.getTime() - 7 * 24 * 60 * 60 * 1000),
          lte: asOfDate,
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
      orderBy: { asOfDate: 'desc' },
    });

    // Get latest per sitter
    const latestBySitter = new Map();
    for (const snapshot of snapshots) {
      if (!latestBySitter.has(snapshot.sitterId)) {
        latestBySitter.set(snapshot.sitterId, snapshot);
      }
    }

    return NextResponse.json({
      success: true,
      sittersEvaluated: latestBySitter.size,
      snapshots: Array.from(latestBySitter.values()).map((s: any) => ({
        sitterId: s.sitterId,
        sitterName: `${s.sitter.firstName} ${s.sitter.lastName}`,
        tier: s.tier,
        atRisk: s.atRisk,
        atRiskReason: s.atRiskReason,
        lastPromotionAt: s.lastPromotionAt,
        lastDemotionAt: s.lastDemotionAt,
      })),
    });
  } catch (error: any) {
    console.error('[SRS Weekly Eval Ops] Error:', error);
    return NextResponse.json(
      { error: 'Failed to run weekly evaluation', message: error.message },
      { status: 500 }
    );
  }
}
