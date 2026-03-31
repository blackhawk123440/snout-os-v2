/**
 * Google OAuth Start
 * 
 * GET: Initiates Google OAuth flow for calendar integration
 * Redirects to Google OAuth consent screen
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { env } from '@/lib/env';
import { google } from 'googleapis';

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  const user = session.user as any;
  const searchParams = request.nextUrl.searchParams;
  const sitterId = searchParams.get('sitterId');

  if (!sitterId) {
    return NextResponse.json({ error: 'sitterId is required' }, { status: 400 });
  }

  // Permission check: sitter can only connect their own calendar, owner/admin can connect any
  if (user.role === 'sitter' && user.sitterId !== sitterId) {
    return NextResponse.json({ error: 'Forbidden: You can only connect your own calendar' }, { status: 403 });
  }

  const clientId = env.GOOGLE_CLIENT_ID;
  const clientSecret = env.GOOGLE_CLIENT_SECRET;
  const redirectUri = `${env.NEXT_PUBLIC_APP_URL || request.nextUrl.origin}/api/integrations/google/callback`;

  if (!clientId || !clientSecret) {
    return NextResponse.json(
      { error: 'Google OAuth not configured. Please set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET' },
      { status: 500 }
    );
  }

  try {
    const oauth2Client = new google.auth.OAuth2(clientId, clientSecret, redirectUri);

    const orgId = user.orgId ?? 'default';
    const { encodeOAuthState } = await import('@/lib/signup-bootstrap');
    const state = encodeOAuthState({ orgId, userId: user.id, sitterId });

    // Scopes: calendar.events for sync, calendar.freebusy for "Respect Google Busy"
    const scopes = [
      'https://www.googleapis.com/auth/calendar.events',
      'https://www.googleapis.com/auth/calendar.freebusy',
    ];

    const authUrl = oauth2Client.generateAuthUrl({
      access_type: 'offline', // Required to get refresh token
      scope: scopes,
      state,
      prompt: 'consent', // Force consent screen to get refresh token
    });

    return NextResponse.redirect(authUrl);
  } catch (error: any) {
    console.error('[Google OAuth Start] Failed to initiate OAuth:', error);
    return NextResponse.json(
      { error: 'Failed to initiate Google OAuth', message: error.message },
      { status: 500 }
    );
  }
}
