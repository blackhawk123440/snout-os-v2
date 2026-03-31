import { NextRequest, NextResponse } from 'next/server';
import { getRequestContext } from '@/lib/request-context';
import { getScopedDb } from '@/lib/tenancy';
import { prisma } from '@/lib/db';

/**
 * POST /api/numbers/[id]/release-from-twilio
 *
 * Permanently releases a phone number from Twilio, then marks it as 'released' in the database.
 * This is a destructive, irreversible action.
 *
 * Flow:
 * 1. Validate auth (owner/admin only)
 * 2. Load the MessageNumber record to get providerNumberSid and e164
 * 3. Resolve Twilio credentials for this org
 * 4. Call Twilio API to release the number
 * 5. Update DB status to 'released', clear assignments
 * 6. Log an audit event
 *
 * Idempotency: If the number is already released (status='released'), returns success.
 * If Twilio reports the number is already gone (404/20404), marks as released in DB.
 */
export async function POST(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  let ctx;
  try {
    ctx = await getRequestContext();
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (ctx.role !== 'owner' && ctx.role !== 'admin') {
    return NextResponse.json({ error: 'Owner access required' }, { status: 403 });
  }

  const params = await context.params;
  const numberId = params.id;
  const db = getScopedDb({ orgId: ctx.orgId });

  // 1. Load the number record
  const numberRecord = await db.messageNumber.findFirst({
    where: { id: numberId },
    select: {
      id: true,
      e164: true,
      provider: true,
      providerNumberSid: true,
      status: true,
      numberClass: true,
      assignedSitterId: true,
      _count: { select: { MessageThread: { where: { status: 'open' } } } },
    },
  });

  if (!numberRecord) {
    return NextResponse.json({ error: 'Number not found' }, { status: 404 });
  }

  // Idempotency: already released
  if (numberRecord.status === 'released') {
    return NextResponse.json({
      success: true,
      message: 'Number already released from Twilio',
      alreadyReleased: true,
    });
  }

  const activeThreads = numberRecord._count.MessageThread;

  // 2. Resolve Twilio credentials
  let twilioClient: any;
  try {
    const { getProviderCredentials, getTwilioClientFromCredentials } = await import(
      '@/lib/messaging/provider-credentials'
    );
    const credentials = await getProviderCredentials(ctx.orgId);
    if (!credentials) {
      return NextResponse.json(
        { error: 'Twilio credentials not configured for this organization' },
        { status: 422 }
      );
    }
    twilioClient = getTwilioClientFromCredentials(credentials);
  } catch (credErr: any) {
    return NextResponse.json(
      { error: `Failed to initialize Twilio client: ${credErr.message}` },
      { status: 500 }
    );
  }

  // 3. Call Twilio API to release the number
  let twilioReleased = false;
  let twilioError: string | null = null;

  // Determine the Twilio resource SID to release
  const twilioSid = numberRecord.providerNumberSid || null;
  const e164 = numberRecord.e164;

  if (twilioSid) {
    try {
      await twilioClient.incomingPhoneNumbers(twilioSid).remove();
      twilioReleased = true;
    } catch (err: any) {
      const errCode = err?.code || err?.status;
      // 404 or 20404 = number already gone from Twilio — treat as success
      if (errCode === 404 || errCode === 20404 || err?.status === 404) {
        twilioReleased = true;
        twilioError = 'Number already removed from Twilio (404)';
      } else {
        twilioError = err?.message || String(err);
      }
    }
  } else if (e164) {
    // No SID stored — try to look up by phone number
    try {
      const numbers = await twilioClient.incomingPhoneNumbers.list({ phoneNumber: e164, limit: 1 });
      if (numbers.length > 0) {
        await twilioClient.incomingPhoneNumbers(numbers[0].sid).remove();
        twilioReleased = true;
      } else {
        // Number not found on Twilio — treat as already released
        twilioReleased = true;
        twilioError = 'Number not found on Twilio account';
      }
    } catch (err: any) {
      twilioError = err?.message || String(err);
    }
  } else {
    return NextResponse.json(
      { error: 'No provider SID or E.164 number to release' },
      { status: 422 }
    );
  }

  // 4. If Twilio release failed (and it's not a "already gone" case), stop
  if (!twilioReleased) {
    // Log the failure but leave DB status unchanged — honest state
    try {
      await prisma.eventLog.create({
        data: {
          orgId: ctx.orgId,
          eventType: 'number.release_from_twilio_failed',
          status: 'failed',
          metadata: JSON.stringify({
            numberId,
            e164,
            twilioSid,
            error: twilioError,
            actorUserId: ctx.userId,
          }),
        },
      });
    } catch {}

    return NextResponse.json(
      {
        error: `Failed to release number from Twilio: ${twilioError}`,
        twilioError,
        numberStatus: numberRecord.status,
      },
      { status: 502 }
    );
  }

  // 5. Update DB — mark as released, clear assignments
  try {
    await db.messageNumber.update({
      where: { id: numberId },
      data: {
        status: 'released',
        assignedSitterId: null,
        assignedThreadId: null,
        releasedAt: new Date(),
      },
    });
  } catch (dbErr: any) {
    // Twilio already released but DB update failed — critical inconsistency
    try {
      await prisma.eventLog.create({
        data: {
          orgId: ctx.orgId,
          eventType: 'number.release_db_update_failed',
          status: 'failed',
          metadata: JSON.stringify({
            numberId,
            e164,
            twilioSid,
            error: dbErr.message,
            actorUserId: ctx.userId,
            twilioReleased: true,
          }),
        },
      });
    } catch {}

    return NextResponse.json(
      {
        error: 'Number released from Twilio but database update failed. Contact support.',
        twilioReleased: true,
        dbError: dbErr.message,
      },
      { status: 500 }
    );
  }

  // 6. Audit event
  try {
    await prisma.eventLog.create({
      data: {
        orgId: ctx.orgId,
        eventType: 'number.released_from_twilio',
        status: 'success',
        metadata: JSON.stringify({
          numberId,
          e164,
          twilioSid,
          actorUserId: ctx.userId,
          previousStatus: numberRecord.status,
          activeThreadsAtRelease: activeThreads,
          twilioNote: twilioError,
        }),
      },
    });
  } catch {}

  return NextResponse.json({
    success: true,
    message: `Number ${e164} released from Twilio`,
    activeThreadsOrphaned: activeThreads,
    twilioNote: twilioError,
  });
}
