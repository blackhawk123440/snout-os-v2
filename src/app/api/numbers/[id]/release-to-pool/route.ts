import { NextRequest, NextResponse } from 'next/server';
import { getRequestContext } from '@/lib/request-context';
import { getScopedDb } from '@/lib/tenancy';

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
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
  const db = getScopedDb({ orgId: ctx.orgId });

  try {
    const activeThreads = await db.messageThread.count({
      where: { orgId: ctx.orgId, messageNumberId: params.id, status: 'open' },
    });
    if (activeThreads > 0) {
      return NextResponse.json(
        { error: `Cannot release to pool while ${activeThreads} active threads are using this number` },
        { status: 409 }
      );
    }
    await db.messageNumber.update({
      where: { id: params.id },
      data: { numberClass: 'pool', assignedSitterId: null, status: 'active' },
    });
    return NextResponse.json({
      success: true,
      impact: {
        affectedThreads: 0,
        message: 'Number released to pool.',
      },
    }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Failed to release number to pool' }, { status: 500 });
  }
}
