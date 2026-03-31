/**
 * GET /api/automations
 * List automation types with current org settings (enabled, sendTo*, template summary).
 * Owner/admin only, org-scoped.
 */

import { NextResponse } from "next/server";
import { getRequestContext } from "@/lib/request-context";
import { requireOwnerOrAdmin, ForbiddenError } from "@/lib/rbac";
import { getAutomationSettings } from "@/lib/automation-utils";
import { AUTOMATION_TYPE_IDS, type AutomationTypeId } from "@/lib/automations/types";
import { prisma } from "@/lib/db";

const TYPE_META: Record<
  AutomationTypeId,
  { name: string; description: string; category: string }
> = {
  bookingConfirmation: {
    name: "Booking Confirmation",
    description: "Sends confirmation when a booking is confirmed",
    category: "booking",
  },
  nightBeforeReminder: {
    name: "Night Before Reminder",
    description: "Sends reminders the night before appointments",
    category: "reminder",
  },
  paymentReminder: {
    name: "Payment Reminder",
    description: "Sends payment reminders to clients",
    category: "payment",
  },
  sitterAssignment: {
    name: "Sitter Assignment",
    description: "Notifies sitters and owners when a sitter is assigned",
    category: "notification",
  },
  postVisitThankYou: {
    name: "Post Visit Thank You",
    description: "Sends thank you messages after visits",
    category: "notification",
  },
  ownerNewBookingAlert: {
    name: "Owner New Booking Alert",
    description: "Alerts owner when a new booking is created",
    category: "notification",
  },
  checkinNotification: {
    name: "Check-In Notification",
    description: "Notifies client and owner when sitter starts a visit",
    category: "notification",
  },
  checkoutNotification: {
    name: "Check-Out Notification",
    description: "Notifies client and owner when sitter ends a visit",
    category: "notification",
  },
  bookingCancellation: {
    name: "Booking Cancellation",
    description: "Notifies all parties when a booking is cancelled",
    category: "booking",
  },
  visitReportNotification: {
    name: "Visit Report Notification",
    description: "Notifies client when sitter submits a visit report",
    category: "notification",
  },
};

export async function GET() {
  let ctx;
  try {
    ctx = await getRequestContext();
    requireOwnerOrAdmin(ctx);
  } catch (error) {
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const settings = await getAutomationSettings(ctx.orgId);

    // Fetch most recent EventLog entry per automation type for lastFiredAt
    const lastFiredMap = new Map<string, Date>();
    try {
      const recentLogs = await (prisma as any).eventLog.findMany({
        where: {
          orgId: ctx.orgId,
          automationType: { in: [...AUTOMATION_TYPE_IDS] },
          status: { in: ['success', 'failed'] },
        },
        select: { automationType: true, createdAt: true },
        orderBy: { createdAt: 'desc' },
      });
      for (const log of recentLogs) {
        if (log.automationType && !lastFiredMap.has(log.automationType)) {
          lastFiredMap.set(log.automationType, log.createdAt);
        }
      }
    } catch { /* lastFiredAt is optional — degrade gracefully */ }

    const list = AUTOMATION_TYPE_IDS.map((id) => {
      const block = settings[id];
      const meta = TYPE_META[id];
      return {
        id,
        name: meta.name,
        description: meta.description,
        category: meta.category,
        enabled: !!block?.enabled,
        sendToClient: !!block?.sendToClient,
        sendToSitter: !!block?.sendToSitter,
        sendToOwner: !!block?.sendToOwner,
        lastFiredAt: lastFiredMap.get(id)?.toISOString() ?? null,
      };
    });
    return NextResponse.json({ items: list });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: "Failed to load automations", message }, { status: 500 });
  }
}
