import { NextRequest, NextResponse } from 'next/server';
import { getScopedDb } from '@/lib/tenancy';
import { getRequestContext } from '@/lib/request-context';
import { requireAnyRole, ForbiddenError } from '@/lib/rbac';

async function getOwnerCtx() {
  const ctx = await getRequestContext();
  requireAnyRole(ctx, ['owner', 'admin']);
  return ctx;
}

export async function GET() {
  try {
    const ctx = await getOwnerCtx();
    const db = getScopedDb(ctx);
    const row = await db.businessSettings.findUnique({
      where: { orgId: ctx.orgId },
    });
    if (!row) {
      return NextResponse.json({
        settings: {
          businessName: '',
          businessPhone: '',
          businessEmail: '',
          businessAddress: '',
          timeZone: 'America/New_York',
          operatingHours: null,
          holidays: null,
          taxSettings: null,
          contentBlocks: null,
        },
      });
    }
    return NextResponse.json({
      settings: {
        businessName: row.businessName,
        businessPhone: row.businessPhone ?? '',
        businessEmail: row.businessEmail ?? '',
        businessAddress: row.businessAddress ?? '',
        timeZone: row.timeZone,
        operatingHours: row.operatingHours,
        holidays: row.holidays,
        taxSettings: row.taxSettings,
        contentBlocks: row.contentBlocks,
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
    const body = await request.json();
    const businessName = typeof body.businessName === 'string' ? body.businessName.trim() : undefined;
    const businessPhone = body.businessPhone != null ? String(body.businessPhone) : undefined;
    const businessEmail = body.businessEmail != null ? String(body.businessEmail) : undefined;
    const businessAddress = body.businessAddress != null ? String(body.businessAddress) : undefined;
    const timeZone = body.timeZone != null ? String(body.timeZone) : undefined;
    const operatingHours = body.operatingHours != null ? (typeof body.operatingHours === 'string' ? body.operatingHours : JSON.stringify(body.operatingHours)) : undefined;
    const holidays = body.holidays != null ? (typeof body.holidays === 'string' ? body.holidays : JSON.stringify(body.holidays)) : undefined;
    const taxSettings = body.taxSettings != null ? (typeof body.taxSettings === 'string' ? body.taxSettings : JSON.stringify(body.taxSettings)) : undefined;
    const contentBlocks = body.contentBlocks != null ? (typeof body.contentBlocks === 'string' ? body.contentBlocks : JSON.stringify(body.contentBlocks)) : undefined;

    if (businessName !== undefined && !businessName) {
      return NextResponse.json({ error: 'businessName is required' }, { status: 400 });
    }

    const data: Record<string, unknown> = {};
    if (businessName !== undefined) data.businessName = businessName;
    if (businessPhone !== undefined) data.businessPhone = businessPhone;
    if (businessEmail !== undefined) data.businessEmail = businessEmail;
    if (businessAddress !== undefined) data.businessAddress = businessAddress;
    if (timeZone !== undefined) data.timeZone = timeZone;
    if (operatingHours !== undefined) data.operatingHours = operatingHours;
    if (holidays !== undefined) data.holidays = holidays;
    if (taxSettings !== undefined) data.taxSettings = taxSettings;
    if (contentBlocks !== undefined) data.contentBlocks = contentBlocks;

    const updated = await db.businessSettings.upsert({
      where: { orgId: ctx.orgId },
      create: {
        businessName: (data.businessName as string) ?? 'My Business',
        businessPhone: (data.businessPhone as string) ?? null,
        businessEmail: (data.businessEmail as string) ?? null,
        businessAddress: (data.businessAddress as string) ?? null,
        timeZone: (data.timeZone as string) ?? 'America/New_York',
        operatingHours: (data.operatingHours as string) ?? null,
        holidays: (data.holidays as string) ?? null,
        taxSettings: (data.taxSettings as string) ?? null,
        contentBlocks: (data.contentBlocks as string) ?? null,
      },
      update: data as Parameters<typeof db.businessSettings.update>[0]['data'],
    });

    return NextResponse.json({
      settings: {
        businessName: updated.businessName,
        businessPhone: updated.businessPhone ?? '',
        businessEmail: updated.businessEmail ?? '',
        businessAddress: updated.businessAddress ?? '',
        timeZone: updated.timeZone,
        operatingHours: updated.operatingHours,
        holidays: updated.holidays,
        taxSettings: updated.taxSettings,
        contentBlocks: updated.contentBlocks,
      },
    });
  } catch (e) {
    if (e instanceof ForbiddenError) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    throw e;
  }
}
