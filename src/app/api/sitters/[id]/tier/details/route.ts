/**
 * Sitter Tier Details API
 * GET /api/sitters/:id/tier/details
 *
 * Returns full tier details for Tier tab
 */

import { NextRequest, NextResponse } from 'next/server';
import { getScopedDb } from '@/lib/tenancy';
import { getRequestContext } from '@/lib/request-context';
import { requireAnyRole, ForbiddenError } from '@/lib/rbac';
import { toCanonicalTierName } from '@/lib/tiers/tier-name-mapper';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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
    const resolvedParams = await params;
    const sitterId = resolvedParams.id;
    const db = getScopedDb(ctx);

    const sitter = await db.sitter.findFirst({
      where: { id: sitterId },
      select: { id: true },
    });

    if (!sitter) {
      return NextResponse.json({ error: 'Sitter not found' }, { status: 404 });
    }

    // Get current tier from most recent history
    const latestHistory = await (db as any).sitterTierHistory.findFirst({
      where: { sitterId },
      orderBy: { periodStart: 'desc' },
      include: {
        tier: true,
      },
    });

    // Get tier history (newest first)
    const tierHistory = await (db as any).sitterTierHistory.findMany({
      where: { sitterId },
      orderBy: { periodStart: 'desc' },
      include: {
        tier: true,
      },
      take: 20, // Last 20 tier changes
    });

    // Get metrics windows (7d and 30d if available)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const now = new Date();

    const metrics7d = await (db as any).sitterMetricsWindow.findFirst({
      where: {
        sitterId,
        windowStart: { lte: sevenDaysAgo },
        windowEnd: { gte: now },
        windowType: 'weekly_7d',
      },
      orderBy: { updatedAt: 'desc' },
    });

    const metrics30d = await (db as any).sitterMetricsWindow.findFirst({
      where: {
        sitterId,
        windowStart: { lte: thirtyDaysAgo },
        windowEnd: { gte: now },
        windowType: 'monthly_30d',
      },
      orderBy: { updatedAt: 'desc' },
    });

    // Parse metadata from latest history for reasons
    let reasons: string[] = [];
    if (latestHistory?.reason) {
      reasons = latestHistory.reason.split('; ').filter(Boolean);
    } else if (latestHistory?.metadata) {
      try {
        const metadata = JSON.parse(latestHistory.metadata);
        if (metadata.reasons) {
          reasons = Array.isArray(metadata.reasons) ? metadata.reasons : [metadata.reasons];
        }
      } catch {
        // Ignore parse errors
      }
    }

    return NextResponse.json({
      currentTier: latestHistory ? {
        name: toCanonicalTierName(latestHistory.tier?.name || 'Bronze'),
        id: latestHistory.tierId,
        reasons,
        assignedAt: latestHistory.periodStart,
      } : null,
      metrics7d: metrics7d ? {
        avgResponseSeconds: metrics7d.avgResponseSeconds,
        medianResponseSeconds: metrics7d.medianResponseSeconds,
        responseRate: metrics7d.responseRate,
        offerAcceptRate: metrics7d.offerAcceptRate,
        offerDeclineRate: metrics7d.offerDeclineRate,
        offerExpireRate: metrics7d.offerExpireRate,
        lastUpdated: metrics7d.updatedAt,
      } : null,
      metrics30d: metrics30d ? {
        avgResponseSeconds: metrics30d.avgResponseSeconds,
        medianResponseSeconds: metrics30d.medianResponseSeconds,
        responseRate: metrics30d.responseRate,
        offerAcceptRate: metrics30d.offerAcceptRate,
        offerDeclineRate: metrics30d.offerDeclineRate,
        offerExpireRate: metrics30d.offerExpireRate,
        lastUpdated: metrics30d.updatedAt,
      } : null,
      history: tierHistory.map((h: any) => ({
        id: h.id,
        tierName: toCanonicalTierName(h.tier?.name || 'Bronze'),
        assignedAt: h.periodStart,
        reason: h.reason,
        metadata: h.metadata,
      })),
    });
  } catch (error: any) {
    console.error('[Tier Details API] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch tier details', message: error.message },
      { status: 500 }
    );
  }
}
