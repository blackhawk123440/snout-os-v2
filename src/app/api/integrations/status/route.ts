import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { getScopedDb } from '@/lib/tenancy';
import { getRequestContext } from '@/lib/request-context';
import { requireAnyRole, ForbiddenError } from '@/lib/rbac';
import { env } from '@/lib/env';
import { getWebhookStatusForOrg } from '@/lib/setup/webhook-status';
import { getOrCreateOrgAISettings } from '@/lib/ai/governance';
import type { PrismaClient } from '@prisma/client';

type IntegrationsStatusResponse = {
  stripe: {
    ready: boolean;
    reachable: boolean;
    connectEnabled: boolean;
  };
  twilio: {
    ready: boolean;
    numbersConfigured: boolean;
    webhooksInstalled: boolean;
  };
  calendar: {
    ready: boolean;
    connectedSitters: number;
    lastSyncAt: string | null;
  };
  ai: {
    ready: boolean;
    enabled: boolean;
  };
};

async function getStripeStatus() {
  const connectEnabled = !!env.STRIPE_SECRET_KEY && !!env.STRIPE_PUBLISHABLE_KEY;
  let reachable = false;

  if (env.STRIPE_SECRET_KEY) {
    try {
      const stripe = new Stripe(env.STRIPE_SECRET_KEY as string, { apiVersion: '2025-03-31.basil' as any });
      await stripe.balance.retrieve();
      reachable = true;
    } catch {
      reachable = false;
    }
  }

  return {
    ready: connectEnabled && reachable,
    reachable,
    connectEnabled,
  };
}

async function getTwilioStatus(orgId: string) {
  const readiness = await getWebhookStatusForOrg(orgId).catch(() => null);
  const numbersConfigured = (readiness?.numbersFetchedCount ?? 0) > 0;
  const webhooksInstalled = readiness?.installed ?? false;

  return {
    ready: numbersConfigured && webhooksInstalled,
    numbersConfigured,
    webhooksInstalled,
  };
}

async function getCalendarStatus(db: PrismaClient) {
  const now = new Date();
  const oauthConfigured = !!env.GOOGLE_CLIENT_ID && !!env.GOOGLE_CLIENT_SECRET;
  const sitters = await (db as any).sitter.findMany({
    where: {
      calendarSyncEnabled: true,
      googleRefreshToken: { not: null },
    },
    select: {
      googleTokenExpiry: true,
      googleRefreshToken: true,
    },
  }).catch(() => []);

  // Token validity: refresh token exists and token is not expired (or no explicit expiry persisted).
  const validConnectedSitters = sitters.filter((s: any) => {
    const hasRefreshToken = !!s.googleRefreshToken;
    const expiry = s.googleTokenExpiry ? new Date(s.googleTokenExpiry) : null;
    return hasRefreshToken && (!expiry || expiry > now);
  });

  const latestSync = await (db as any).bookingCalendarEvent.aggregate({
    where: {
      lastSyncedAt: { not: null },
    },
    _max: {
      lastSyncedAt: true,
    },
  }).catch(() => ({ _max: { lastSyncedAt: null } }));

  return {
    ready: oauthConfigured && validConnectedSitters.length > 0,
    connectedSitters: validConnectedSitters.length,
    lastSyncAt: latestSync?._max?.lastSyncedAt
      ? new Date(latestSync._max.lastSyncedAt).toISOString()
      : null,
  };
}

async function getAiStatus(orgId: string) {
  const settings = await getOrCreateOrgAISettings(orgId);
  return {
    ready: !!process.env.OPENAI_API_KEY && settings.enabled,
    enabled: settings.enabled,
  };
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
    const [stripe, twilio, calendar, ai] = await Promise.all([
      getStripeStatus(),
      getTwilioStatus(ctx.orgId),
      getCalendarStatus(db),
      getAiStatus(ctx.orgId),
    ]);

    const response: IntegrationsStatusResponse = { stripe, twilio, calendar, ai };
    return NextResponse.json(response, { status: 200 });
  } catch (error: any) {
    return NextResponse.json(
      { error: 'Failed to load integrations status', message: error?.message },
      { status: 500 }
    );
  }
}
