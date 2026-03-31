import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getScopedDb } from '@/lib/tenancy';
import { getRequestContext } from '@/lib/request-context';
import { ForbiddenError, requireRole, requireClientContext } from '@/lib/rbac';

export async function GET() {
  let ctx;
  try {
    ctx = await getRequestContext();
    requireRole(ctx, 'client');
    requireClientContext(ctx);
  } catch (error) {
    if (error instanceof ForbiddenError) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const db = getScopedDb(ctx);
    const contacts = await db.clientEmergencyContact.findMany({
      where: { clientId: ctx.clientId },
      select: { id: true, name: true, phone: true, relationship: true },
      orderBy: { createdAt: 'asc' },
    });
    return NextResponse.json({ contacts });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: 'Failed to load contacts', message }, { status: 500 });
  }
}

const CreateContactSchema = z.object({
  name: z.string().min(1).max(100),
  phone: z.string().min(5).max(30),
  relationship: z.string().max(50).optional(),
});

export async function POST(request: NextRequest) {
  let ctx;
  try {
    ctx = await getRequestContext();
    requireRole(ctx, 'client');
    requireClientContext(ctx);
  } catch (error) {
    if (error instanceof ForbiddenError) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const db = getScopedDb(ctx);
    const body = await request.json();
    const parsed = CreateContactSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: 'Invalid input', details: parsed.error.issues }, { status: 400 });

    const contact = await (db.clientEmergencyContact as any).create({
      data: {
        clientId: ctx.clientId,
        name: parsed.data.name,
        phone: parsed.data.phone,
        relationship: parsed.data.relationship || null,
      },
    });

    return NextResponse.json({ id: contact.id, name: contact.name, phone: contact.phone, relationship: contact.relationship }, { status: 201 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: 'Failed to add contact', message }, { status: 500 });
  }
}
