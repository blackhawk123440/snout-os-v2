/**
 * SRS List API Endpoint (Owner / Admin only)
 * GET /api/sitters/srs
 */

import { NextRequest, NextResponse } from 'next/server';
import { getRequestContext } from '@/lib/request-context';
import { requireAnyRole, ForbiddenError } from '@/lib/rbac';
import { getScopedDb } from '@/lib/tenancy';

export async function GET(request: NextRequest) {
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

  const db = getScopedDb(ctx);
  try {

    // Get all sitters with latest snapshots
    const snapshots = await (db as any).sitterTierSnapshot.findMany({
      where: {},
      include: {
        sitter: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            active: true,
          },
        },
      },
      orderBy: [
        { sitterId: 'asc' },
        { asOfDate: 'desc' },
      ],
    });

    // Group by sitter and get latest
    const sitterMap = new Map();
    for (const snapshot of snapshots) {
      if (!sitterMap.has(snapshot.sitterId)) {
        sitterMap.set(snapshot.sitterId, snapshot);
      }
    }

    const results = Array.from(sitterMap.values()).map((snapshot: any) => ({
      sitterId: snapshot.sitterId,
      sitter: snapshot.sitter,
      tier: snapshot.tier,
      score: snapshot.rolling30dScore,
      provisional: snapshot.provisional,
      atRisk: snapshot.atRisk,
      atRiskReason: snapshot.atRiskReason,
      visits30d: snapshot.visits30d,
      lastUpdated: snapshot.asOfDate,
      breakdown: JSON.parse(snapshot.rolling30dBreakdownJson),
    }));

    return NextResponse.json(
      { sitters: results },
      { headers: { 'X-Snout-Org-Resolved': '1' } }
    );
  } catch (error: any) {
    console.error('[SRS List API] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch SRS list', message: error.message },
      { status: 500 }
    );
  }
}
