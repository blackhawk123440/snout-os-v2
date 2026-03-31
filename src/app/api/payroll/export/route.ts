/**
 * GET /api/payroll/export
 * Export payroll as CSV. Query: runId (required) or first run used.
 * Columns: sitter name, earnings, commission, payout amount, stripe account, booking count.
 * Owner/admin only.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getRequestContext } from '@/lib/request-context';
import { requireOwnerOrAdmin, ForbiddenError } from '@/lib/rbac';
import { getScopedDb } from '@/lib/tenancy';
import { listPayrollRuns, getPayrollRunExportRows } from '@/lib/payroll/payroll-service';

function escapeCsv(s: string): string {
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export async function GET(request: NextRequest) {
  let ctx;
  try {
    ctx = await getRequestContext();
    requireOwnerOrAdmin(ctx);
  } catch (error) {
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const runId = searchParams.get('runId') ?? undefined;

  const db = getScopedDb(ctx);
  try {
    let targetRunId = runId;
    if (!targetRunId) {
      const runs = await listPayrollRuns(db, ctx.orgId);
      targetRunId = runs[0]?.id ?? null;
    }
    if (!targetRunId) {
      return NextResponse.json(
        { error: 'No payroll run to export' },
        { status: 404 }
      );
    }

    const rows = await getPayrollRunExportRows(db, ctx.orgId, targetRunId);
    if (!rows || rows.length === 0) {
      return new NextResponse(
        'Sitter Name,Earnings,Commission,Payout Amount,Stripe Account,Booking Count\n',
        {
          headers: {
            'Content-Type': 'text/csv; charset=utf-8',
            'Content-Disposition': `attachment; filename="payroll-export-${new Date().toISOString().slice(0, 10)}.csv"`,
          },
        }
      );
    }

    const header = 'Sitter Name,Earnings,Commission,Payout Amount,Stripe Account,Booking Count';
    const lines = rows.map(
      (r) =>
        `${escapeCsv(r.sitterName)},${r.earnings},${r.commission},${r.payoutAmount},${escapeCsv(r.stripeAccount)},${r.bookingCount}`
    );
    const csv = [header, ...lines].join('\n');

    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="payroll-export-${new Date().toISOString().slice(0, 10)}.csv"`,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: 'Failed to export payroll', message },
      { status: 500 }
    );
  }
}
