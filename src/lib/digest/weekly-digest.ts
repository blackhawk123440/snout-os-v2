/**
 * Weekly Owner Intelligence Digest
 * Generates and sends a summary email with key business metrics,
 * trend comparisons, and actionable insights.
 */

import { prisma } from "@/lib/db";
import { sendEmail } from "@/lib/email";

// ---- Types ----

interface DigestData {
  orgName: string;
  // Current period (last 7 days)
  totalBookings: number;
  revenueCents: number;
  newClients: number;
  activeSitters: number;
  topSitterName: string | null;
  topSitterScore: number | null;
  failedPayouts: number;
  unpaidBookings: number;
  waitlistEntries: number;
  // Previous period (7-14 days ago) for trends
  prevBookings: number;
  prevRevenueCents: number;
  prevNewClients: number;
}

// ---- Helpers ----

function trendArrow(current: number, previous: number): string {
  if (current > previous) return "\u2191"; // up arrow
  if (current < previous) return "\u2193"; // down arrow
  return "\u2192"; // right arrow (flat)
}

function trendColor(current: number, previous: number): string {
  if (current > previous) return "#16a34a"; // green
  if (current < previous) return "#dc2626"; // red
  return "#6b7280"; // gray
}

function formatCents(cents: number): string {
  return `$${(cents / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function buildActionItem(data: DigestData): string | null {
  if (data.failedPayouts > 0) {
    return `${data.failedPayouts} payout${data.failedPayouts === 1 ? "" : "s"} failed and need${data.failedPayouts === 1 ? "s" : ""} attention`;
  }
  if (data.unpaidBookings > 0) {
    return `${data.unpaidBookings} booking${data.unpaidBookings === 1 ? "" : "s"} unpaid`;
  }
  return null;
}

// ---- HTML Builder ----

function buildDigestHtml(data: DigestData, dashboardUrl?: string): string {
  const revenueArrow = trendArrow(data.revenueCents, data.prevRevenueCents);
  const revenueColor = trendColor(data.revenueCents, data.prevRevenueCents);
  const bookingsArrow = trendArrow(data.totalBookings, data.prevBookings);
  const bookingsColor = trendColor(data.totalBookings, data.prevBookings);
  const clientsArrow = trendArrow(data.newClients, data.prevNewClients);
  const clientsColor = trendColor(data.newClients, data.prevNewClients);

  const actionItem = buildActionItem(data);
  const ctaUrl = dashboardUrl || process.env.NEXTAUTH_URL || "https://app.snoutservices.com";

  const actionSection = actionItem
    ? `
    <tr>
      <td style="padding: 16px 24px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: #fef3c7; border-radius: 8px; border: 1px solid #f59e0b;">
          <tr>
            <td style="padding: 12px 16px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 14px; color: #92400e;">
              <strong>Action needed:</strong> ${actionItem}
            </td>
          </tr>
        </table>
      </td>
    </tr>`
    : "";

  const topSitterSection = data.topSitterName
    ? `
    <tr>
      <td style="padding: 0 24px 16px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: #f0fdf4; border-radius: 8px; border: 1px solid #86efac;">
          <tr>
            <td style="padding: 12px 16px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 14px; color: #166534;">
              <strong>Top sitter:</strong> ${data.topSitterName}${data.topSitterScore !== null ? ` (SRS score: ${data.topSitterScore.toFixed(1)})` : ""}
            </td>
          </tr>
        </table>
      </td>
    </tr>`
    : "";

  const waitlistSection = data.waitlistEntries > 0
    ? `
    <tr>
      <td style="padding: 0 24px 16px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: #eff6ff; border-radius: 8px; border: 1px solid #93c5fd;">
          <tr>
            <td style="padding: 12px 16px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 14px; color: #1e40af;">
              <strong>Waitlist:</strong> ${data.waitlistEntries} entries
            </td>
          </tr>
        </table>
      </td>
    </tr>`
    : "";

  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin: 0; padding: 0; background-color: #f3f4f6;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: #f3f4f6;">
    <tr>
      <td align="center" style="padding: 24px 16px;">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width: 600px; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
          <!-- Header -->
          <tr>
            <td style="background-color: #7c3aed; padding: 32px 24px; text-align: center;">
              <h1 style="margin: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 24px; font-weight: 700; color: #ffffff;">
                ${data.orgName}
              </h1>
              <p style="margin: 8px 0 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 14px; color: #e9d5ff;">
                Weekly Intelligence Digest
              </p>
            </td>
          </tr>

          <!-- Revenue Card -->
          <tr>
            <td style="padding: 24px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: #faf5ff; border-radius: 12px; border: 1px solid #e9d5ff;">
                <tr>
                  <td style="padding: 20px; text-align: center;">
                    <p style="margin: 0 0 4px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 13px; color: #6b7280; text-transform: uppercase; letter-spacing: 0.05em;">
                      Revenue (7 days)
                    </p>
                    <p style="margin: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 36px; font-weight: 700; color: #1f2937;">
                      ${formatCents(data.revenueCents)}
                      <span style="font-size: 20px; color: ${revenueColor};">${revenueArrow}</span>
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Key Stats -->
          <tr>
            <td style="padding: 0 24px 24px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td width="33%" style="text-align: center; padding: 12px 4px; border-right: 1px solid #e5e7eb;">
                    <p style="margin: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 24px; font-weight: 700; color: #1f2937;">
                      ${data.totalBookings} <span style="font-size: 14px; color: ${bookingsColor};">${bookingsArrow}</span>
                    </p>
                    <p style="margin: 4px 0 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 12px; color: #6b7280;">Bookings</p>
                  </td>
                  <td width="33%" style="text-align: center; padding: 12px 4px; border-right: 1px solid #e5e7eb;">
                    <p style="margin: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 24px; font-weight: 700; color: #1f2937;">
                      ${data.newClients} <span style="font-size: 14px; color: ${clientsColor};">${clientsArrow}</span>
                    </p>
                    <p style="margin: 4px 0 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 12px; color: #6b7280;">New Clients</p>
                  </td>
                  <td width="34%" style="text-align: center; padding: 12px 4px;">
                    <p style="margin: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 24px; font-weight: 700; color: #1f2937;">
                      ${data.activeSitters}
                    </p>
                    <p style="margin: 4px 0 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 12px; color: #6b7280;">Active Sitters</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Action Item -->
          ${actionSection}

          <!-- Top Sitter -->
          ${topSitterSection}

          <!-- Waitlist -->
          ${waitlistSection}

          <!-- CTA -->
          <tr>
            <td style="padding: 8px 24px 32px; text-align: center;">
              <a href="${ctaUrl}" style="display: inline-block; padding: 12px 32px; background-color: #7c3aed; color: #ffffff; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 14px; font-weight: 600; text-decoration: none; border-radius: 8px;">
                View Dashboard
              </a>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 16px 24px; background-color: #f9fafb; text-align: center; border-top: 1px solid #e5e7eb;">
              <p style="margin: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 12px; color: #9ca3af;">
                Sent by Snout OS &middot; Weekly Intelligence Digest
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

// ---- Data Fetching ----

async function gatherDigestData(orgId: string): Promise<DigestData> {
  const now = new Date();
  const sevenDaysAgo = new Date(now);
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const fourteenDaysAgo = new Date(now);
  fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);

  // Fetch org name
  const org = await prisma.org.findUnique({
    where: { id: orgId },
    select: { name: true },
  });
  const orgName = org?.name || "Your Business";

  const [
    totalBookings,
    prevBookings,
    revenueCentsResult,
    prevRevenueCentsResult,
    newClients,
    prevNewClients,
    activeSitters,
    failedPayouts,
    unpaidBookings,
    topSitterSnapshot,
    waitlistSetting,
  ] = await Promise.all([
    // Current 7 days bookings
    prisma.booking.count({
      where: { orgId, createdAt: { gte: sevenDaysAgo } },
    }),
    // Previous 7 days bookings
    prisma.booking.count({
      where: { orgId, createdAt: { gte: fourteenDaysAgo, lt: sevenDaysAgo } },
    }),
    // Current 7 days revenue (StripeCharge)
    prisma.stripeCharge.aggregate({
      where: {
        orgId,
        status: "succeeded",
        createdAt: { gte: sevenDaysAgo },
      },
      _sum: { amount: true },
    }),
    // Previous 7 days revenue
    prisma.stripeCharge.aggregate({
      where: {
        orgId,
        status: "succeeded",
        createdAt: { gte: fourteenDaysAgo, lt: sevenDaysAgo },
      },
      _sum: { amount: true },
    }),
    // New clients (current 7 days)
    prisma.client.count({
      where: { orgId, createdAt: { gte: sevenDaysAgo }, deletedAt: null },
    }),
    // New clients (previous 7 days)
    prisma.client.count({
      where: {
        orgId,
        createdAt: { gte: fourteenDaysAgo, lt: sevenDaysAgo },
        deletedAt: null,
      },
    }),
    // Active sitters
    prisma.sitter.count({
      where: { orgId, active: true, deletedAt: null },
    }),
    // Failed payouts (last 7 days)
    prisma.payoutTransfer.count({
      where: {
        orgId,
        status: "failed",
        createdAt: { gte: sevenDaysAgo },
      },
    }),
    // Unpaid bookings (recent with upcoming dates)
    prisma.booking.count({
      where: {
        orgId,
        paymentStatus: "unpaid",
        status: { notIn: ["cancelled", "canceled"] },
        startAt: { gte: sevenDaysAgo },
      },
    }),
    // Top SRS sitter (latest snapshot, highest score)
    prisma.sitterTierSnapshot.findFirst({
      where: { orgId },
      orderBy: [{ rolling30dScore: "desc" }],
      select: {
        rolling30dScore: true,
        sitter: { select: { firstName: true, lastName: true } },
      },
    }),
    // Waitlist entries setting
    prisma.setting.findFirst({
      where: { orgId, key: "waitlist_entries" },
      select: { value: true },
    }),
  ]);

  // Parse waitlist
  let waitlistEntries = 0;
  if (waitlistSetting) {
    try {
      const parsed = JSON.parse(waitlistSetting.value);
      waitlistEntries = Array.isArray(parsed) ? parsed.length : 0;
    } catch {
      waitlistEntries = 0;
    }
  }

  return {
    orgName,
    totalBookings,
    revenueCents: revenueCentsResult._sum?.amount ?? 0,
    newClients,
    activeSitters,
    topSitterName: topSitterSnapshot?.sitter
      ? `${topSitterSnapshot.sitter.firstName} ${topSitterSnapshot.sitter.lastName}`.trim()
      : null,
    topSitterScore: topSitterSnapshot?.rolling30dScore ?? null,
    failedPayouts,
    unpaidBookings,
    waitlistEntries,
    prevBookings,
    prevRevenueCents: prevRevenueCentsResult._sum?.amount ?? 0,
    prevNewClients,
  };
}

// ---- Public API ----

/**
 * Generate the weekly digest HTML for preview (no email sent).
 */
export async function generateWeeklyDigestHtml(
  orgId: string
): Promise<string> {
  const data = await gatherDigestData(orgId);
  return buildDigestHtml(data);
}

/**
 * Generate and send the weekly owner intelligence digest email.
 */
export async function sendWeeklyOwnerDigest(
  orgId: string
): Promise<{ sent: boolean; error?: string }> {
  try {
    // Find the owner's email
    const ownerUser = await prisma.user.findFirst({
      where: { orgId, role: "owner", deletedAt: null },
      select: { email: true, name: true },
    });

    if (!ownerUser?.email) {
      return { sent: false, error: "No owner email found for this organization" };
    }

    const data = await gatherDigestData(orgId);
    const html = buildDigestHtml(data);

    const result = await sendEmail({
      to: ownerUser.email,
      subject: `${data.orgName} - Weekly Intelligence Digest`,
      html,
    });

    if (!result.success) {
      return { sent: false, error: result.error || "Email send failed" };
    }

    return { sent: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return { sent: false, error: message };
  }
}
