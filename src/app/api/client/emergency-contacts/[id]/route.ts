import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getScopedDb } from '@/lib/tenancy';
import { getRequestContext } from '@/lib/request-context';
import { ForbiddenError, requireRole, requireClientContext } from '@/lib/rbac';

const UpdateContactSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  phone: z.string().min(5).max(30).optional(),
  relationship: z.string().max(50).optional().nullable(),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  let ctx;
  try {
    ctx = await getRequestContext();
    requireRole(ctx, 'client');
    requireClientContext(ctx);
  } catch (error) {
    if (error instanceof ForbiddenError) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;

  try {
    const db = getScopedDb(ctx);
    const body = await request.json();
    const parsed = UpdateContactSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: 'Invalid input' }, { status: 400 });

    const updated = await db.$transaction(async (tx) => {
      const existing = await tx.clientEmergencyContact.findFirst({
        where: { id, clientId: ctx.clientId },
      });
      if (!existing) return null;

      const data: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(parsed.data)) {
        if (value !== undefined) data[key] = value;
      }

      return tx.clientEmergencyContact.update({
        where: { id },
        data,
        select: { id: true, name: true, phone: true, relationship: true },
      });
    });

    if (!updated) return NextResponse.json({ error: 'Contact not found' }, { status: 404 });

    return NextResponse.json(updated);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: 'Failed to update contact', message }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  let ctx;
  try {
    ctx = await getRequestContext();
    requireRole(ctx, 'client');
    requireClientContext(ctx);
  } catch (error) {
    if (error instanceof ForbiddenError) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;

  try {
    const db = getScopedDb(ctx);

    const deleted = await db.$transaction(async (tx) => {
      const existing = await tx.clientEmergencyContact.findFirst({
        where: { id, clientId: ctx.clientId },
      });
      if (!existing) return false;

      await tx.clientEmergencyContact.delete({ where: { id } });
      return true;
    });

    if (!deleted) return NextResponse.json({ error: 'Contact not found' }, { status: 404 });

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: 'Failed to delete contact', message }, { status: 500 });
  }
}
