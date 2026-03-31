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
  const body = await request.json().catch(() => null);
  const sitterId = body?.sitterId as string | undefined;
  if (!sitterId) {
    return NextResponse.json({ error: 'sitterId is required' }, { status: 400 });
  }
  const db = getScopedDb({ orgId: ctx.orgId });
  try {
    const existing = await db.messageNumber.findFirst({
      where: { id: params.id, orgId: ctx.orgId },
    });
    if (!existing) return NextResponse.json({ error: 'Number not found' }, { status: 404 });
    await db.messageNumber.update({
      where: { id: existing.id },
      data: { assignedSitterId: sitterId, numberClass: 'sitter', status: 'active' },
    });
    return NextResponse.json({ success: true, message: 'Number assigned to sitter successfully' }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Failed to assign number' }, { status: 500 });
  }
}
