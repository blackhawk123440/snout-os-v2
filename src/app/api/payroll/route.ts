/**
 * GET /api/payroll
 * List payroll runs for the org. Owner/admin only.
 * Ensures runs exist from PayoutTransfer data, then returns list.
 */

import { NextResponse } from 'next/server';
import { getRequestContext } from '@/lib/request-context';
import { requireOwnerOrAdmin, ForbiddenError } from '@/lib/rbac';
import { getScopedDb } from '@/lib/tenancy';
import { listPayrollRuns } from '@/lib/payroll/payroll-service';

export async function GET() {
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

  const db = getScopedDb(ctx);
  try {
    const runs = await listPayrollRuns(db, ctx.orgId);
    return NextResponse.json({ payPeriods: runs });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: 'Failed to load payroll', message },
      { status: 500 }
    );
  }
}
