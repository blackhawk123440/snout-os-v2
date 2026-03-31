/**
 * GET/POST/DELETE /api/settings/messaging-provider
 * View and update org messaging provider configuration.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getRequestContext } from '@/lib/request-context';
import { requireOwnerOrAdmin, ForbiddenError } from '@/lib/rbac';
import { getProviderCredentials } from '@/lib/messaging/provider-credentials';
import { getScopedDb } from '@/lib/tenancy';

export async function GET() {
  let ctx;
  try {
    ctx = await getRequestContext();
    requireOwnerOrAdmin(ctx);
  } catch (error) {
    if (error instanceof ForbiddenError) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const db = getScopedDb(ctx);
    const messageAccount = await (db as any).messageAccount.findFirst({
      where: {},
      orderBy: { updatedAt: 'desc' },
    }).catch(() => null);

    const twilioCredentials = await getProviderCredentials(ctx.orgId);

    let activeProvider: 'twilio' | 'openphone' | 'none' = 'none';
    let openphoneConfig: any = null;

    if (messageAccount?.provider === 'openphone' && messageAccount.providerConfigJson) {
      activeProvider = 'openphone';
      try { openphoneConfig = JSON.parse(messageAccount.providerConfigJson); } catch {}
    } else if (twilioCredentials) {
      activeProvider = 'twilio';
    } else if (process.env.OPENPHONE_API_KEY) {
      activeProvider = 'openphone';
    }

    return NextResponse.json({
      activeProvider,
      twilio: {
        connected: !!twilioCredentials,
      },
      openphone: {
        connected: activeProvider === 'openphone',
        phoneNumberId: openphoneConfig?.phoneNumberId || null,
        phoneNumber: openphoneConfig?.phoneNumber || null,
      },
    });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to load provider status' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  let ctx;
  try {
    ctx = await getRequestContext();
    requireOwnerOrAdmin(ctx);
  } catch (error) {
    if (error instanceof ForbiddenError) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const db = getScopedDb(ctx);
    const body = await request.json();
    const { provider, config } = body;

    if (provider === 'openphone') {
      if (!config?.apiKey || !config?.phoneNumberId) {
        return NextResponse.json({ error: 'API key and phone number ID are required' }, { status: 400 });
      }

      const configJson = JSON.stringify({
        apiKey: config.apiKey,
        phoneNumberId: config.phoneNumberId,
        phoneNumber: config.phoneNumber || null,
        webhookSecret: config.webhookSecret || null,
      });

      // MessageAccount has no unique on orgId — use find + create/update
      const existing = await (db as any).messageAccount.findFirst({
        where: { provider: 'openphone' },
        select: { id: true },
      });
      if (existing) {
        await (db as any).messageAccount.update({
          where: { id: existing.id },
          data: { providerConfigJson: configJson },
        });
      } else {
        await (db as any).messageAccount.create({
          data: {
            provider: 'openphone',
            providerConfigJson: configJson,
          },
        });
      }

      // Create or update MessageNumber if phone number provided
      if (config.phoneNumber) {
        const existingNum = await (db as any).messageNumber.findFirst({
          where: { e164: config.phoneNumber },
          select: { id: true },
        });
        if (existingNum) {
          await (db as any).messageNumber.update({
            where: { id: existingNum.id },
            data: {
              provider: 'openphone',
              providerNumberSid: config.phoneNumberId,
              numberClass: 'front_desk',
              status: 'active',
            },
          });
        } else {
          await (db as any).messageNumber.create({
            data: {
              provider: 'openphone',
              providerNumberSid: config.phoneNumberId,
              e164: config.phoneNumber,
              numberClass: 'front_desk',
              status: 'active',
            },
          });
        }
      }

      return NextResponse.json({ success: true, activeProvider: 'openphone' });
    }

    if (provider === 'twilio') {
      const credentials = await getProviderCredentials(ctx.orgId);
      if (!credentials) {
        return NextResponse.json({ error: 'Twilio credentials not configured. Use the Twilio setup flow.' }, { status: 400 });
      }
      return NextResponse.json({ success: true, activeProvider: 'twilio' });
    }

    return NextResponse.json({ error: 'Invalid provider' }, { status: 400 });
  } catch (error) {
    console.error('[messaging-provider] POST failed:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: `Failed to update provider: ${message}` }, { status: 500 });
  }
}

export async function DELETE() {
  let ctx;
  try {
    ctx = await getRequestContext();
    requireOwnerOrAdmin(ctx);
  } catch (error) {
    if (error instanceof ForbiddenError) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const db = getScopedDb(ctx);
    await (db as any).messageAccount.deleteMany({ where: { provider: 'openphone' } });
    await (db as any).messageNumber.updateMany({
      where: { provider: 'openphone' },
      data: { status: 'inactive' },
    });
    return NextResponse.json({ success: true, activeProvider: 'none' });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to remove provider' }, { status: 500 });
  }
}
