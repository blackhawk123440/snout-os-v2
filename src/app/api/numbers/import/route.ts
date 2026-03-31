/**
 * Number Import Route
 * 
 * Specific route for importing numbers to avoid conflict with [id] route.
 * This proxies to the NestJS API.
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { mintApiJWT } from '@/lib/api/jwt';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL;

export async function POST(request: NextRequest) {
  if (!API_BASE_URL) {
    return NextResponse.json(
      { error: 'API server not configured' },
      { status: 500 }
    );
  }

  // Get NextAuth session
  const session = await auth();

  if (!session?.user) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    );
  }

  // Mint API JWT token from session
  let apiToken: string;
  try {
    const user = session.user as any;
    apiToken = await mintApiJWT({
      userId: user.id || user.email || '',
      orgId: user.orgId || 'default',
      role: user.role || (user.sitterId ? 'sitter' : 'owner'),
      sitterId: user.sitterId || null,
    });
  } catch (error: any) {
    console.error('[BFF Proxy] Failed to mint API JWT:', error);
    return NextResponse.json(
      { error: 'Failed to authenticate with API' },
      { status: 500 }
    );
  }

  // Read request body
  let body: string;
  try {
    body = await request.text();
  } catch {
    return NextResponse.json(
      { error: 'Invalid request body' },
      { status: 400 }
    );
  }

  // Forward to API
  const apiUrl = `${API_BASE_URL}/api/numbers/import`;

  try {
    console.log('[BFF Proxy] Forwarding request to:', apiUrl);
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiToken}`,
      },
      body,
    });

    const contentType = response.headers.get('content-type');
    let responseData: any;
    
    if (contentType?.includes('application/json')) {
      responseData = await response.json();
    } else {
      responseData = await response.text();
    }

    console.log('[BFF Proxy] API response:', {
      status: response.status,
      contentType,
      hasData: !!responseData,
    });

    if (!response.ok) {
      console.error('[BFF Proxy] API error response:', responseData);
      return NextResponse.json(responseData, {
        status: response.status,
        headers: {
          'Content-Type': contentType || 'application/json',
        },
      });
    }

    // Transform API response to match frontend expectations
    // API returns: { results: [{ e164, success, number }], errors: [] }
    // Frontend expects: { success: boolean, number: { id, e164, numberSid } }
    if (responseData.results && Array.isArray(responseData.results) && responseData.results.length > 0) {
      const firstResult = responseData.results[0];
      if (firstResult.success && firstResult.number) {
        const transformedResponse = {
          success: true,
          number: {
            id: firstResult.number.id,
            e164: firstResult.number.e164,
            numberSid: firstResult.number.providerNumberSid || firstResult.number.numberSid || '',
          },
        };
        console.log('[BFF Proxy] Transformed response:', transformedResponse);
        return NextResponse.json(transformedResponse, {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
          },
        });
      }
    }

    // If there are errors, return error response
    if (responseData.errors && Array.isArray(responseData.errors) && responseData.errors.length > 0) {
      const firstError = responseData.errors[0];
      return NextResponse.json(
        { 
          success: false, 
          error: firstError.error || 'Failed to import number',
          number: undefined,
        },
        { status: 400 }
      );
    }

    // Fallback: return API response as-is
    return NextResponse.json(responseData, {
      status: response.status,
      headers: {
        'Content-Type': contentType || 'application/json',
      },
    });
  } catch (error: any) {
    console.error('[BFF Proxy] Failed to forward import request:', error);
    return NextResponse.json(
      { error: 'Failed to reach API server', message: error.message },
      { status: 502 }
    );
  }
}
