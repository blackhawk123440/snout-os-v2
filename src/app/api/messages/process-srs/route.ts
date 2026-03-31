/**
 * Message Event SRS Processing Endpoint
 *
 * POST /api/messages/process-srs
 *
 * Processes a MessageEvent for SRS responsiveness tracking
 * Call this after creating a MessageEvent (from webhook or send endpoint)
 */

/**
 * Message Event SRS Processing Endpoint
 *
 * POST /api/messages/process-srs
 *
 * Processes a Message for SRS responsiveness tracking
 * Bridge between NestJS Message (enterprise schema) and MessageEvent (main schema)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getScopedDb } from '@/lib/tenancy';
import { processMessageEvent } from '@/lib/tiers/message-instrumentation';

export async function POST(request: NextRequest) {
  // Require INTERNAL_API_KEY for server-to-server calls
  const authHeader = request.headers.get('authorization');
  const expectedKey = process.env.INTERNAL_API_KEY;

  if (!expectedKey || !authHeader || authHeader !== `Bearer ${expectedKey}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const {
      orgId,
      threadId,
      messageEventId, // This is Message.id from NestJS, we'll use it as MessageEvent.id
      direction,
      actorType,
      messageBody,
      hasPolicyViolation,
      createdAt,
    } = body;

    if (!orgId || !threadId || !messageEventId || !direction || !actorType) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    const db = getScopedDb({ orgId });

    // Create or find MessageEvent record (bridge from Message to MessageEvent)
    const messageEvent = await (db as any).messageEvent.upsert({
      where: { id: messageEventId },
      create: {
        id: messageEventId,
        threadId,
        direction,
        actorType,
        body: messageBody || '',
        requiresResponse: false, // Will be set by processMessageEvent
        createdAt: createdAt ? new Date(createdAt) : new Date(),
        deliveryStatus: direction === 'inbound' ? 'received' : 'queued',
      },
      update: {
        // Update if exists
        body: messageBody || '',
      },
    });

    // Process for SRS
    await processMessageEvent(orgId, threadId, messageEvent.id, {
      direction,
      actorType,
      body: messageBody || '',
      hasPolicyViolation: hasPolicyViolation || false,
      createdAt: createdAt ? new Date(createdAt) : new Date(),
    });

    return NextResponse.json({ success: true, messageEventId: messageEvent.id });
  } catch (error: any) {
    console.error('[Message SRS Processing] Error:', error);
    return NextResponse.json(
      { error: 'Failed to process message for SRS', message: error.message },
      { status: 500 }
    );
  }
}
