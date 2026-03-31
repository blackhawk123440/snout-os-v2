import { NextRequest, NextResponse } from 'next/server';
import { getScopedDb } from '@/lib/tenancy';
import { getRequestContext } from '@/lib/request-context';
import { requireRole, ForbiddenError } from '@/lib/rbac';

/**
 * GET /api/sitter/me
 * Returns the current sitter's profile. Requires SITTER role.
 */
export async function GET() {
  let ctx;
  try {
    ctx = await getRequestContext();
    requireRole(ctx, 'sitter');
  } catch (error) {
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!ctx.sitterId) {
    return NextResponse.json({ error: 'Sitter profile missing on session' }, { status: 403 });
  }

  try {
    const db = getScopedDb(ctx);
    const sitter = await db.sitter.findUnique({
      where: { id: ctx.sitterId },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        phone: true,
        active: true,
        commissionPercentage: true,
        availabilityEnabled: true,
      },
    });

    if (!sitter) {
      return NextResponse.json({ error: 'Sitter not found' }, { status: 404 });
    }

    const s = sitter as any;
    return NextResponse.json({
      id: sitter.id,
      firstName: sitter.firstName,
      lastName: sitter.lastName,
      email: sitter.email,
      phone: sitter.phone,
      active: sitter.active,
      commissionPercentage: sitter.commissionPercentage,
      availabilityEnabled: s.availabilityEnabled ?? true,
      name: `${sitter.firstName} ${sitter.lastName}`.trim() || sitter.email,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: 'Failed to load sitter profile', message },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/sitter/me
 * Update the current sitter's profile. Requires SITTER role.
 * Used by onboarding (profile step + completion step) and profile page.
 *
 * Accepted fields:
 * - personalPhone: string (sitter's personal phone)
 * - onboardingStatus: 'pending_review' | 'active' (status transition)
 * - firstName, lastName: string (name updates)
 *
 * Note: 'bio' field is accepted but not persisted (no schema column).
 */
export async function PATCH(request: NextRequest) {
  let ctx;
  try {
    ctx = await getRequestContext();
    requireRole(ctx, 'sitter');
  } catch (error) {
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!ctx.sitterId) {
    return NextResponse.json({ error: 'Sitter profile missing on session' }, { status: 403 });
  }

  try {
    const body = await request.json().catch(() => ({}));
    const db = getScopedDb(ctx);

    // Whitelist editable fields
    const updateData: Record<string, unknown> = {};

    if (typeof body.personalPhone === 'string') {
      updateData.personalPhone = body.personalPhone.trim() || null;
    }
    if (typeof body.firstName === 'string' && body.firstName.trim()) {
      updateData.firstName = body.firstName.trim();
    }
    if (typeof body.lastName === 'string' && body.lastName.trim()) {
      updateData.lastName = body.lastName.trim();
    }
    if (typeof body.onboardingStatus === 'string') {
      // Only allow specific transitions a sitter can make
      const allowed = ['pending_review', 'active'];
      if (allowed.includes(body.onboardingStatus)) {
        updateData.onboardingStatus = body.onboardingStatus;
      }
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ success: true, message: 'No changes applied' });
    }

    const updated = await db.sitter.update({
      where: { id: ctx.sitterId },
      data: updateData,
      select: {
        id: true,
        firstName: true,
        lastName: true,
        personalPhone: true,
        onboardingStatus: true,
      },
    });

    return NextResponse.json({ success: true, sitter: updated });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: 'Failed to update profile', message },
      { status: 500 }
    );
  }
}
