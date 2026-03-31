import { NextRequest, NextResponse } from 'next/server';
import { getRequestContext } from '@/lib/request-context';
import { requireOwnerOrAdmin, ForbiddenError } from '@/lib/rbac';
import { getScopedDb } from '@/lib/tenancy';

/**
 * GET /api/payments/export
 * Exports payment data as CSV. Used by the Payments tab export button.
 * Supports: timeRange (days), status, type (all|succeeded|failed|refunded)
 */
export async function GET(request: NextRequest) {
  let ctx;
  try {
    ctx = await getRequestContext();
    requireOwnerOrAdmin(ctx);
  } catch (error) {
    if (error instanceof ForbiddenError) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const db = getScopedDb(ctx);
  const { searchParams } = new URL(request.url);
  const timeRange = parseInt(searchParams.get('timeRange') || '30', 10);
  const type = searchParams.get('type') || 'all';
  const since = new Date(Date.now() - timeRange * 24 * 60 * 60 * 1000);

  try {
    const where: Record<string, unknown> = { createdAt: { gte: since } };
    if (type === 'succeeded') where.status = 'succeeded';
    else if (type === 'failed') where.status = 'failed';
    else if (type === 'refunded') where.refunded = true;

    const charges = await db.stripeCharge.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 5000,
    });

    // Build CSV
    const headers = ['Date', 'Charge ID', 'Amount', 'Refunded', 'Net', 'Status', 'Customer Email', 'Customer Name', 'Booking ID', 'Currency'];
    const rows = charges.map((c: any) => {
      const amount = (c.amount || 0) / 100;
      const refunded = (c.amountRefunded || 0) / 100;
      const net = amount - refunded;
      const status = c.refunded ? 'refunded' : c.status;
      const date = c.createdAt instanceof Date ? c.createdAt.toISOString() : String(c.createdAt);
      return [
        date,
        c.id,
        amount.toFixed(2),
        refunded.toFixed(2),
        net.toFixed(2),
        status,
        c.customerEmail || '',
        c.customerName || '',
        c.bookingId || '',
        c.currency || 'usd',
      ].map((v) => `"${String(v).replace(/"/g, '""')}"`).join(',');
    });

    const csv = [headers.join(','), ...rows].join('\n');

    return new NextResponse(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="payments-export-${new Date().toISOString().split('T')[0]}.csv"`,
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: 'Export failed', message }, { status: 500 });
  }
}
