import { NextRequest, NextResponse } from 'next/server';
import { getScopedDb } from '@/lib/tenancy';
import { getRequestContext } from '@/lib/request-context';
import { ForbiddenError, requireRole } from '@/lib/rbac';

export async function GET(request: NextRequest) {
  let ctx;
  try {
    ctx = await getRequestContext();
    requireRole(ctx, 'sitter');
  } catch (error) {
    if (error instanceof ForbiddenError) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!ctx.sitterId) return NextResponse.json({ error: 'Sitter profile missing' }, { status: 403 });

  const { searchParams } = new URL(request.url);
  const start = searchParams.get('start');
  const end = searchParams.get('end');
  if (!start || !end) return NextResponse.json({ error: 'start and end required' }, { status: 400 });

  try {
    const db = getScopedDb(ctx);
    const sitter = await (db as any).sitter.findUnique({
      where: { id: ctx.sitterId },
      select: {
        googleAccessToken: true, googleRefreshToken: true, googleTokenExpiry: true,
        googleCalendarId: true, calendarSyncEnabled: true,
      },
    });

    if (!sitter?.googleAccessToken) {
      return NextResponse.json({ events: [], connected: false });
    }

    const { google } = await import('googleapis');
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
    );
    oauth2Client.setCredentials({
      access_token: sitter.googleAccessToken,
      refresh_token: sitter.googleRefreshToken,
    });

    const calendar = google.calendar({ version: 'v3', auth: oauth2Client });
    const calendarId = sitter.googleCalendarId || 'primary';

    const res = await calendar.events.list({
      calendarId,
      timeMin: start,
      timeMax: end,
      singleEvents: true,
      orderBy: 'startTime',
      maxResults: 100,
    });

    // Filter OUT events that came from Snout OS
    const events = (res.data.items || [])
      .filter((e: any) => {
        const snoutSource = e.extendedProperties?.private?.snoutSource;
        return snoutSource !== 'snout-os';
      })
      .map((e: any) => ({
        id: e.id,
        summary: e.summary || 'Busy',
        start: e.start?.dateTime || e.start?.date || '',
        end: e.end?.dateTime || e.end?.date || '',
        allDay: !e.start?.dateTime,
        source: 'google',
      }));

    return NextResponse.json({ events, connected: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('[google-events] Failed:', message);
    return NextResponse.json({ events: [], connected: true, error: message });
  }
}
