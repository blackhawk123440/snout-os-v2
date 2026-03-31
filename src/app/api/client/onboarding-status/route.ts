import { NextResponse } from 'next/server';
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

  const db = getScopedDb(ctx);
  try {
    const [client, petCount, contactCount] = await Promise.all([
      db.client.findFirst({
        where: { id: ctx.clientId },
        select: { address: true, keyLocation: true, entryInstructions: true },
      }),
      db.pet.count({
        where: { clientId: ctx.clientId, isActive: true },
      }),
      db.clientEmergencyContact.count({
        where: { clientId: ctx.clientId },
      }),
    ]);

    const hasAddress = !!client?.address?.trim();
    const hasHomeAccess = !!(client?.keyLocation?.trim() || client?.entryInstructions?.trim());
    const hasPets = petCount > 0;
    const hasEmergencyContact = contactCount > 0;

    const checks = [true, hasPets, hasEmergencyContact, hasAddress, hasHomeAccess];
    const done = checks.filter(Boolean).length;
    const completionPercent = Math.round((done / checks.length) * 100);

    return NextResponse.json({
      hasAccount: true,
      hasPets,
      hasEmergencyContact,
      hasAddress,
      hasHomeAccess,
      completionPercent,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: 'Failed to load status', message }, { status: 500 });
  }
}
