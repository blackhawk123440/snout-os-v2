/**
 * GET /api/ops/revenue-optimization
 * Revenue optimization suggestions for the owner:
 * - Holiday pricing surcharges
 * - Low capacity alerts for tomorrow
 * - Package upsell opportunities
 * - Revenue by service type (current month)
 */

import { NextResponse } from "next/server";
import { getRequestContext } from "@/lib/request-context";
import { requireAnyRole, ForbiddenError } from "@/lib/rbac";
import { getScopedDb } from "@/lib/tenancy";

export async function GET() {
  let ctx;
  try {
    ctx = await getRequestContext();
    requireAnyRole(ctx, ["owner", "admin"]);
  } catch (error) {
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const db = getScopedDb(ctx);

    // ---- 1. Holiday pricing ----
    const holidaySetting = await db.setting.findFirst({
      where: { key: "holiday_dates" },
    });

    let holidays: { date: string; surchargePercent: number }[] = [];
    if (holidaySetting) {
      try {
        const parsed = JSON.parse(holidaySetting.value);
        if (Array.isArray(parsed)) {
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          holidays = parsed.filter(
            (h: { date?: string; surchargePercent?: number }) =>
              h.date && new Date(h.date) >= today
          );
        }
      } catch {
        // Invalid JSON in setting; treat as empty
      }
    }

    // ---- 2. Low capacity alerts (tomorrow) ----
    const now = new Date();
    const tomorrowStart = new Date(now);
    tomorrowStart.setDate(tomorrowStart.getDate() + 1);
    tomorrowStart.setHours(0, 0, 0, 0);
    const tomorrowEnd = new Date(tomorrowStart);
    tomorrowEnd.setDate(tomorrowEnd.getDate() + 1);

    const [tomorrowBookings, activeSitters] = await Promise.all([
      db.booking.count({
        where: {
          startAt: { gte: tomorrowStart, lt: tomorrowEnd },
          status: { notIn: ["cancelled", "canceled"] },
        },
      }),
      db.sitter.count({
        where: { active: true, deletedAt: null },
      }),
    ]);

    const estimatedCapacity = activeSitters * 8; // rough: 8 slots per sitter per day
    const utilizationPercent =
      estimatedCapacity > 0
        ? Math.round((tomorrowBookings / estimatedCapacity) * 100)
        : 0;

    const capacityAlert = {
      tomorrow: tomorrowStart.toISOString().slice(0, 10),
      bookings: tomorrowBookings,
      estimatedCapacity,
      utilizationPercent,
      suggestFlashPromotion: utilizationPercent < 60,
    };

    // ---- 3. Package upsell opportunities ----
    // Find clients with 4+ individual bookings this calendar month
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);

    const bookingsThisMonth = await db.booking.findMany({
      where: {
        startAt: { gte: monthStart, lt: monthEnd },
        status: { notIn: ["cancelled", "canceled"] },
        clientId: { not: null },
      },
      select: {
        clientId: true,
        service: true,
        client: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    // Group by clientId + service
    const clientServiceMap = new Map<
      string,
      { clientId: string; clientName: string; service: string; count: number }
    >();

    for (const b of bookingsThisMonth) {
      if (!b.clientId || !b.client) continue;
      const key = `${b.clientId}::${b.service}`;
      const existing = clientServiceMap.get(key);
      if (existing) {
        existing.count += 1;
      } else {
        clientServiceMap.set(key, {
          clientId: b.clientId,
          clientName: `${b.client.firstName} ${b.client.lastName}`.trim(),
          service: b.service,
          count: 1,
        });
      }
    }

    const upsellOpportunities = Array.from(clientServiceMap.values())
      .filter((entry) => entry.count >= 4)
      .map((entry) => ({
        clientId: entry.clientId,
        clientName: entry.clientName,
        bookingsThisMonth: entry.count,
        service: entry.service,
      }));

    // ---- 4. Revenue by service type (current month) ----
    const monthBookingsWithRevenue = await db.booking.findMany({
      where: {
        startAt: { gte: monthStart, lt: monthEnd },
        status: { notIn: ["cancelled", "canceled"] },
      },
      select: {
        service: true,
        totalPrice: true,
      },
    });

    const serviceRevenueMap = new Map<
      string,
      { totalCents: number; count: number }
    >();

    for (const b of monthBookingsWithRevenue) {
      const existing = serviceRevenueMap.get(b.service);
      const amountCents = Math.round(b.totalPrice * 100);
      if (existing) {
        existing.totalCents += amountCents;
        existing.count += 1;
      } else {
        serviceRevenueMap.set(b.service, { totalCents: amountCents, count: 1 });
      }
    }

    const revenueByService = Array.from(serviceRevenueMap.entries())
      .map(([service, data]) => ({
        service,
        totalCents: data.totalCents,
        count: data.count,
      }))
      .sort((a, b) => b.totalCents - a.totalCents);

    return NextResponse.json({
      holidays,
      capacityAlert,
      upsellOpportunities,
      revenueByService,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: "Failed to load revenue optimization data", message },
      { status: 500 }
    );
  }
}
