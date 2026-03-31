/**
 * GET /api/sitter/mileage/report?month=2026-03&format=json|csv
 * Returns mileage summary for a sitter for the given month.
 * Auth: sitter only, scoped to own data.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getRequestContext } from '@/lib/request-context';
import { prisma } from '@/lib/db';

const IRS_RATE_PER_MILE = 0.70; // 2025 IRS standard mileage rate

export async function GET(request: NextRequest) {
  let ctx;
  try {
    ctx = await getRequestContext(request);
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (ctx.role !== 'sitter' || !ctx.sitterId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const month = request.nextUrl.searchParams.get('month')
    || new Date().toISOString().slice(0, 7); // Default to current month
  const format = request.nextUrl.searchParams.get('format') || 'json';

  try {
    const logs = await (prisma as any).sitterMileageLog.findMany({
      where: {
        orgId: ctx.orgId,
        sitterId: ctx.sitterId,
        month,
      },
      orderBy: { createdAt: 'asc' },
    });

    const totalMiles = logs.reduce((sum: number, l: any) => sum + (l.actualMi ?? l.estimatedMi ?? 0), 0);
    const estimatedDeduction = Math.round(totalMiles * IRS_RATE_PER_MILE * 100) / 100;

    const trips = logs.map((l: any) => ({
      date: l.createdAt.toISOString().slice(0, 10),
      fromAddress: l.fromAddress,
      toAddress: l.toAddress,
      miles: l.actualMi ?? l.estimatedMi,
      bookingId: l.bookingId,
    }));

    if (format === 'csv') {
      const header = 'Date,From,To,Miles,Booking ID\n';
      const rows = trips.map((t: any) =>
        `${t.date},"${t.fromAddress || ''}","${t.toAddress || ''}",${t.miles},${t.bookingId}`
      ).join('\n');
      const csv = header + rows + `\n\nTotal Miles,${totalMiles}\nEstimated Deduction,$${estimatedDeduction}\nIRS Rate,$${IRS_RATE_PER_MILE}/mile`;

      return new NextResponse(csv, {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="mileage-${month}.csv"`,
        },
      });
    }

    return NextResponse.json({
      data: {
        month,
        totalMiles: Math.round(totalMiles * 10) / 10,
        estimatedDeduction,
        irsRatePerMile: IRS_RATE_PER_MILE,
        tripCount: trips.length,
        trips,
      },
    });
  } catch (error: any) {
    console.error('[mileage/report] Error:', error);
    return NextResponse.json({ error: 'Failed to load mileage report' }, { status: 500 });
  }
}
