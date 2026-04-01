/**
 * Google OAuth Callback
 *
 * GET: Handles Google OAuth callback and stores tokens
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getScopedDb } from '@/lib/tenancy';
import { env } from '@/lib/env';
import { google } from 'googleapis';

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  const user = session.user as any;
  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get('code');
  const state = searchParams.get('state');
  const error = searchParams.get('error');
  const redirectBase = user.role === 'sitter' ? '/sitter/calendar' : '/settings?section=integrations';
  const redirectWithError = (code: string) =>
    NextResponse.redirect(new URL(`${redirectBase}${redirectBase.includes('?') ? '&' : '?'}google=${code}`, request.url));

  if (error) {
    console.error('[Google OAuth Callback] OAuth error:', error);
    return redirectWithError('oauth_failed');
  }

  if (!code || !state) {
    return redirectWithError('invalid_callback');
  }

  const orgId = (user as any).orgId ?? 'default';
  const userId = user.id;
  const db = getScopedDb({ orgId });

  try {
    const { decodeAndVerifyOAuthState, logOAuthCallbackRejection } = await import('@/lib/signup-bootstrap');
    const verified = decodeAndVerifyOAuthState(state, { orgId, userId });
    if (!verified) {
      await logOAuthCallbackRejection('invalid_state', { orgId, userId, reason: 'expired_or_mismatch' });
      return redirectWithError('invalid_state');
    }
    const { sitterId } = verified;

    if (!sitterId) {
      return redirectWithError('invalid_state');
    }

    // Permission check: sitter can only connect their own calendar, owner/admin can connect any
    if (user.role === 'sitter' && user.sitterId !== sitterId) {
      return redirectWithError('forbidden');
    }

    // Tenancy: ensure sitter belongs to caller's org before updating
    const sitter = await (db as any).sitter.findFirst({
      where: { id: sitterId },
      select: { id: true },
    });
    if (!sitter) {
      return redirectWithError('sitter_not_found');
    }

    const clientId = env.GOOGLE_CLIENT_ID;
    const clientSecret = env.GOOGLE_CLIENT_SECRET;
    const redirectUri = `${env.NEXT_PUBLIC_APP_URL || request.nextUrl.origin}/api/integrations/google/callback`;

    if (!clientId || !clientSecret) {
      return redirectWithError('not_configured');
    }

    const oauth2Client = new google.auth.OAuth2(clientId, clientSecret, redirectUri);

    // Exchange code for tokens
    const { tokens } = await oauth2Client.getToken(code);

    if (!tokens.access_token) {
      return redirectWithError('no_token');
    }

    // Calculate token expiry
    // Handle both expiry_date (number) and expires_in (seconds) formats
    const expiryDate = (tokens as any).expiry_date
      ? new Date((tokens as any).expiry_date)
      : new Date(Date.now() + ((tokens as any).expires_in || 3600) * 1000);

    // Update sitter with tokens (sitter already verified same org)
    await (db as any).sitter.update({
      where: { id: sitterId },
      data: {
        googleAccessToken: tokens.access_token,
        googleRefreshToken: tokens.refresh_token || null,
        googleTokenExpiry: expiryDate,
        googleCalendarId: 'primary', // Default to primary calendar
        calendarSyncEnabled: true, // Enable sync by default after connection
      },
    });

    const successSeparator = redirectBase.includes('?') ? '&' : '?';
    return NextResponse.redirect(new URL(`${redirectBase}${successSeparator}google=connected&sitterId=${encodeURIComponent(sitterId)}`, request.url));
  } catch (error: any) {
    console.error('[Google OAuth Callback] Failed to process callback:', error);
    return redirectWithError('callback_failed');
  }
}
