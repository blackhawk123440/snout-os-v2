import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { randomUUID } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/db';
import { getScopedDb } from '@/lib/tenancy';
import { getRequestContext } from '@/lib/request-context';
import { requireOwnerOrAdmin, ForbiddenError } from '@/lib/rbac';
import { logEvent } from '@/lib/log-event';
import { env } from '@/lib/env';

const InviteSchema = z.object({
  firstName: z.string().min(1).max(100),
  lastName: z.string().min(1).max(100),
  email: z.string().email().max(200),
  phone: z.string().max(30).optional(),
  commissionPercentage: z.number().min(0).max(100).optional(),
});

export async function POST(request: NextRequest) {
  let ctx;
  try {
    ctx = await getRequestContext();
    requireOwnerOrAdmin(ctx);
  } catch (error) {
    if (error instanceof ForbiddenError) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const parsed = InviteSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: 'Invalid input', details: parsed.error.issues }, { status: 400 });

    const db = getScopedDb(ctx);
    const d = parsed.data;

    // Check for existing sitter with same email
    const existing = await db.sitter.findFirst({
      where: { email: d.email },
      select: { id: true },
    });
    if (existing) {
      return NextResponse.json({ error: 'A sitter with this email already exists' }, { status: 409 });
    }

    const inviteToken = randomUUID();
    const tempPasswordHash = await bcrypt.hash(randomUUID(), 12);

    // Check if a user with this email already exists (e.g., existing client account)
    const existingUser = await db.user.findFirst({
      where: { email: d.email },
      select: { id: true, role: true, sitterId: true },
    });

    // If user exists and is already a sitter, reject
    if (existingUser?.sitterId) {
      return NextResponse.json({ error: 'A user with this email is already linked to a sitter account' }, { status: 409 });
    }

    // Create sitter + link or create user in a transaction
    // Use raw prisma.$transaction — the scoped proxy's $transaction wrapper
    // doesn't support interactive transactions (tx lacks _engineConfig).
    const result = await prisma.$transaction(async (tx) => {
      const sitter = await tx.sitter.create({
        data: {
          orgId: ctx.orgId,
          firstName: d.firstName,
          lastName: d.lastName,
          email: d.email,
          phone: d.phone || '',
          commissionPercentage: d.commissionPercentage ?? 80,
          active: false,
          onboardingStatus: 'invited',
        },
      });

      if (existingUser) {
        await tx.user.update({
          where: { id: existingUser.id },
          data: {
            sitterId: sitter.id,
            role: 'sitter',
            inviteToken,
            inviteExpiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          },
        });
      } else {
        await tx.user.create({
          data: {
            orgId: ctx.orgId,
            name: `${d.firstName} ${d.lastName}`.trim(),
            email: d.email,
            role: 'sitter',
            sitterId: sitter.id,
            passwordHash: tempPasswordHash,
            inviteToken,
            inviteExpiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          },
        });
      }

      return sitter;
    });

    const baseUrl = env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const inviteLink = `${baseUrl}/sitter/onboard?token=${inviteToken}`;

    await logEvent({
      orgId: ctx.orgId,
      action: 'sitter.invited',
      status: 'success',
      metadata: { sitterId: result.id, sitterName: `${d.firstName} ${d.lastName}`.trim(), email: d.email },
    });

    // Send invite notification (email + SMS if available)
    void (async () => {
      try {
        // Email invite
        const { sendEmail } = await import('@/lib/email');
        const businessName = await (async () => {
          try {
            const bs = await db.businessSettings.findFirst({ select: { businessName: true } });
            return bs?.businessName || 'Snout';
          } catch { return 'Snout'; }
        })();

        const emailSubject = `You've been invited to join ${businessName} on Snout!`;
        const emailBody = `Hi ${d.firstName},\n\nYou've been invited to join ${businessName} as a pet sitter!\n\nSet up your account here:\n${inviteLink}\n\nThis link expires in 7 days.\n\n— ${businessName}`;
        await sendEmail({
          to: d.email,
          subject: emailSubject,
          text: emailBody,
          html: `<div style="font-family: -apple-system, sans-serif; font-size: 15px; line-height: 1.5; color: #1a1a1a; max-width: 480px;">${emailBody.replace(/\n/g, '<br>')}</div>`,
        }).catch((e: unknown) => console.error('[sitter-invite] Email send failed:', e));

        // SMS invite (if messaging provider available)
        const { isMessagingAvailable } = await import('@/lib/messaging/availability');
        const smsAvailable = await isMessagingAvailable(ctx.orgId);
        if (smsAvailable && d.phone) {
          const { getMessagingProvider } = await import('@/lib/messaging/provider-factory');
          const provider = await getMessagingProvider(ctx.orgId);
          const smsBody = `Hi ${d.firstName}, you've been invited to join ${businessName} as a pet sitter! Set up your account here: ${inviteLink}`;
          await provider.sendMessage({ to: d.phone.startsWith('+') ? d.phone : `+1${d.phone.replace(/\D/g, '')}`, body: smsBody }).catch((e: unknown) => console.error('[sitter-invite] SMS send failed:', e));
        }

        await logEvent({
          orgId: ctx.orgId,
          action: 'sitter.invite_notification_sent',
          status: 'success',
          metadata: { sitterId: result.id, email: d.email, smsAttempted: smsAvailable && !!d.phone },
        });
      } catch (notifError) {
        console.error('[sitter-invite] Notification failed (non-blocking):', notifError);
      }
    })();

    return NextResponse.json({
      success: true,
      sitter: {
        id: result.id,
        firstName: d.firstName,
        lastName: d.lastName,
        email: d.email,
        onboardingStatus: 'invited',
      },
      inviteLink,
    }, { status: 201 });
  } catch (error: unknown) {
    console.error('[sitter-invite] ERROR:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    const code = (error as any)?.code;
    const meta = (error as any)?.meta;
    return NextResponse.json({
      error: 'Failed to invite sitter',
      message,
      ...(code && { code }),
      ...(meta && { meta }),
    }, { status: 500 });
  }
}
