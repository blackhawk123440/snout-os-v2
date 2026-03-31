/**
 * Sitter Detail Route
 *
 * GET: Get sitter by ID
 * PATCH: Update sitter
 * DELETE: Delete sitter
 */

import { NextRequest, NextResponse } from 'next/server';
import { getScopedDb } from '@/lib/tenancy';
import { recordSitterStatusChanged } from '@/lib/audit-events';
import { getRequestContext } from '@/lib/request-context';
import { requireAnyRole, ForbiddenError } from '@/lib/rbac';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  let ctx;
  try {
    ctx = await getRequestContext();
    requireAnyRole(ctx, ['owner', 'admin', 'sitter']);
  } catch (error) {
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const resolvedParams = await params;
    if (ctx.role === 'sitter' && ctx.sitterId !== resolvedParams.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const db = getScopedDb(ctx);
    const sitter = await db.sitter.findFirst({
      where: { id: resolvedParams.id },
      include: { user: { select: { id: true } } },
    }) as any; // Type assertion: runtime uses enterprise-messaging-dashboard schema (name field)

    if (!sitter) {
      return NextResponse.json(
        { error: 'Sitter not found' },
        { status: 404 }
      );
    }

    // Return sitter in format expected by frontend
    const nameParts = (sitter.name || '').split(' ');
    const firstName = nameParts[0] || '';
    const lastName = nameParts.slice(1).join(' ') || '';

    return NextResponse.json({
      sitter: {
        id: sitter.id,
        firstName,
        lastName,
        name: sitter.name || '',
        phone: null,
        email: null,
        personalPhone: null,
        isActive: sitter.active,
        commissionPercentage: 80.0,
        createdAt: sitter.createdAt,
        updatedAt: sitter.updatedAt,
        currentTier: null,
        deletedAt: sitter.deletedAt ?? null,
        userId: (sitter as any).user?.id ?? null,
      }
    });
  } catch (error: any) {
    console.error('[Sitters API] Failed to fetch sitter:', error);
    return NextResponse.json(
      { error: 'Failed to fetch sitter', message: error.message },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  let ctx;
  try {
    ctx = await getRequestContext();
    requireAnyRole(ctx, ['owner', 'admin', 'sitter']);
  } catch (error) {
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const resolvedParams = await params;
    if (ctx.role === 'sitter' && ctx.sitterId !== resolvedParams.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const {
      firstName: bodyFirstName,
      lastName: bodyLastName,
      phone,
      email,
      isActive,
      commissionPercentage,
      personalPhone,
      onboardingStatus,
      currentTierId,
    } = body;

    const db = getScopedDb(ctx);

    // Get current sitter to check for status changes
    const currentSitter = await (db as any).sitter.findUnique({
      where: { id: resolvedParams.id },
      select: { active: true, onboardingStatus: true },
    });

    const oldStatus = currentSitter?.active ? 'active' : 'inactive';

    // Build update data object (only include fields that exist in schema)
    const updateData: any = {};

    // Schema only has: id, orgId, userId, name, active, createdAt, updatedAt
    if (bodyFirstName !== undefined || bodyLastName !== undefined) {
      // Combine firstName and lastName into name
      const existingSitter = await db.sitter.findFirst({
        where: { id: resolvedParams.id },
      }) as any; // Type assertion: runtime uses enterprise-messaging-dashboard schema

      if (bodyFirstName !== undefined && bodyLastName !== undefined) {
        updateData.name = `${bodyFirstName} ${bodyLastName}`.trim();
      } else if (bodyFirstName !== undefined && existingSitter) {
        // Only firstName provided, combine with existing lastName
        const existingName = (existingSitter.name || '').split(' ');
        const existingLastName = existingName.slice(1).join(' ') || '';
        updateData.name = `${bodyFirstName} ${existingLastName}`.trim();
      } else if (bodyLastName !== undefined && existingSitter) {
        // Only lastName provided, combine with existing firstName
        const existingName = (existingSitter.name || '').split(' ');
        const existingFirstName = existingName[0] || '';
        updateData.name = `${existingFirstName} ${bodyLastName}`.trim();
      }
    }

    if (isActive !== undefined) {
      updateData.active = isActive;

      // If activating sitter and they don't have a number, assign one
      if (isActive === true) {
        // Get orgId from session user
        const orgId = ctx.orgId;

        // Check if sitter already has an assigned number
        const existingNumber = await (db as any).messageNumber.findFirst({
          where: { assignedSitterId: resolvedParams.id, status: 'active', numberClass: 'sitter' },
        });

        if (!existingNumber) {
          // Assign a sitter number on activation (persistent assignment)
          const { assignSitterMaskedNumber } = await import('@/lib/messaging/number-helpers');
          const { getMessagingProvider } = await import('@/lib/messaging/provider-factory');

          try {
            const provider = await getMessagingProvider(orgId);
            await assignSitterMaskedNumber(orgId, resolvedParams.id, provider);
          } catch (error: any) {
            // Log but don't fail sitter activation if number assignment fails
            console.warn(`[Sitter Activation] Failed to assign number to sitter ${resolvedParams.id}:`, error);
          }
        }
      }
    }

    // Onboarding status transitions (owner/admin only)
    if (onboardingStatus !== undefined && (ctx.role === 'owner' || ctx.role === 'admin')) {
      const validTransitions: Record<string, string[]> = {
        pending_review: ['active', 'rejected'],
        active: ['deactivated'],
        deactivated: ['active'],
        invited: ['active'], // Owner can fast-track
        onboarding: ['active'], // Owner can fast-track
      };
      const currentOnboardingStatus = currentSitter?.onboardingStatus || 'active';
      const allowed = validTransitions[currentOnboardingStatus] || [];
      if (allowed.includes(onboardingStatus)) {
        updateData.onboardingStatus = onboardingStatus;
      }
    }

    // Tier assignment (owner/admin only)
    if (currentTierId !== undefined && (ctx.role === 'owner' || ctx.role === 'admin')) {
      updateData.currentTierId = currentTierId;
    }

    const scopedSitter = await db.sitter.findFirst({
      where: { id: resolvedParams.id },
      select: { id: true },
    });
    if (!scopedSitter) {
      return NextResponse.json({ error: 'Sitter not found' }, { status: 404 });
    }

    const sitter = await db.sitter.update({
      where: { id: scopedSitter.id },
      data: updateData as any, // Type assertion: runtime uses enterprise-messaging-dashboard schema
    }) as any;

    // Record audit event if status changed
    const newStatus = sitter.active ? 'active' : 'inactive';
    if (oldStatus !== newStatus) {
      await recordSitterStatusChanged(
        ctx.orgId,
        resolvedParams.id,
        oldStatus,
        newStatus,
        ctx.userId || 'system'
      );
    }

    // Return sitter in format expected by frontend
    const nameParts = (sitter.name || '').split(' ');
    const firstName = nameParts[0] || '';
    const lastName = nameParts.slice(1).join(' ') || '';

    return NextResponse.json({
      sitter: {
        id: sitter.id,
        firstName,
        lastName,
        name: sitter.name,
        phone: phone || null,
        email: email || null,
        personalPhone: personalPhone || null,
        isActive: sitter.active,
        commissionPercentage: commissionPercentage || 80.0,
        createdAt: sitter.createdAt,
        updatedAt: sitter.updatedAt,
        currentTier: null,
      }
    });
  } catch (error: any) {
    if (error.code === 'P2025') {
      return NextResponse.json(
        { error: 'Sitter not found' },
        { status: 404 }
      );
    }
    console.error('[Sitters API] Failed to update sitter:', error);
    return NextResponse.json(
      { error: 'Failed to update sitter', message: error.message },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  let ctx;
  try {
    ctx = await getRequestContext();
    requireAnyRole(ctx, ['owner', 'admin']);
  } catch (error) {
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const resolvedParams = await params;
    const db = getScopedDb(ctx);
    const result = await db.sitter.deleteMany({
      where: { id: resolvedParams.id },
    });
    if (result.count === 0) {
      return NextResponse.json({ error: 'Sitter not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    if (error.code === 'P2025') {
      return NextResponse.json(
        { error: 'Sitter not found' },
        { status: 404 }
      );
    }
    console.error('[Sitters API] Failed to delete sitter:', error);
    return NextResponse.json(
      { error: 'Failed to delete sitter', message: error.message },
      { status: 500 }
    );
  }
}
