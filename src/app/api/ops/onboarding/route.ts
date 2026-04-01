/**
 * Owner Onboarding Wizard API (Phase 4.3)
 *
 * GET /api/ops/onboarding — Returns owner/business onboarding progress
 *
 * Steps are evaluated dynamically against org data:
 *   1. business_profile  — BusinessSettings record exists for the org
 *   2. services_created  — at least one ServiceConfig record exists
 *   3. team_setup        — at least one non-deleted Sitter record exists
 *   4. messaging_setup   — Native phone mode selected or a provider is connected
 *   5. payments_setup    — STRIPE_SECRET_KEY env var is configured
 *   6. branding_done     — brandingJson is non-null on Org
 *   7. first_client      — at least one Client record exists
 *   8. first_booking     — at least one Booking record exists
 */

import { NextResponse } from 'next/server';
import { getRequestContext } from '@/lib/request-context';
import { requireAnyRole, ForbiddenError } from '@/lib/rbac';
import { getScopedDb } from '@/lib/tenancy';
import { prisma } from '@/lib/db';

interface OnboardingStep {
  key: string;
  label: string;
  completed: boolean;
}

interface OnboardingResponse {
  steps: OnboardingStep[];
  completedCount: number;
  totalSteps: number;
  isComplete: boolean;
}

export async function GET() {
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
    const db = getScopedDb(ctx);

    const [
      businessSettings,
      serviceCount,
      sitterCount,
      providerCredential,
      integrationConfig,
      org,
      clientCount,
      bookingCount,
    ] = await Promise.all([
      // 1. business_profile — BusinessSettings exists for org
      db.businessSettings.findFirst({
        where: {},
        select: { id: true },
      }),

      // 2. services_created — at least one ServiceConfig exists
      db.serviceConfig.count({ where: {} }),

      // 3. team_setup — at least one non-deleted Sitter exists
      db.sitter.count({ where: { deletedAt: null } }),

      // 4. messaging_setup — provider credential if the org chooses a connector
      prisma.providerCredential.findUnique({
        where: { orgId: ctx.orgId },
        select: { id: true },
      }),

      db.orgIntegrationConfig.findFirst({
        where: {},
        select: { messagingProvider: true },
      }),

      // 6. branding_done — brandingJson is non-null on Org
      prisma.org.findUnique({
        where: { id: ctx.orgId },
        select: { brandingJson: true },
      }),

      // 7. first_client — at least one Client exists
      db.client.count({ where: {} }),

      // 8. first_booking — at least one Booking exists
      db.booking.count({ where: {} }),
    ]);

    // 5. payments_setup — Stripe secret key is configured
    const stripeConfigured = !!process.env.STRIPE_SECRET_KEY;

    const steps: OnboardingStep[] = [
      {
        key: 'business_profile',
        label: 'Set up your business profile',
        completed: !!businessSettings,
      },
      {
        key: 'services_created',
        label: 'Create your services',
        completed: serviceCount > 0,
      },
      {
        key: 'team_setup',
        label: 'Add your first team member',
        completed: sitterCount > 0,
      },
      {
        key: 'messaging_setup',
        label: 'Configure messaging',
        completed: integrationConfig?.messagingProvider === 'none' || !!providerCredential,
      },
      {
        key: 'payments_setup',
        label: 'Set up payments',
        completed: stripeConfigured,
      },
      {
        key: 'branding_done',
        label: 'Customize your branding',
        completed: org?.brandingJson != null && org.brandingJson.trim() !== '',
      },
      {
        key: 'first_client',
        label: 'Add your first client',
        completed: clientCount > 0,
      },
      {
        key: 'first_booking',
        label: 'Create your first booking',
        completed: bookingCount > 0,
      },
    ];

    const completedCount = steps.filter((s) => s.completed).length;

    return NextResponse.json({
      steps,
      completedCount,
      totalSteps: steps.length,
      isComplete: completedCount === steps.length,
    } satisfies OnboardingResponse);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: 'Failed to load onboarding progress', message },
      { status: 500 },
    );
  }
}
