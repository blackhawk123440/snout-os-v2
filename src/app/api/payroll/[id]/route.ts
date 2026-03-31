/**
 * GET /api/payroll/[id]
 * Payroll run detail: run + sitters (earnings, commission, payout, stripe status).
 * Owner/admin only. Data from Booking + Sitter + PayoutTransfer.
 */

import { NextResponse } from 'next/server';
import { getRequestContext } from '@/lib/request-context';
import { requireOwnerOrAdmin, ForbiddenError } from '@/lib/rbac';
import { getScopedDb } from '@/lib/tenancy';
import { getPayrollRunDetail } from '@/lib/payroll/payroll-service';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
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

  const { id } = await params;
  const db = getScopedDb(ctx);
  try {
    const detail = await getPayrollRunDetail(db, ctx.orgId, id);
    if (!detail) {
      return NextResponse.json({ error: 'Payroll run not found' }, { status: 404 });
    }
    return NextResponse.json({
      run: detail.run,
      sitters: detail.sitters,
      bookings: detail.bookings,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Unknown error';
    return NextResponse.json(
      { error: 'Failed to load payroll run', message },
      { status: 500 }
    );
  }
}
