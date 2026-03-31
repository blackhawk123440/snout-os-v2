/**
 * Square Payment Support API (Phase 4.2)
 *
 * GET /api/settings/payment-processor — Returns current payment processor config
 * PUT /api/settings/payment-processor — Switch between Stripe and Square
 *
 * Square credentials are stored in the Setting table under key 'square_config'.
 * This is the configuration layer; actual Square SDK integration is built on top.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getRequestContext } from '@/lib/request-context';
import { requireAnyRole, ForbiddenError } from '@/lib/rbac';
import { getScopedDb } from '@/lib/tenancy';

const SQUARE_CONFIG_KEY = 'square_config';
const PROCESSOR_KEY = 'payment_processor';

interface SquareConfig {
  squareApplicationId: string | null;
  squareAccessToken: string | null;
}

function parseSquareConfig(value: string | null | undefined): SquareConfig {
  if (!value) return { squareApplicationId: null, squareAccessToken: null };
  try {
    const parsed = JSON.parse(value);
    return {
      squareApplicationId: parsed.squareApplicationId || null,
      squareAccessToken: parsed.squareAccessToken || null,
    };
  } catch {
    return { squareApplicationId: null, squareAccessToken: null };
  }
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

    // Fetch processor setting and square config in parallel
    const [processorSetting, squareConfigSetting] = await Promise.all([
      db.setting.findFirst({ where: { key: PROCESSOR_KEY } }),
      db.setting.findFirst({ where: { key: SQUARE_CONFIG_KEY } }),
    ]);

    const processor = (processorSetting as any)?.value || 'stripe';
    const squareConfig = parseSquareConfig((squareConfigSetting as any)?.value);

    // Check Stripe connection via env (STRIPE_SECRET_KEY present)
    const stripeConnected = !!process.env.STRIPE_SECRET_KEY;

    // Square is connected if both applicationId and accessToken are set
    const squareConnected = !!(squareConfig.squareApplicationId && squareConfig.squareAccessToken);

    return NextResponse.json({
      processor,
      stripeConnected,
      squareConnected,
      squareApplicationId: squareConfig.squareApplicationId,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: 'Failed to load payment processor config', message },
      { status: 500 },
    );
  }
}

export async function PUT(request: NextRequest) {
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
    const body = await request.json();
    const { processor, squareApplicationId, squareAccessToken } = body;

    if (!processor || !['stripe', 'square'].includes(processor)) {
      return NextResponse.json(
        { error: 'Invalid processor. Must be "stripe" or "square".' },
        { status: 400 },
      );
    }

    const db = getScopedDb(ctx);

    // Store the active processor preference
    await db.setting.upsert({
      where: { orgId_key: { orgId: ctx.orgId, key: PROCESSOR_KEY } },
      create: {
        key: PROCESSOR_KEY,
        value: processor,
        category: 'payments',
        label: 'Payment Processor',
      },
      update: { value: processor },
    });

    // If switching to Square, store/update Square credentials
    if (processor === 'square') {
      const existingSetting = await db.setting.findFirst({
        where: { key: SQUARE_CONFIG_KEY },
      });

      const existingConfig = parseSquareConfig((existingSetting as any)?.value);

      const updatedConfig: SquareConfig = {
        squareApplicationId:
          squareApplicationId !== undefined
            ? squareApplicationId
            : existingConfig.squareApplicationId,
        squareAccessToken:
          squareAccessToken !== undefined
            ? squareAccessToken
            : existingConfig.squareAccessToken,
      };

      await db.setting.upsert({
        where: { orgId_key: { orgId: ctx.orgId, key: SQUARE_CONFIG_KEY } },
        create: {
          key: SQUARE_CONFIG_KEY,
          value: JSON.stringify(updatedConfig),
          category: 'payments',
          label: 'Square Configuration',
        },
        update: { value: JSON.stringify(updatedConfig) },
      });
    }

    // Return updated state
    const squareConfigSetting = await db.setting.findFirst({
      where: { key: SQUARE_CONFIG_KEY },
    });
    const squareConfig = parseSquareConfig((squareConfigSetting as any)?.value);
    const stripeConnected = !!process.env.STRIPE_SECRET_KEY;
    const squareConnected = !!(squareConfig.squareApplicationId && squareConfig.squareAccessToken);

    return NextResponse.json({
      processor,
      stripeConnected,
      squareConnected,
      squareApplicationId: squareConfig.squareApplicationId,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: 'Failed to update payment processor config', message },
      { status: 500 },
    );
  }
}
