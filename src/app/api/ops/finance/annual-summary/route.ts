import { NextRequest, NextResponse } from 'next/server';
import { getScopedDb } from '@/lib/tenancy';
import { getRequestContext } from '@/lib/request-context';
import { requireOwnerOrAdmin, ForbiddenError } from '@/lib/rbac';

export async function GET(request: NextRequest) {
  let ctx;
  try {
    ctx = await getRequestContext();
    requireOwnerOrAdmin(ctx);
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
    // Monthly revenue
    const charges = await db.stripeCharge.findMany({
      where: { status: 'succeeded', createdAt: { gte: yearStart, lt: yearEnd } },
      select: { amount: true, amountRefunded: true, createdAt: true },
    });

    const monthlyRevenue = Array.from({ length: 12 }, (_, i) => {
      const monthCharges = charges.filter((c: any) => new Date(c.createdAt).getMonth() === i);
      const gross = monthCharges.reduce((s: number, c: any) => s + (c.amount || 0), 0) / 100;
      const refunded = monthCharges.reduce((s: number, c: any) => s + (c.amountRefunded || 0), 0) / 100;
      return {
        month: i + 1,
        label: new Date(year, i).toLocaleString('en-US', { month: 'short' }),
        amount: Math.round((gross - refunded) * 100) / 100,
      };
    });

    const totalGross = charges.reduce((s: number, c: any) => s + (c.amount || 0), 0) / 100;
    const totalRefunded = charges.reduce((s: number, c: any) => s + (c.amountRefunded || 0), 0) / 100;
    const totalCollected = totalGross - totalRefunded;

    // Outstanding
    const outstanding = await db.booking.aggregate({
      where: { paymentStatus: { not: 'paid' }, status: { not: 'cancelled' }, startAt: { gte: yearStart, lt: yearEnd } },
      _sum: { totalPrice: true },
    });

    // Top clients
    const clientRevenue = await db.booking.groupBy({
      by: ['clientId'],
      where: { paymentStatus: 'paid', startAt: { gte: yearStart, lt: yearEnd }, clientId: { not: null } },
      _sum: { totalPrice: true },
      _count: { id: true },
      orderBy: { _sum: { totalPrice: 'desc' } },
      take: 10,
    });

    const clientIds = clientRevenue.map((c: any) => c.clientId).filter(Boolean);
    const clients = clientIds.length
      ? await db.client.findMany({ where: { id: { in: clientIds } }, select: { id: true, firstName: true, lastName: true } })
      : [];
    const clientMap = new Map(clients.map((c: any) => [c.id, c]));

    const topClients = clientRevenue.map((c: any) => {
      const client = clientMap.get(c.clientId);
      return {
        clientName: client ? `${client.firstName} ${client.lastName}`.trim() : 'Unknown',
        revenue: c._sum?.totalPrice || 0,
        bookings: c._count?.id || 0,
      };
    });

    // Top services
    const serviceRevenue = await db.booking.groupBy({
      by: ['service'],
      where: { paymentStatus: 'paid', startAt: { gte: yearStart, lt: yearEnd } },
      _sum: { totalPrice: true },
      _count: { id: true },
      orderBy: { _sum: { totalPrice: 'desc' } },
      take: 10,
    });

    return NextResponse.json({
      year,
      monthlyRevenue,
      totalCollected: Math.round(totalCollected * 100) / 100,
      totalOutstanding: Math.round((outstanding._sum?.totalPrice || 0) * 100) / 100,
      topClients,
      topServices: serviceRevenue.map((s: any) => ({
        service: s.service,
        revenue: s._sum?.totalPrice || 0,
        bookings: s._count?.id || 0,
      })),
    }, {
      headers: { 'Cache-Control': 'private, s-maxage=60, stale-while-revalidate=30' },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: 'Failed', message }, { status: 500 });
  }
}
