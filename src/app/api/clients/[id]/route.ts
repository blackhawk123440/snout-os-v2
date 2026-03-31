/**
 * GET /api/clients/[id]
 * Client detail with bookings. Includes deletedAt for owner history.
 */

import { NextResponse } from "next/server";
import { getRequestContext } from "@/lib/request-context";
import { requireAnyRole, ForbiddenError } from "@/lib/rbac";
import { getScopedDb } from "@/lib/tenancy";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
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

  const { id: clientId } = await params;
  if (!clientId) {
    return NextResponse.json({ error: "Client ID required" }, { status: 400 });
  }

  try {
    const db = getScopedDb(ctx);
    const client = await db.client.findFirst({
      where: { id: clientId },
      include: {
        user: { select: { id: true } },
        bookings: {
          orderBy: { startAt: "desc" },
          include: {
            pets: { select: { species: true } },
            sitter: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                currentTier: {
                  select: { id: true, name: true, priorityLevel: true },
                },
              },
            },
            timeSlots: {
              select: { id: true, startAt: true, endAt: true, duration: true },
            },
          },
        },
      },
    });

    if (!client) {
      return NextResponse.json({ error: "Client not found" }, { status: 404 });
    }

    const completed = client.bookings.filter((b) => b.status === "completed").length;
    const upcoming = client.bookings.filter((b) =>
      ["pending", "confirmed", "in_progress"].includes(b.status)
    ).length;
    const totalRevenue = client.bookings
      .filter((b) => b.status === "completed")
      .reduce((sum, b) => sum + Number(b.totalPrice), 0);

    const stats = {
      totalBookings: client.bookings.length,
      totalRevenue,
      completedBookings: completed,
      upcomingBookings: upcoming,
    };

    const clientData = {
      id: client.id,
      firstName: client.firstName,
      lastName: client.lastName,
      phone: client.phone,
      email: client.email,
      address: client.address,
      deletedAt: client.deletedAt,
      userId: (client as any).user?.id ?? null,
    };

    const bookingsData = client.bookings.map((b) => ({
      id: b.id,
      firstName: b.firstName,
      lastName: b.lastName,
      service: b.service,
      startAt: b.startAt,
      endAt: b.endAt,
      status: b.status,
      totalPrice: Number(b.totalPrice),
      paymentStatus: b.paymentStatus,
      pets: b.pets,
      sitter: b.sitter,
      timeSlots: b.timeSlots,
    }));

    return NextResponse.json({
      client: clientData,
      bookings: bookingsData,
      stats,
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: "Failed to load client", message: msg },
      { status: 500 }
    );
  }
}
