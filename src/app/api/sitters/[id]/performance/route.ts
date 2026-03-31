/**
 * Sitter Performance API
 * GET /api/sitters/:id/performance
 *
 * Returns performance metrics for Performance tab
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getScopedDb } from '@/lib/tenancy';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Owner/admin only
  const user = session.user as any;
  if (user.role !== 'owner' && user.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const resolvedParams = await params;
    const sitterId = resolvedParams.id;
    const orgId = user.orgId;

    if (!orgId) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 400 });
    }

    const db = getScopedDb({ orgId });

    // Get performance metrics from dashboard API
    const dashboardRes = await fetch(`${request.nextUrl.origin}/api/sitters/${sitterId}/dashboard`, {
      headers: {
        'Cookie': request.headers.get('cookie') || '',
      },
    });

    if (!dashboardRes.ok) {
      return NextResponse.json({ error: 'Failed to fetch performance data' }, { status: 500 });
    }

    const dashboard = await dashboardRes.json();

    // Calculate additional metrics
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    // Get cancellations (bookings cancelled by sitter)
    const cancellations = await (db as any).booking.count({
      where: {
        sitterId,
        status: 'cancelled',
        updatedAt: { gte: thirtyDaysAgo },
      },
    });

    // SLA breaches would need to be calculated from VisitEvent or similar
    // For now, return 0 as foundation
    const slaBreaches = 0;

    // Calculate trends (simplified - would need historical data)
    const trends = {
      acceptanceRate: 0, // Would need historical comparison
      completionRate: 0,
      onTimeRate: 0,
    };

    return NextResponse.json({
      acceptanceRate: dashboard.performance?.acceptanceRate || null,
      completionRate: dashboard.performance?.completionRate || null,
      onTimeRate: dashboard.performance?.onTimeRate || null,
      clientRating: dashboard.performance?.clientRating || null,
      totalEarnings: dashboard.performance?.totalEarnings || null,
      completedBookingsCount: dashboard.performance?.completedBookingsCount || 0,
      cancellations,
      slaBreaches,
      trends,
    });
  } catch (error: any) {
    console.error('[Performance API] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch performance data', message: error.message },
      { status: 500 }
    );
  }
}
