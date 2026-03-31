/**
 * Automation Thread Sender
 *
 * Phase 3: Send automation messages using thread masking number.
 * Falls back to email if no thread/number exists.
 */

import { prisma } from '@/lib/db';
import { sendThreadMessage } from '@/lib/messaging/send';
import { sendEmail } from '@/lib/email';

interface SendAutomationMessageParams {
  bookingId: string;
  orgId: string;
  clientId: string;
  message: string;
  recipient: 'client' | 'sitter' | 'owner';
  emailSubject?: string;
}

/**
 * Send automation message using thread masking number.
 * Falls back to email when no thread/number mapping exists.
 */
export async function sendAutomationMessageViaThread(
  params: SendAutomationMessageParams
): Promise<{ success: boolean; error?: string; usedThread?: boolean; channel?: string }> {
  const { bookingId, orgId, clientId, message, recipient, emailSubject } = params;

  // Step 1: Try SMS via thread
  try {
    const window = await (prisma as any).assignmentWindow.findFirst({
      where: {
        orgId,
        bookingRef: bookingId,
      },
      include: {
        thread: {
          include: {
            messageNumber: true,
          },
        },
      },
    });

    const thread = window?.thread;

    if (thread && thread.messageNumber) {
      await sendThreadMessage({
        orgId,
        threadId: thread.id,
        actor: { role: 'automation', userId: null },
        body: message,
        forceSend: false,
        idempotencyKey: `automation:${recipient}:${bookingId}:${message.length}`,
      });

      return { success: true, usedThread: true, channel: 'sms' };
    }
  } catch (error: any) {
    console.error('[sendAutomationMessageViaThread] SMS send failed, trying email fallback:', error?.message);
  }

  // Step 2: Fall back to email
  if (clientId && recipient === 'client') {
    try {
      const client = await (prisma as any).client.findFirst({
        where: { id: clientId, orgId },
        select: { email: true, firstName: true },
      });

      if (client?.email) {
        const subject = emailSubject || 'Update from your pet care provider';
        await sendEmail({
          to: client.email,
          subject,
          html: `<p>${message.replace(/\n/g, '<br>')}</p>`,
          text: message,
        });

        return { success: true, usedThread: false, channel: 'email' };
      }
    } catch (emailError: any) {
      console.error('[sendAutomationMessageViaThread] Email fallback failed:', emailError?.message);
    }
  }

  // Step 3: No channel available — return failure so BullMQ retries
  return {
    success: false,
    error: `No delivery channel available for ${recipient} on booking ${bookingId}`,
    usedThread: false,
    channel: 'none',
  };
}
