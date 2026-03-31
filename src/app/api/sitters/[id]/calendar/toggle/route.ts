/**
 * Toggle Calendar Sync API
 *
 * POST: Enable or disable calendar sync for a sitter
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getScopedDb } from '@/lib/tenancy';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const user = session.user as any;
  const resolvedParams = await params;
  const sitterId = resolvedParams.id;
  const orgId = user.orgId || (await import('@/lib/messaging/org-helpers')).getDefaultOrgId();

  if (!orgId) {
    return NextResponse.json({ error: 'Organization not found' }, { status: 400 });
  }

  const db = getScopedDb({ orgId });

  // Permission check: sitter can only toggle their own sync, owner/admin can toggle any
  if (user.role === 'sitter' && user.sitterId !== sitterId) {
    return NextResponse.json({ error: 'Forbidden: You can only toggle your own calendar sync' }, { status: 403 });
  }

  try {
    const body = await request.json();
    const { enabled } = body;

    if (typeof enabled !== 'boolean') {
      return NextResponse.json({ error: 'enabled must be a boolean' }, { status: 400 });
    }

    // Verify sitter exists and is connected
    const sitter = await (db as any).sitter.findUnique({
      where: { id: sitterId },
      select: {
        id: true,
        googleAccessToken: true,
        googleRefreshToken: true,
      },
    });

    if (!sitter) {
      return NextResponse.json({ error: 'Sitter not found' }, { status: 404 });
    }

    if (!sitter.googleAccessToken || !sitter.googleRefreshToken) {
      return NextResponse.json(
        { error: 'Sitter must connect Google Calendar first' },
        { status: 400 }
      );
    }

    // Update sync enabled status
    await (db as any).sitter.update({
      where: { id: sitterId },
      data: {
        calendarSyncEnabled: enabled,
      },
    });

    return NextResponse.json({ success: true, syncEnabled: enabled });
  } catch (error: any) {
    console.error('[Calendar Toggle API] Failed to toggle sync:', error);
    return NextResponse.json(
      { error: 'Failed to toggle calendar sync', message: error.message },
      { status: 500 }
    );
  }
}
