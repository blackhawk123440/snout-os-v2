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
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const db = getScopedDb(ctx);

    const client = await db.client.findFirst({
      where: { id: ctx.clientId },
      select: {
        firstName: true, lastName: true, email: true, phone: true, address: true,
        keyLocation: true, lockboxCode: true, doorAlarmCode: true,
        wifiNetwork: true, wifiPassword: true, entryInstructions: true, parkingNotes: true,
      },
    });

    if (!client) {
      return NextResponse.json({ error: 'Client not found' }, { status: 404 });
    }

    const name = [client.firstName, client.lastName].filter(Boolean).join(' ') || null;
    return NextResponse.json({ ...client, name });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: 'Failed to load profile', message }, { status: 500 });
  }
}

const UpdateProfileSchema = z.object({
  firstName: z.string().min(1).max(100).optional(),
  lastName: z.string().min(1).max(100).optional(),
  email: z.string().email().max(200).optional().nullable(),
  phone: z.string().min(5).max(30).optional(),
  address: z.string().max(500).optional().nullable(),
  keyLocation: z.string().max(200).optional().nullable(),
  lockboxCode: z.string().max(50).optional().nullable(),
  doorAlarmCode: z.string().max(50).optional().nullable(),
  wifiNetwork: z.string().max(100).optional().nullable(),
  wifiPassword: z.string().max(100).optional().nullable(),
  entryInstructions: z.string().max(2000).optional().nullable(),
  parkingNotes: z.string().max(500).optional().nullable(),
});

export async function PATCH(request: NextRequest) {
  let ctx;
  try {
    ctx = await getRequestContext();
    requireRole(ctx, 'client');
    requireClientContext(ctx);
  } catch (error) {
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const db = getScopedDb(ctx);

    const body = await request.json();
    const parsed = UpdateProfileSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid input', details: parsed.error.issues }, { status: 400 });
    }

    const data: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(parsed.data)) {
      if (value !== undefined) data[key] = value;
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
    }

    const updated = await db.client.update({
      where: { id: ctx.clientId },
      data,
      select: {
        firstName: true, lastName: true, email: true, phone: true, address: true,
        keyLocation: true, lockboxCode: true, doorAlarmCode: true,
        wifiNetwork: true, wifiPassword: true, entryInstructions: true, parkingNotes: true,
      },
    });

    const name = [updated.firstName, updated.lastName].filter(Boolean).join(' ') || null;
    return NextResponse.json({ ...updated, name });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: 'Failed to update profile', message }, { status: 500 });
  }
}
