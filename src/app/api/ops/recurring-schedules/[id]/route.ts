import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getScopedDb } from '@/lib/tenancy';
import { getRequestContext } from '@/lib/request-context';
import { requireOwnerOrAdmin, ForbiddenError } from '@/lib/rbac';

const UpdateSchema = z.object({
  sitterId: z.string().nullable().optional(),
  startTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  endTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  totalPrice: z.number().min(0).optional(),
  status: z.enum(['active', 'paused', 'cancelled']).optional(),
  effectiveUntil: z.string().nullable().optional(),
  daysOfWeek: z.array(z.number().min(0).max(6)).nullable().optional(),
  address: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  petIds: z.array(z.string()).nullable().optional(),
  invoicingMode: z.enum(['per_visit', 'weekly', 'monthly']).optional(),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  let ctx;
  try {
    ctx = await getRequestContext();
    requireOwnerOrAdmin(ctx);
  } catch (error) {
    if (error instanceof ForbiddenError) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;

  try {
    const body = await request.json();
    const parsed = UpdateSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: 'Invalid input' }, { status: 400 });

    const db = getScopedDb(ctx);
    const existing = await db.recurringSchedule.findFirst({ where: { id }, select: { id: true } });
    if (!existing) return NextResponse.json({ error: 'Schedule not found' }, { status: 404 });

    const data: Record<string, unknown> = {};
    const d = parsed.data;
    if (d.sitterId !== undefined) data.sitterId = d.sitterId;
    if (d.startTime) data.startTime = d.startTime;
    if (d.endTime) data.endTime = d.endTime;
    if (d.totalPrice !== undefined) data.totalPrice = d.totalPrice;
    if (d.status) data.status = d.status;
    if (d.effectiveUntil !== undefined) data.effectiveUntil = d.effectiveUntil ? new Date(d.effectiveUntil) : null;
    if (d.daysOfWeek !== undefined) data.daysOfWeek = d.daysOfWeek ? JSON.stringify(d.daysOfWeek) : null;
    if (d.address !== undefined) data.address = d.address;
    if (d.notes !== undefined) data.notes = d.notes;
    if (d.petIds !== undefined) data.petIds = d.petIds ? JSON.stringify(d.petIds) : null;
    if (d.invoicingMode) data.invoicingMode = d.invoicingMode;

    const updated = await db.recurringSchedule.update({ where: { id }, data });
    return NextResponse.json({ schedule: updated });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: 'Failed to update', message }, { status: 500 });
  }
}
