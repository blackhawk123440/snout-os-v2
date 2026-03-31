/**
 * GET/POST /api/sitter/phone
 * Sitter phone number registration for direct messaging (no masking).
 */

import { NextRequest, NextResponse } from 'next/server';
import { getRequestContext } from '@/lib/request-context';
import { requireRole, ForbiddenError } from '@/lib/rbac';
import { getScopedDb } from '@/lib/tenancy';
import { normalizeE164 } from '@/lib/messaging/phone-utils';

export async function GET() {
  let ctx;
  try {
    ctx = await getRequestContext();
    requireRole(ctx, 'sitter');
  } catch (error) {
    if (error instanceof ForbiddenError) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!ctx.sitterId) return NextResponse.json({ error: 'Sitter not found' }, { status: 404 });

  const db = getScopedDb(ctx);
  const sitter = await db.sitter.findUnique({
    where: { id: ctx.sitterId },
    select: { phone: true, personalPhone: true },
  });

  return NextResponse.json({
    phone: sitter?.phone || sitter?.personalPhone || null,
    registered: !!(sitter?.phone),
  });
}

export async function POST(request: NextRequest) {
  let ctx;
  try {
    ctx = await getRequestContext();
    requireRole(ctx, 'sitter');
  } catch (error) {
    if (error instanceof ForbiddenError) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!ctx.sitterId) return NextResponse.json({ error: 'Sitter not found' }, { status: 404 });

  try {
    const body = await request.json();
    const rawPhone = body.phone;
    if (!rawPhone) return NextResponse.json({ error: 'Phone number is required' }, { status: 400 });

    const normalizedPhone = normalizeE164(rawPhone);
    if (!normalizedPhone) return NextResponse.json({ error: 'Invalid phone number' }, { status: 400 });

    const db = getScopedDb(ctx);

    await db.sitter.update({
      where: { id: ctx.sitterId },
      data: { phone: normalizedPhone },
    });

    // Create/update MessageNumber for this sitter's real number
    await (db.messageNumber as any).upsert({
      where: { orgId_e164: { orgId: ctx.orgId, e164: normalizedPhone } },
      create: {
        provider: 'sitter_real',
        e164: normalizedPhone,
        numberClass: 'sitter',
        assignedSitterId: ctx.sitterId,
        status: 'active',
      },
      update: {
        assignedSitterId: ctx.sitterId,
        status: 'active',
      },
    });

    return NextResponse.json({ success: true, phone: normalizedPhone });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
