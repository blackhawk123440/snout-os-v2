/**
 * Test SMS Endpoint
 *
 * POST /api/setup/test-sms
 * Sends a test SMS using the same send pipeline (chooseFromNumber + TwilioProvider.sendMessage)
 */

import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { auth } from '@/lib/auth';
import { getScopedDb } from '@/lib/tenancy';
import { createClientContact, findClientContactByPhone } from '@/lib/messaging/client-contact-lookup';
import { sendThreadMessage } from '@/lib/messaging/send';
import { resolveCorrelationId } from '@/lib/correlation-id';

export async function POST(request: NextRequest) {
  const session = await auth();

  if (!session?.user) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized' },
      { status: 401 }
    );
  }

  const user = session.user as any;
  const orgId = user.orgId || 'default';
  const db = getScopedDb({ orgId });

  let body: { destinationE164: string; fromClass: 'front_desk' | 'pool' | 'sitter' };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { success: false, error: 'Invalid request body' },
      { status: 400 }
    );
  }

  if (!body.destinationE164) {
    return NextResponse.json(
      { success: false, error: 'destinationE164 is required' },
      { status: 400 }
    );
  }

  try {
    // Find or create a test thread for this destination
    const normalizedPhone = body.destinationE164.startsWith('+') ? body.destinationE164 : `+${body.destinationE164}`;

    // Find or create client contact (raw SQL to avoid ClientContact.orgld generated-client bug)
    let clientId: string;
    const existing = await findClientContactByPhone(orgId, normalizedPhone);
    if (existing) {
      clientId = existing.clientId;
    } else {
      const guestClient = await (db as any).client.create({
        data: {
          firstName: 'Test',
          lastName: normalizedPhone,
          phone: normalizedPhone,
        },
      });
      clientId = guestClient.id;
      await createClientContact({
        id: randomUUID(),
        orgId,
        clientId,
        e164: normalizedPhone,
        label: 'Mobile',
        verified: false,
      });
    }

    // Find or create thread
    let thread = await db.messageThread.findFirst({
      where: {
        clientId,
        status: { notIn: ['closed', 'archived'] },
      },
      orderBy: { lastMessageAt: 'desc' },
      select: { id: true },
    });

    if (!thread) {
      // Get number based on fromClass
      const messageNumber = await db.messageNumber.findFirst({
        where: {
          numberClass: body.fromClass,
          status: 'active',
        },
      });

      if (!messageNumber) {
        return NextResponse.json(
          { success: false, error: `No ${body.fromClass} number available` },
          { status: 400 }
        );
      }

      thread = await db.messageThread.create({
        data: {
          orgId,
          clientId,
          messageNumberId: messageNumber.id,
          threadType: body.fromClass === 'sitter' ? 'assignment' : 'front_desk',
          status: 'open',
          scope: body.fromClass === 'sitter' ? 'client_booking' : 'client_general',
          numberClass: messageNumber.numberClass,
          maskedNumberE164: messageNumber.e164,
        },
        select: { id: true },
      });
    }

    const correlationId = resolveCorrelationId(request);
    const result = await sendThreadMessage({
      orgId,
      threadId: thread.id,
      actor: {
        role: 'owner',
        userId: user.id || user.email || 'system',
      },
      body: 'Test SMS from Snout OS messaging system',
      correlationId,
    });

    if (result.deliveryStatus === 'failed') {
      return NextResponse.json({
        success: false,
        messageSid: null,
        error: result.providerErrorMessage || 'Failed to send SMS',
        errorCode: result.providerErrorCode,
        fromE164: null,
      }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      messageSid: result.providerMessageSid ?? null,
      error: null,
      errorCode: null,
      fromE164: null,
    }, { status: 200 });
  } catch (error: any) {
    console.error('[Test SMS] Error:', error);
    return NextResponse.json({
      success: false,
      messageSid: null,
      error: error.message || 'Failed to send test SMS',
      errorCode: null,
      fromE164: null,
    }, { status: 500 });
  }
}
