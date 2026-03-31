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
  const numberId = params.id;
  const db = getScopedDb({ orgId: ctx.orgId });

  let body: { forceRestore?: boolean; restoreReason?: string } = {};
  try {
    const bodyText = await request.text();
    if (bodyText) {
      body = JSON.parse(bodyText);
    }
  } catch {
    // Empty body is OK for normal release
  }

  // Require restoreReason if forceRestore is true
  if (body.forceRestore === true && !body.restoreReason) {
    return NextResponse.json(
      { error: 'restoreReason is required when forceRestore is true' },
      { status: 400 }
    );
  }

  try {
    await db.messageNumber.update({
      where: { id: numberId },
      data: { status: 'active' },
    });
    return NextResponse.json({
      success: true,
      message: 'Number released from quarantine',
    }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Failed to release number' }, { status: 500 });
  }
}
