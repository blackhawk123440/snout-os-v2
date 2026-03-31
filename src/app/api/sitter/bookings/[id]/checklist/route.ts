import { NextResponse } from 'next/server';
import { getScopedDb } from '@/lib/tenancy';
import { getRequestContext } from '@/lib/request-context';
import { requireRole, ForbiddenError } from '@/lib/rbac';

const CHECKLIST_TYPES = new Set(['arrived', 'leash', 'fed', 'water', 'meds', 'locked_door']);
const UNCHECK_LOCK_WINDOW_MS = 5 * 60 * 1000;

/**
 * PATCH /api/sitter/bookings/[id]/checklist
 * Body: { type: string, checked: boolean }
 */
export async function PATCH(
  request: Request,
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
  const db = getScopedDb(ctx);

  const body = await request.json().catch(() => ({} as { type?: string; checked?: boolean }));
  const type = typeof body.type === 'string' ? body.type : '';
  const checked = body.checked === true;

  if (!CHECKLIST_TYPES.has(type)) {
    return NextResponse.json({ error: 'Invalid checklist type' }, { status: 400 });
  }

  const booking = await db.booking.findFirst({
    where: { id, sitterId: ctx.sitterId },
    select: { id: true, orgId: true },
  });
  if (!booking) {
    return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
  }

  const existing = await db.bookingChecklistItem.findUnique({
    where: { bookingId_type: { bookingId: id, type } },
    select: { id: true, checkedAt: true },
  });

  if (checked) {
    // Idempotent: keep the original timestamp once checked.
    if (existing?.checkedAt) {
      return NextResponse.json({ ok: true, locked: false });
    }
    if (existing) {
      await db.bookingChecklistItem.update({
        where: { id: existing.id },
        data: { checkedAt: new Date() },
      });
      return NextResponse.json({ ok: true, locked: false });
    }
    await db.bookingChecklistItem.create({
      data: {
        orgId: ctx.orgId,
        bookingId: id,
        type,
        checkedAt: new Date(),
      },
    });
    return NextResponse.json({ ok: true, locked: false });
  }

  // Uncheck flow with lock window.
  if (!existing || !existing.checkedAt) {
    return NextResponse.json({ ok: true, locked: false });
  }
  const checkedAtMs =
    existing.checkedAt instanceof Date ? existing.checkedAt.getTime() : new Date(existing.checkedAt).getTime();
  if (Date.now() - checkedAtMs > UNCHECK_LOCK_WINDOW_MS) {
    return NextResponse.json({ error: 'Checklist item is locked' }, { status: 400 });
  }

  await db.bookingChecklistItem.update({
    where: { id: existing.id },
    data: { checkedAt: null },
  });

  return NextResponse.json({ ok: true, locked: false });
}
