/**
 * GET  /api/settings/integration-stack — Read org integration config + live status
 * PATCH /api/settings/integration-stack — Update provider selections
 *
 * Returns the stored preferences merged with live readiness checks
 * so the UI can show both "what you chose" and "is it actually working."
 */

import { NextRequest, NextResponse } from 'next/server';
import { getRequestContext } from '@/lib/request-context';
import { getScopedDb } from '@/lib/tenancy';
import { requireAnyRole, ForbiddenError } from '@/lib/rbac';
import { env } from '@/lib/env';

// ── Valid values ────────────────────────────────────────────────────

const MESSAGING_PROVIDERS = ['none', 'twilio', 'openphone'] as const;
const PAYMENT_PROVIDERS = ['stripe', 'square', 'none'] as const;
const CALENDAR_PROVIDERS = ['none', 'google'] as const;
const ACCOUNTING_PROVIDERS = ['none', 'quickbooks', 'xero'] as const;
const BOOKING_INTAKE_MODES = ['embedded_form', 'client_portal', 'both'] as const;

type MessagingProvider = (typeof MESSAGING_PROVIDERS)[number];
type PaymentProvider = (typeof PAYMENT_PROVIDERS)[number];
type CalendarProvider = (typeof CALENDAR_PROVIDERS)[number];
type AccountingProvider = (typeof ACCOUNTING_PROVIDERS)[number];
type BookingIntakeMode = (typeof BOOKING_INTAKE_MODES)[number];

// ── Default config (new org) ────────────────────────────────────────

const DEFAULT_CONFIG = {
  messagingProvider: 'none' as MessagingProvider,
  messagingConfigured: false,
  messagingFallbackPhone: null as string | null,
  paymentProvider: 'stripe' as PaymentProvider,
  paymentConfigured: false,
  calendarProvider: 'none' as CalendarProvider,
  calendarConfigured: false,
  accountingProvider: 'none' as AccountingProvider,
  accountingConfigured: false,
  bookingIntake: 'embedded_form' as BookingIntakeMode,
};

// ── Live status checks ──────────────────────────────────────────────

async function checkMessagingStatus(
  db: any,
  provider: string
): Promise<{ configured: boolean; detail: string }> {
  if (provider === 'none') {
    return {
      configured: true,
      detail: 'Native phone mode active — owners, sitters, and clients can use their normal numbers',
    };
  }

  if (provider === 'twilio') {
    const hasNumbers = await db.messageNumber
      .count({ where: { provider: 'twilio' } })
      .catch(() => 0);
    const hasCreds = !!(env.TWILIO_ACCOUNT_SID && env.TWILIO_AUTH_TOKEN);
    const configured = hasCreds && hasNumbers > 0;
    return {
      configured,
      detail: configured
        ? `${hasNumbers} Twilio number(s) active for your U.S. business connection`
        : !hasCreds
          ? 'Twilio credentials not configured'
          : 'No phone numbers provisioned',
    };
  }

  if (provider === 'openphone') {
    const hasCreds = !!env.OPENPHONE_API_KEY;
    const hasWebhookSecret = !!process.env.OPENPHONE_WEBHOOK_SECRET;
    const configured = hasCreds && hasWebhookSecret;
    return {
      configured,
      detail: configured
        ? 'OpenPhone connected as your optional U.S. business line'
        : !hasCreds
          ? 'OpenPhone API key not configured'
          : 'Webhook secret missing',
    };
  }

  return { configured: false, detail: 'Unknown provider' };
}

async function checkPaymentStatus(
  provider: string
): Promise<{ configured: boolean; detail: string }> {
  if (provider === 'none') {
    return { configured: true, detail: 'No payment processing — manual invoicing only' };
  }

  if (provider === 'stripe') {
    const hasKey = !!env.STRIPE_SECRET_KEY;
    const hasPub = !!env.STRIPE_PUBLISHABLE_KEY;
    if (!hasKey) return { configured: false, detail: 'Stripe secret key not configured' };
    if (!hasPub) return { configured: false, detail: 'Stripe publishable key not configured' };

    try {
      const Stripe = (await import('stripe')).default;
      const stripe = new Stripe(env.STRIPE_SECRET_KEY as string, { apiVersion: '2025-03-31.basil' as any });
      await stripe.balance.retrieve();
      return { configured: true, detail: 'Stripe connected and reachable' };
    } catch {
      return { configured: false, detail: 'Stripe keys set but API unreachable' };
    }
  }

  if (provider === 'square') {
    return { configured: false, detail: 'Square integration coming soon' };
  }

  return { configured: false, detail: 'Unknown provider' };
}

async function checkCalendarStatus(
  db: any,
  provider: string
): Promise<{ configured: boolean; detail: string }> {
  if (provider === 'none') {
    return { configured: true, detail: 'Using in-app calendar only' };
  }

  if (provider === 'google') {
    const oauthReady = !!(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET);
    if (!oauthReady) return { configured: false, detail: 'Google OAuth not configured' };

    const connectedCount = await db.sitter
      .count({ where: { calendarSyncEnabled: true, googleRefreshToken: { not: null } } })
      .catch(() => 0);

    return {
      configured: connectedCount > 0,
      detail: connectedCount > 0 ? `${connectedCount} sitter(s) syncing` : 'No sitters connected yet',
    };
  }

  return { configured: false, detail: 'Unknown provider' };
}

