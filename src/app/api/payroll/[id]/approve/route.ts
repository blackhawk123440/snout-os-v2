/**
 * POST /api/payroll/[id]/approve
 * Approve a payroll run. Owner/admin only. Run must be status 'pending'.
 * Sets status=approved, approvedAt, approvedBy.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getRequestContext } from '@/lib/request-context';
import { requireOwnerOrAdmin, ForbiddenError } from '@/lib/rbac';
import { getScopedDb } from '@/lib/tenancy';
import { approvePayrollRun } from '@/lib/payroll/payroll-service';

export async function POST(
  request: NextRequest,
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
  const userId = ctx.userId ?? 'owner';
  const body = await request.json().catch(() => ({}));
  const approvedBy = typeof body.approvedBy === 'string' ? body.approvedBy : userId;

  const db = getScopedDb(ctx);
  try {
    const ok = await approvePayrollRun(db, ctx.orgId, id, approvedBy);
    if (!ok) {
      return NextResponse.json(
        { error: 'Run not found or not pending' },
        { status: 400 }
      );
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: 'Failed to approve payroll run', message },
      { status: 500 }
    );
  }
}
