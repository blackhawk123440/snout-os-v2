import { NextRequest, NextResponse } from 'next/server';
import { getRequestContext } from '@/lib/request-context';
import { getScopedDb } from '@/lib/tenancy';

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ sitterId: string }> }
) {
  let ctx;
  try {
    ctx = await getRequestContext();
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (ctx.role !== 'owner' && ctx.role !== 'admin') {
    return NextResponse.json({ error: 'Owner access required' }, { status: 403 });
  }

  const params = await context.params;
  const sitterId = params.sitterId;
  const db = getScopedDb({ orgId: ctx.orgId });

  try {
    const activeAssignments = await db.assignmentWindow.count({
      where: { orgId: ctx.orgId, sitterId, status: 'active', endAt: { gte: new Date() } },
    });
    const numbersAffected = await db.messageNumber.updateMany({
      where: { orgId: ctx.orgId, assignedSitterId: sitterId },
      data: { assignedSitterId: null, numberClass: 'pool', status: 'active' },
    });
    return NextResponse.json({
      success: true,
      message: 'Sitter deactivated and assigned numbers released to pool',
      activeAssignments,
      numbersAffected: numbersAffected.count,
    }, {
      status: 200,
      headers: { 'X-Snout-Route': 'prisma', 'X-Snout-OrgId': ctx.orgId },
    });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Failed to deactivate sitter' }, { status: 500 });
  }
}