// ── GET ──────────────────────────────────────────────────────────────

export async function GET() {
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

    // Get or create config
    let config = await (db as any).orgIntegrationConfig.findFirst({ where: {} });

    if (!config) {
      config = await (db as any).orgIntegrationConfig.create({
        data: { ...DEFAULT_CONFIG },
      });
    }

    // Run live status checks in parallel
    const [messaging, payment, calendar] = await Promise.all([
      checkMessagingStatus(db, config.messagingProvider),
      checkPaymentStatus(config.paymentProvider),
      checkCalendarStatus(db, config.calendarProvider),
    ]);

    // Update configured flags if they've changed
    const updates: Record<string, boolean> = {};
    if (config.messagingConfigured !== messaging.configured) updates.messagingConfigured = messaging.configured;
    if (config.paymentConfigured !== payment.configured) updates.paymentConfigured = payment.configured;
    if (config.calendarConfigured !== calendar.configured) updates.calendarConfigured = calendar.configured;

    if (Object.keys(updates).length > 0) {
      await (db as any).orgIntegrationConfig.update({
        where: { id: config.id },
        data: updates,
      });
    }

    return NextResponse.json({
      config: {
        messagingProvider: config.messagingProvider,
        messagingFallbackPhone: config.messagingFallbackPhone,
        paymentProvider: config.paymentProvider,
        calendarProvider: config.calendarProvider,
        accountingProvider: config.accountingProvider,
        bookingIntake: config.bookingIntake,
      },
      status: {
        messaging: { ...messaging, provider: config.messagingProvider },
        payment: { ...payment, provider: config.paymentProvider },
        calendar: { ...calendar, provider: config.calendarProvider },
        accounting: {
          configured: config.accountingProvider === 'none',
          detail: config.accountingProvider === 'none' ? 'Using built-in ledger' : 'Coming soon',
          provider: config.accountingProvider,
        },
        bookingIntake: {
          configured: true,
          detail:
            config.bookingIntake === 'both'
              ? 'Embedded form + client portal'
              : config.bookingIntake === 'client_portal'
                ? 'Client portal only'
                : 'Embedded form (Webflow / website)',
          mode: config.bookingIntake,
        },
      },
    });
  } catch (error: any) {
    console.error('[integration-stack] GET error:', error);
    return NextResponse.json({ error: 'Failed to load integration config', message: error?.message }, { status: 500 });
  }
}

// ── PATCH ────────────────────────────────────────────────────────────

export async function PATCH(request: NextRequest) {
  let ctx;
  try {
    ctx = await getRequestContext();
    requireAnyRole(ctx, ['owner', 'admin']);
  } catch (error) {
    if (error instanceof ForbiddenError) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const db = getScopedDb(ctx);

    // Validate inputs
    const data: Record<string, unknown> = {};

    if (body.messagingProvider !== undefined) {
      if (!MESSAGING_PROVIDERS.includes(body.messagingProvider)) {
        return NextResponse.json({ error: `Invalid messaging provider: ${body.messagingProvider}` }, { status: 400 });
      }
      data.messagingProvider = body.messagingProvider;
      // Reset configured flag when provider changes — live check will re-evaluate
      data.messagingConfigured = false;
    }

    if (body.messagingFallbackPhone !== undefined) {
      data.messagingFallbackPhone = body.messagingFallbackPhone || null;
    }

    if (body.paymentProvider !== undefined) {
      if (!PAYMENT_PROVIDERS.includes(body.paymentProvider)) {
        return NextResponse.json({ error: `Invalid payment provider: ${body.paymentProvider}` }, { status: 400 });
      }
      data.paymentProvider = body.paymentProvider;
      data.paymentConfigured = false;
    }

    if (body.calendarProvider !== undefined) {
      if (!CALENDAR_PROVIDERS.includes(body.calendarProvider)) {
        return NextResponse.json({ error: `Invalid calendar provider: ${body.calendarProvider}` }, { status: 400 });
      }
      data.calendarProvider = body.calendarProvider;
      data.calendarConfigured = false;
    }

    if (body.accountingProvider !== undefined) {
      if (!ACCOUNTING_PROVIDERS.includes(body.accountingProvider)) {
        return NextResponse.json({ error: `Invalid accounting provider: ${body.accountingProvider}` }, { status: 400 });
      }
      data.accountingProvider = body.accountingProvider;
      data.accountingConfigured = false;
    }

    if (body.bookingIntake !== undefined) {
      if (!BOOKING_INTAKE_MODES.includes(body.bookingIntake)) {
        return NextResponse.json({ error: `Invalid booking intake mode: ${body.bookingIntake}` }, { status: 400 });
      }
      data.bookingIntake = body.bookingIntake;
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
    }

    // Upsert
    const existing = await (db as any).orgIntegrationConfig.findFirst({ where: {} });

    if (existing) {
      await (db as any).orgIntegrationConfig.update({
        where: { id: existing.id },
        data,
      });
    } else {
      await (db as any).orgIntegrationConfig.create({
        data: { ...DEFAULT_CONFIG, ...data },
      });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('[integration-stack] PATCH error:', error);
    return NextResponse.json({ error: 'Failed to update integration config', message: error?.message }, { status: 500 });
  }
}
