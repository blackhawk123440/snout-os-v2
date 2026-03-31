/**
 * Client Onboarding Wizard API (Phase 4.1)
 *
 * GET  /api/client/onboarding — Returns onboarding progress for the authenticated client
 * POST /api/client/onboarding — Updates onboarding step completion (re-checks all steps)
 *
 * Steps are evaluated dynamically against the client's data:
 *   1. profile_complete — client has firstName and phone
 *   2. pets_added       — at least one pet exists for this client
 *   3. address_set      — client address is not null
 *   4. payment_method   — stripeCustomerId is set on the client
 *   5. first_booking    — at least one booking exists for this client
 */

import { NextRequest, NextResponse } from 'next/server';
import { getRequestContext } from '@/lib/request-context';
import { requireRole, requireClientContext, ForbiddenError } from '@/lib/rbac';
import { getScopedDb } from '@/lib/tenancy';

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

async function evaluateSteps(db: any, clientId: string): Promise<OnboardingResponse> {
  const [client, petCount, bookingCount] = await Promise.all([
    db.client.findFirst({
      where: { id: clientId },
      select: {
        firstName: true,
        phone: true,
        address: true,
        stripeCustomerId: true,
      },
    }),
    db.pet.count({ where: { clientId } }),
    db.booking.count({ where: { clientId } }),
  ]);

  const steps: OnboardingStep[] = [
    {
      key: 'profile_complete',
      label: 'Complete your profile',
      completed: !!(client?.firstName && client?.phone),
    },
    {
      key: 'pets_added',
      label: 'Add your pets',
      completed: petCount > 0,
    },
    {
      key: 'address_set',
      label: 'Add your address',
      completed: client?.address != null && client.address.trim() !== '',
    },
    {
      key: 'payment_method',
      label: 'Add a payment method',
      completed: client?.stripeCustomerId != null && client.stripeCustomerId.trim() !== '',
    },
    {
      key: 'first_booking',
      label: 'Book your first visit',
      completed: bookingCount > 0,
    },
  ];

  const completedCount = steps.filter((s) => s.completed).length;

  return {
    steps,
    completedCount,
    totalSteps: steps.length,
    isComplete: completedCount === steps.length,
  };
}

export async function GET() {
  let ctx;
  try {
    ctx = await getRequestContext();
    requireRole(ctx, 'client');
    requireClientContext(ctx);
  } catch (error) {
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const db = getScopedDb(ctx);
    const result = await evaluateSteps(db, ctx.clientId);
    return NextResponse.json(result);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: 'Failed to load onboarding progress', message },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  let ctx;
  try {
    ctx = await getRequestContext();
    requireRole(ctx, 'client');
    requireClientContext(ctx);
  } catch (error) {
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // POST triggers a fresh re-evaluation of all steps.
    // The body may contain a `step` key for future use, but completion
    // is always inferred from the underlying data.
    const db = getScopedDb(ctx);
    const result = await evaluateSteps(db, ctx.clientId);
    return NextResponse.json(result);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: 'Failed to update onboarding progress', message },
      { status: 500 },
    );
  }
}
