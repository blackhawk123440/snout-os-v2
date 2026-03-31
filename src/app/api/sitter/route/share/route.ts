/**
 * POST /api/sitter/route/share
 * Generates a shareable route link and notifies the owner.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getRequestContext } from '@/lib/request-context';
import { requireRole, ForbiddenError } from '@/lib/rbac';
import { getScopedDb } from '@/lib/tenancy';
import { logEvent } from '@/lib/log-event';

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
    const body = await request.json().catch(() => ({}));
    const date = body.date || new Date().toISOString().slice(0, 10);

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXTAUTH_URL || 'http://localhost:3000';
    const shareUrl = `${appUrl}/sitters/${ctx.sitterId}?tab=route&date=${date}`;

    // Notify owner
    try {
      const { notifyOwnerPersonalPhone } = await import('@/lib/automation-owner-notify');
      const db = getScopedDb(ctx);
      const sitter = await db.sitter.findUnique({
        where: { id: ctx.sitterId },
        select: { firstName: true, lastName: true },
      });
      const sitterName = sitter ? `${sitter.firstName} ${sitter.lastName}`.trim() : 'A sitter';
      await notifyOwnerPersonalPhone({
        bookingId: ctx.sitterId, // Using sitterId as reference
        message: `📍 ${sitterName} shared their route for ${date}`,
        automationType: 'route.shared',
      });
    } catch {}

    await logEvent({
      orgId: ctx.orgId,
      action: 'route.shared',
      status: 'success',
      metadata: { sitterId: ctx.sitterId, date },
    }).catch(() => {});

    return NextResponse.json({ shareUrl, date });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to share route' }, { status: 500 });
  }
}
