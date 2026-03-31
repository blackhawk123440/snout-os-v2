import { NextRequest, NextResponse } from 'next/server';
import { getScopedDb } from '@/lib/tenancy';
import { getRequestContext } from '@/lib/request-context';
import { ForbiddenError, requireRole, requireClientContext } from '@/lib/rbac';

export async function GET(request: NextRequest) {
  let ctx;
  try {
    ctx = await getRequestContext();
    requireRole(ctx, 'client');
    requireClientContext(ctx);
  } catch (error) {
    if (error instanceof ForbiddenError) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const year = parseInt(searchParams.get('year') || String(new Date().getFullYear()), 10);
  const yearStart = new Date(year, 0, 1);
  const yearEnd = new Date(year + 1, 0, 1);

  const db = getScopedDb(ctx);
  try {
    const bookings = await db.booking.findMany({
      where: {
        clientId: ctx.clientId,
        startAt: { gte: yearStart, lt: yearEnd },
        status: { not: 'cancelled' },
      },
      select: { totalPrice: true, status: true, sitterId: true, service: true },
    });

    const completed = bookings.filter((b: any) => b.status === 'completed');
    const totalSpent = completed.reduce((s: number, b: any) => s + (b.totalPrice || 0), 0);
    const avgCost = completed.length > 0 ? totalSpent / completed.length : 0;

    // Favorite sitter
    const sitterCounts = new Map<string, number>();
    for (const b of completed) {
      if (b.sitterId) sitterCounts.set(b.sitterId, (sitterCounts.get(b.sitterId) || 0) + 1);
    }
    let favoriteSitterName: string | null = null;
    if (sitterCounts.size > 0) {
      const topSitterId = [...sitterCounts.entries()].sort((a, b) => b[1] - a[1])[0][0];
      const sitter = await db.sitter.findUnique({
        where: { id: topSitterId },
        select: { firstName: true, lastName: true },
      });
      favoriteSitterName = sitter ? `${sitter.firstName} ${sitter.lastName}`.trim() : null;
    }

    return NextResponse.json({
      year,
      totalSpent: Math.round(totalSpent * 100) / 100,
      visitsCompleted: completed.length,
      averageCost: Math.round(avgCost * 100) / 100,
      favoriteSitter: favoriteSitterName,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: 'Failed', message }, { status: 500 });
  }
}
