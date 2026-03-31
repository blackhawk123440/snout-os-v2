/**
 * GET /api/settings/branding — Get org branding config
 * PUT /api/settings/branding — Update org branding (logo, colors, business name)
 *
 * Branding is stored as JSON in Org.brandingJson.
 * Applied to client portal, emails, SMS footer, and native apps.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getRequestContext } from '@/lib/request-context';
import { requireAnyRole, ForbiddenError } from '@/lib/rbac';
import { getScopedDb } from '@/lib/tenancy';

interface BrandingConfig {
  businessName?: string;
  logoUrl?: string;
  primaryColor?: string;
  secondaryColor?: string;
  faviconUrl?: string;
  customDomain?: string;
  poweredByVisible?: boolean;
}

function parseBranding(json: string | null): BrandingConfig {
  if (!json) return {};
  try {
    return JSON.parse(json) as BrandingConfig;
  } catch {
    return {};
  }
}

export async function GET() {
  let ctx;
  try {
    ctx = await getRequestContext();
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const db = getScopedDb(ctx);
    const org = await db.org.findUnique({
      where: { id: ctx.orgId },
      select: { brandingJson: true, name: true },
    });

    const branding = parseBranding(org?.brandingJson ?? null);

    return NextResponse.json({
      businessName: branding.businessName || org?.name || 'Snout OS',
      logoUrl: branding.logoUrl || null,
      primaryColor: branding.primaryColor || '#432f21',
      secondaryColor: branding.secondaryColor || '#fce1ef',
      faviconUrl: branding.faviconUrl || null,
      customDomain: branding.customDomain || null,
      poweredByVisible: branding.poweredByVisible !== false,
    });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to load branding' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  let ctx;
  try {
    ctx = await getRequestContext();
    requireAnyRole(ctx, ['owner', 'admin']);
  } catch (error) {
    if (error instanceof ForbiddenError) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const db = getScopedDb(ctx);
    const body = await request.json();
    const existing = await db.org.findUnique({
      where: { id: ctx.orgId },
      select: { brandingJson: true },
    });

    const current = parseBranding(existing?.brandingJson ?? null);
    const updated: BrandingConfig = {
      ...current,
      ...(body.businessName !== undefined && { businessName: String(body.businessName).trim() }),
      ...(body.logoUrl !== undefined && { logoUrl: body.logoUrl }),
      ...(body.primaryColor !== undefined && { primaryColor: body.primaryColor }),
      ...(body.secondaryColor !== undefined && { secondaryColor: body.secondaryColor }),
      ...(body.faviconUrl !== undefined && { faviconUrl: body.faviconUrl }),
      ...(body.customDomain !== undefined && { customDomain: body.customDomain }),
      ...(body.poweredByVisible !== undefined && { poweredByVisible: body.poweredByVisible }),
    };

    await db.org.update({
      where: { id: ctx.orgId },
      data: { brandingJson: JSON.stringify(updated) },
    });

    return NextResponse.json({ success: true, branding: updated });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to update branding' }, { status: 500 });
  }
}
