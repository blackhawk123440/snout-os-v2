/**
 * Provider Status Route
 * 
 * GET /api/setup/provider/status
 * Returns provider connection status (connected/not connected)
 * Reads from same DB as connect (ProviderCredential) so status matches after connect.
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getProviderCredentials } from '@/lib/messaging/provider-credentials';

export async function GET(request: NextRequest) {
  const session = await auth();

  if (!session?.user) {
    return NextResponse.json(
      { connected: false, accountSid: null, hasAuthToken: false, lastTestedAt: null, testResult: null },
      { status: 401 }
    );
  }

  const user = session.user as any;
  const orgId = user.orgId || 'default';

  const checkedAt = new Date().toISOString();
  try {
    const credentials = await getProviderCredentials(orgId);

    if (!credentials) {
      return NextResponse.json({
        connected: false,
        accountSid: null,
        hasAuthToken: false,
        lastTestedAt: null,
        testResult: null,
        checkedAt,
        verified: false,
      }, { status: 200 });
    }

    const maskedSid = credentials.accountSid
      ? `${credentials.accountSid.substring(0, 4)}...${credentials.accountSid.substring(credentials.accountSid.length - 4)}`
      : null;

    return NextResponse.json({
      connected: true,
      accountSid: maskedSid,
      hasAuthToken: !!credentials.authToken,
      lastTestedAt: null,
      testResult: null,
      checkedAt,
      verified: true,
    }, { status: 200 });
  } catch (error: any) {
    console.error('[Direct Prisma] Error fetching provider status:', error);
    return NextResponse.json({
      connected: false,
      accountSid: null,
      hasAuthToken: false,
      lastTestedAt: null,
      testResult: null,
      checkedAt,
      verified: false,
      errorDetail: error?.message || 'Failed to load credentials',
    }, { status: 200 });
  }
}
