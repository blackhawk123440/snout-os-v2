import { NextRequest, NextResponse } from 'next/server';
import { getRequestContext } from '@/lib/request-context';
import { ForbiddenError, requireAnyRole } from '@/lib/rbac';
import { checkRateLimit, getRateLimitIdentifier, rateLimitResponse } from '@/lib/rate-limit';
import { sendBookingLinkMessage } from '@/lib/messaging/payment-tip-send';
import { asMessagingActorRole } from '@/lib/messaging/send';

export async function POST(request: NextRequest) {
  let ctx;
  try {
    ctx = await getRequestContext(request);
    requireAnyRole(ctx, ['owner', 'admin']);
  } catch (error) {
    if (error instanceof ForbiddenError) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const actorRole = asMessagingActorRole(ctx.role);
  if (!actorRole) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  let body: { bookingId?: string; forceResend?: boolean };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const bookingId = String(body.bookingId || '').trim();
  if (!bookingId) return NextResponse.json({ error: 'bookingId is required' }, { status: 400 });

  const limiter = await checkRateLimit(`${ctx.orgId}:${ctx.userId || getRateLimitIdentifier(request)}:${bookingId}:tip`, {
    keyPrefix: 'messages:tip-link',
    limit: 6,
    windowSec: 60,
  });
  if (!limiter.success) return rateLimitResponse(limiter.retryAfter) as NextResponse;

  try {
    const result = await sendBookingLinkMessage({
      orgId: ctx.orgId,
      bookingId,
      actor: { role: actorRole, userId: ctx.userId, sitterId: ctx.sitterId, clientId: ctx.clientId },
      templateType: 'tip_link',
      dedupeWindowMs: 60_000,
      forceResend: Boolean(body.forceResend),
      baseUrl: process.env.NEXT_PUBLIC_APP_URL || new URL(request.url).origin,
      correlationId: ctx.correlationId,
    });

    return NextResponse.json({
      ok: true,
      deduped: result.deduped,
      threadId: result.threadId,
      messageId: result.messageEvent.id,
      deliveryStatus: result.messageEvent.deliveryStatus,
      providerMessageId: result.messageEvent.providerMessageSid,
      error: result.messageEvent.failureDetail || null,
      link: result.link,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to send tip link';
    const status = message.includes('required') || message.includes('generated') ? 422 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
