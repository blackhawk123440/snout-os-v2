/**
 * Sync Twilio numbers into MessageNumber table
 *
 * POST /api/setup/numbers/sync
 * Lists incoming phone numbers from Twilio and upserts them as MessageNumber
 * (first = front_desk, rest = pool). Use this so Test SMS and send pipeline have numbers.
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getScopedDb } from '@/lib/tenancy';
import { getProviderCredentials, getTwilioClientFromCredentials } from '@/lib/messaging/provider-credentials';
import { upsertCanonicalMessageNumbersFromTwilio } from '@/lib/messaging/sync-inventory';

export async function POST(request: NextRequest) {
  const session = await auth();

  if (!session?.user) {
    return NextResponse.json(
      { success: false, message: 'Unauthorized', synced: 0 },
      { status: 401 }
    );
  }

  const user = session.user as any;
  const orgId = user.orgId || 'default';
  const db = getScopedDb({ orgId });

  try {
    const credentials = await getProviderCredentials(orgId);
    if (!credentials) {
      return NextResponse.json(
        { success: false, message: 'Connect Twilio first.', synced: 0 },
        { status: 400 }
      );
    }

    const client = getTwilioClientFromCredentials(credentials);
    const list = await client.incomingPhoneNumbers.list({ limit: 100 });

    if (list.length === 0) {
      return NextResponse.json(
        { success: false, message: 'No Twilio numbers found for this account.', synced: 0 },
        { status: 200 }
      );
    }

    await upsertCanonicalMessageNumbersFromTwilio(db as any, orgId, list);

    return NextResponse.json({
      success: true,
      message: `Synced ${list.length} number(s). First is front_desk, rest are pool.`,
      synced: list.length,
    }, { status: 200 });
  } catch (error: any) {
    console.error('[Numbers Sync]', error?.message);
    const isAuth =
      error?.code === 20003 ||
      /authenticat/i.test(error?.message || '') ||
      error?.status === 401;
    return NextResponse.json(
      {
        success: false,
        message: isAuth
          ? 'Twilio rejected credentials. Re-save Account SID and Auth Token, then try again.'
          : error?.message || 'Failed to sync numbers',
        synced: 0,
      },
      { status: isAuth ? 400 : 500 }
    );
  }
}
