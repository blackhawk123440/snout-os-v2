import { NextRequest, NextResponse } from 'next/server';
import { getScopedDb } from '@/lib/tenancy';
import { getRequestContext } from '@/lib/request-context';
import { requireAnyRole, ForbiddenError } from '@/lib/rbac';

async function getOwnerCtx() {
  const ctx = await getRequestContext();
  requireAnyRole(ctx, ['owner', 'admin']);
  return ctx;
}

const DEFAULTS = {
  smsEnabled: true,
  emailEnabled: false,
  ownerAlerts: true,
  sitterNotifications: true,
  clientReminders: true,
  paymentReminders: true,
  conflictNoticeEnabled: true,
  reminderTiming: '24h',
  preferences: null as string | null,
};

export async function GET() {
  try {
    const ctx = await getOwnerCtx();
    const db = getScopedDb(ctx);
    const row = await db.orgNotificationSettings.findUnique({
      where: { orgId: ctx.orgId },
    });
    if (!row) {
      return NextResponse.json({ settings: DEFAULTS });
    }
    return NextResponse.json({
      settings: {
        smsEnabled: row.smsEnabled,
        emailEnabled: row.emailEnabled,
        ownerAlerts: row.ownerAlerts,
        sitterNotifications: row.sitterNotifications,
        clientReminders: row.clientReminders,
        paymentReminders: row.paymentReminders,
        conflictNoticeEnabled: row.conflictNoticeEnabled,
        reminderTiming: row.reminderTiming ?? DEFAULTS.reminderTiming,
        preferences: row.preferences,
      },
    });
  } catch (e) {
    if (e instanceof ForbiddenError) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    throw e;
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const ctx = await getOwnerCtx();
    const db = getScopedDb(ctx);
    const body = await request.json().catch(() => ({}));
    const data: Record<string, unknown> = {
      smsEnabled: body.smsEnabled !== false,
      emailEnabled: body.emailEnabled === true,
      ownerAlerts: body.ownerAlerts !== false,
      sitterNotifications: body.sitterNotifications !== false,
      clientReminders: body.clientReminders !== false,
      paymentReminders: body.paymentReminders !== false,
      conflictNoticeEnabled: body.conflictNoticeEnabled !== false,
      reminderTiming: body.reminderTiming != null ? String(body.reminderTiming) : undefined,
      preferences: body.preferences != null ? (typeof body.preferences === 'string' ? body.preferences : JSON.stringify(body.preferences)) : undefined,
    };
    const updated = await db.orgNotificationSettings.upsert({
      where: { orgId: ctx.orgId },
      create: {
        smsEnabled: data.smsEnabled as boolean,
        emailEnabled: data.emailEnabled as boolean,
        ownerAlerts: data.ownerAlerts as boolean,
        sitterNotifications: data.sitterNotifications as boolean,
        clientReminders: data.clientReminders as boolean,
        paymentReminders: data.paymentReminders as boolean,
        conflictNoticeEnabled: data.conflictNoticeEnabled as boolean,
        reminderTiming: (data.reminderTiming as string) ?? DEFAULTS.reminderTiming,
        preferences: (data.preferences as string) ?? null,
      },
      update: data as Parameters<typeof db.orgNotificationSettings.update>[0]['data'],
    });
    return NextResponse.json({
      settings: {
        smsEnabled: updated.smsEnabled,
        emailEnabled: updated.emailEnabled,
        ownerAlerts: updated.ownerAlerts,
        sitterNotifications: updated.sitterNotifications,
        clientReminders: updated.clientReminders,
        paymentReminders: updated.paymentReminders,
        conflictNoticeEnabled: updated.conflictNoticeEnabled,
        reminderTiming: updated.reminderTiming,
        preferences: updated.preferences,
      },
    });
  } catch (e) {
    if (e instanceof ForbiddenError) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    throw e;
  }
}

// Accept POST for compatibility with existing settings write checks/clients.
export const POST = PATCH;
