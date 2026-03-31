/**
 * Test Provider Connection Route
 * 
 * POST /api/setup/provider/test
 * Tests Twilio connection with real API call
 * Falls back to direct Twilio SDK if NestJS API is not available
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { mintApiJWT } from '@/lib/api/jwt';
import { getProviderCredentials } from '@/lib/messaging/provider-credentials';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL;

export async function POST(request: NextRequest) {
  const session = await auth();

  if (!session?.user) {
    return NextResponse.json(
      { success: false, message: 'Unauthorized' },
      { status: 401 }
    );
  }

  const user = session.user as any;
  const orgId = user.orgId || 'default';

  let body: { accountSid?: string; authToken?: string; apiKeySid?: string; apiKeySecret?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { success: false, message: 'Invalid request body' },
      { status: 400 }
    );
  }

  // Try NestJS API first if available
  if (API_BASE_URL) {
    try {
      const apiToken = await mintApiJWT({
        userId: user.id || user.email || '',
        orgId,
        role: user.role || (user.sitterId ? 'sitter' : 'owner'),
        sitterId: user.sitterId || null,
      });

      const apiUrl = `${API_BASE_URL}/api/setup/provider/test`;
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiToken}`,
        },
        body: JSON.stringify(body),
      });

      if (response.ok) {
        const responseData = await response.json();
        // Ensure response matches expected schema
        if (responseData.success !== undefined && responseData.message !== undefined) {
          return NextResponse.json(responseData, { status: 200 });
        }
        return NextResponse.json({
          success: true,
          message: responseData.message || 'Connection test successful',
        }, { status: 200 });
      }
    } catch (error: any) {
      console.warn('[BFF Proxy] Failed to reach API, using fallback:', error.message);
      // Fall through to direct Twilio test
    }
  }

  // Fallback: Direct Twilio API test
  try {
    const { getTwilioClientFromCredentials } = await import('@/lib/messaging/provider-credentials');
    type Creds = { accountSid: string; authToken: string; source: 'database' | 'environment'; apiKeySid?: string; apiKeySecret?: string };
    let credentials: Creds;

    const useBodyApiKey = !!(body.apiKeySid && body.apiKeySecret);
    const useBodyAuth = !!(body.accountSid && body.authToken);
    if (body.accountSid && (useBodyApiKey || useBodyAuth)) {
      credentials = {
        accountSid: body.accountSid,
        authToken: body.authToken || '',
        source: 'environment',
        ...(useBodyApiKey ? { apiKeySid: body.apiKeySid!, apiKeySecret: body.apiKeySecret! } : {}),
      };
    } else {
      const saved = await getProviderCredentials(orgId);
      if (!saved) {
        return NextResponse.json({
          success: false,
          message: 'No credentials found. Please save credentials first.',
        }, { status: 400 });
      }
      credentials = saved;
    }

    const client = getTwilioClientFromCredentials(credentials);
    const accountSid = credentials.accountSid;
    const account = await client.api.accounts(accountSid).fetch();
    
    if (account && account.sid) {
      return NextResponse.json({
        success: true,
        message: `Connection successful. Account: ${account.friendlyName || accountSid}`,
      }, { status: 200 });
    } else {
      return NextResponse.json({
        success: false,
        message: 'Connection test failed: Invalid response from Twilio',
      }, { status: 500 });
    }
  } catch (error: any) {
    console.error('[Direct Twilio] Test connection error:', error);
    
    // Parse Twilio error messages
    let errorMessage = 'Connection test failed';
    if (error.message) {
      errorMessage = error.message;
    } else if (error.code) {
      errorMessage = `Twilio error ${error.code}: ${error.message || 'Unknown error'}`;
    }

    return NextResponse.json({
      success: false,
      message: errorMessage,
    }, { status: 500 });
  }
}
