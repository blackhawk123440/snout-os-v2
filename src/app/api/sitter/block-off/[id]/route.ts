import { NextResponse } from 'next/server';
import { getScopedDb } from '@/lib/tenancy';
import { getRequestContext } from '@/lib/request-context';
import { requireRole, ForbiddenError } from '@/lib/rbac';

/**
 * DELETE /api/sitter/block-off/[id]
 */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  let ctx;
  try {
    ctx = await getRequestContext();
    requireRole(ctx, 'sitter');
  } catch (error) {
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!ctx.sitterId) {
    return NextResponse.json({ error: 'Sitter profile missing on session' }, { status: 403 });
  }

  const { id } = await params;

  try {
    const db = getScopedDb(ctx);
    await db.$transaction(async (tx) => {
      const block = await tx.sitterTimeOff.findFirst({
        where: {
          id,
          sitterId: ctx.sitterId!,
          type: 'block',
        },
      });
      if (!block) {
        throw new Error('NOT_FOUND');
      }
      await tx.sitterTimeOff.delete({ where: { id } });
    });
    return NextResponse.json({ ok: true });
  } catch (error: unknown) {
    if (error instanceof Error && error.message === 'NOT_FOUND') {
      return NextResponse.json({ error: 'Block not found' }, { status: 404 });
    }
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: 'Failed to remove block-off day', message },
      { status: 500 }
    );
  }
}
