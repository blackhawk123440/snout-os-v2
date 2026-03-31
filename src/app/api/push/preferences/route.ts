/**
 * GET  /api/push/preferences — Get current user's notification preferences
 * PATCH /api/push/preferences — Update preferences
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getSessionSafe } from '@/lib/auth-helpers';

export async function GET() {
  const session = await getSessionSafe();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const prefs = await prisma.userNotificationPreferences.findUnique({
    where: { userId: session.user.id },
  });

  // Return defaults if no record exists
  return NextResponse.json({
    preferences: prefs ?? {
      pushEnabled: true,
      pushMessages: true,
      pushVisitStarted: true,
      pushReports: true,
      pushAssignments: true,
      pushCallouts: true,
    },
  });
}

export async function PATCH(req: NextRequest) {
  const session = await getSessionSafe();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  try {
    const body = await req.json();

    // Only allow known boolean fields
    const allowed = ['pushEnabled', 'pushMessages', 'pushVisitStarted', 'pushReports', 'pushAssignments', 'pushCallouts'];
    const data: Record<string, boolean> = {};
    for (const key of allowed) {
      if (typeof body[key] === 'boolean') {
        data[key] = body[key];
      }
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
    }

    const prefs = await prisma.userNotificationPreferences.upsert({
      where: { userId: session.user.id },
      update: data,
      create: {
        userId: session.user.id,
        ...data,
      },
    });

    return NextResponse.json({ preferences: prefs });
  } catch (error) {
    console.error('[Push] Preferences update error:', error);
    return NextResponse.json({ error: 'Failed to update preferences' }, { status: 500 });
  }
}
