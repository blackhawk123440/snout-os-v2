/**
 * DELETE /api/sitter/availability-overrides/[id]
 */

import { NextRequest, NextResponse } from 'next/server';
import { getScopedDb } from '@/lib/tenancy';
import { getRequestContext } from '@/lib/request-context';
import { requireRole, ForbiddenError } from '@/lib/rbac';

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = await getRequestContext();
    requireRole(ctx, 'sitter');
    if (!ctx.sitterId) {
      return NextResponse.json({ error: 'Sitter profile missing' }, { status: 403 });
    }

    const { id } = await params;
    const db = getScopedDb(ctx);
    const result = await (db as any).sitterAvailabilityOverride.deleteMany({
      where: { id, sitterId: ctx.sitterId },
    });
    if (result.count === 0) {
      return NextResponse.json({ error: 'Override not found' }, { status: 404 });
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
}
