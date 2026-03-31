/**
 * Weekly payout summary for sitters.
 * Generates and sends a summary email/SMS with earnings breakdown.
 * Called by the reminder scheduler or a dedicated cron job.
 */

import { prisma } from '@/lib/db';
import { sendMessage } from '@/lib/message-utils';
import { sendEmail } from '@/lib/email';
import { logEvent } from '@/lib/log-event';

export async function sendWeeklyPayoutSummary(params: {
  orgId: string;
  sitterId: string;
}): Promise<{ sent: boolean; error?: string }> {
  const { orgId, sitterId } = params;

  try {
    const sitter = await (prisma as any).sitter.findUnique({
      where: { id: sitterId },
      select: { firstName: true, phone: true, email: true, commissionPercentage: true },
    });
    if (!sitter) return { sent: false, error: 'Sitter not found' };

    // Get last 7 days of payouts
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const transfers = await (prisma as any).payoutTransfer.findMany({
      where: { orgId, sitterId, createdAt: { gte: weekAgo } },
      orderBy: { createdAt: 'desc' },
      include: {
        booking: { select: { service: true, startAt: true, firstName: true, lastName: true } },
      },
    });

    if (transfers.length === 0) return { sent: false, error: 'No payouts this week' };

    const paidTransfers = transfers.filter((t: any) => t.status === 'paid');
    const failedTransfers = transfers.filter((t: any) => t.status === 'failed');
    const pendingTransfers = transfers.filter((t: any) => t.status === 'pending');
    const totalPaid = paidTransfers.reduce((sum: number, t: any) => sum + t.amount, 0) / 100;

    // Build booking breakdown
    const breakdown = paidTransfers.map((t: any) => {
      const b = t.booking;
      const date = b?.startAt ? new Date(b.startAt).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }) : '';
      return `  ${b?.service || 'Visit'} — ${b?.firstName || ''} ${b?.lastName || ''} (${date}): $${(t.amount / 100).toFixed(2)}`;
    }).join('\n');

    const smsMessage = [
      `Hi ${sitter.firstName || 'there'}, here's your weekly payout summary:`,
      ``,
      `Total earned: $${totalPaid.toFixed(2)} (${paidTransfers.length} visit${paidTransfers.length !== 1 ? 's' : ''})`,
      failedTransfers.length > 0 ? `${failedTransfers.length} payout(s) failed — check your Stripe account` : '',
      pendingTransfers.length > 0 ? `${pendingTransfers.length} payout(s) pending` : '',
      ``,
      `Commission rate: ${sitter.commissionPercentage || 80}%`,
    ].filter(Boolean).join('\n');

    // Send SMS
    if (sitter.phone) {
      await sendMessage(sitter.phone, smsMessage);
    }

    // Send email if available
    if (sitter.email) {
      const emailHtml = `
        <div style="font-family: -apple-system, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #432f21;">Weekly Payout Summary</h2>
          <p>Hi ${sitter.firstName || 'there'},</p>
          <p>Here's your earnings for the past week:</p>
          <div style="background: #f9fafb; border-radius: 8px; padding: 16px; margin: 16px 0;">
            <p style="font-size: 24px; font-weight: 700; margin: 0;">$${totalPaid.toFixed(2)}</p>
            <p style="color: #6b7280; margin: 4px 0 0;">${paidTransfers.length} completed visit${paidTransfers.length !== 1 ? 's' : ''}</p>
          </div>
          <h3 style="margin-top: 24px;">Breakdown:</h3>
          <table style="width: 100%; border-collapse: collapse;">
            ${paidTransfers.map((t: any) => {
              const b = t.booking;
              const date = b?.startAt ? new Date(b.startAt).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }) : '';
              return `<tr style="border-bottom: 1px solid #e5e7eb;">
                <td style="padding: 8px 0;">${b?.service || 'Visit'} — ${b?.firstName || ''}</td>
                <td style="padding: 8px 0; text-align: right;">$${(t.amount / 100).toFixed(2)}</td>
                <td style="padding: 8px 0; text-align: right; color: #9ca3af; font-size: 12px;">${date}</td>
              </tr>`;
            }).join('')}
          </table>
          ${failedTransfers.length > 0 ? `<p style="color: #dc2626; margin-top: 16px;">${failedTransfers.length} payout(s) failed. Please check your Stripe account setup.</p>` : ''}
          <p style="color: #8c7769; font-size: 14px; margin-top: 24px;">— Snout Pet Care</p>
        </div>
      `;
      await sendEmail({
        to: sitter.email,
        subject: `Weekly Payout: $${totalPaid.toFixed(2)} earned`,
        html: emailHtml,
      });
    }

    await logEvent({
      orgId,
      action: 'payout.weekly_summary_sent',
      status: 'success',
      metadata: { sitterId, totalPaid, paidCount: paidTransfers.length },
    }).catch(() => {});

    return { sent: true };
  } catch (error) {
    return { sent: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

/**
 * Send weekly summaries to ALL sitters in an org.
 */
export async function sendAllWeeklyPayoutSummaries(orgId: string): Promise<{ sent: number; skipped: number }> {
  const sitters = await (prisma as any).sitter.findMany({
    where: { orgId, deletedAt: null },
    select: { id: true },
  });

  let sent = 0;
  let skipped = 0;
  for (const sitter of sitters) {
    const result = await sendWeeklyPayoutSummary({ orgId, sitterId: sitter.id });
    if (result.sent) sent++;
    else skipped++;
  }
  return { sent, skipped };
}
