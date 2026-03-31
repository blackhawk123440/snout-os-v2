import { NextRequest, NextResponse } from 'next/server';

/**
 * Deprecated duplicate inbound webhook.
 * Canonical path is POST /api/messages/webhook/twilio.
 */
export async function POST(_request: NextRequest) {
  return NextResponse.json(
    {
      error: 'Deprecated webhook path',
      canonicalPath: '/api/messages/webhook/twilio',
      migrationRequired: true,
    },
    { status: 410 }
  );
}
