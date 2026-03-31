/**
 * GET /api/clients
 * List clients for the org. Includes soft-deleted (for owner history).
 */

import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { getRequestContext } from "@/lib/request-context";
import { requireAnyRole, requireOwnerOrAdmin, ForbiddenError } from "@/lib/rbac";
import { getScopedDb } from "@/lib/tenancy";
import { parsePage, parsePageSize } from "@/lib/pagination";
import { env } from "@/lib/env";

const DEFAULT_PAGE_SIZE = 50;
const MAX_PAGE_SIZE = 200;

export async function GET(request: NextRequest) {
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
    const url = (request as NextRequest).nextUrl ?? new URL(request.url);
    const params = url.searchParams;
    const page = parsePage(params.get("page"), 1);
    const pageSize = parsePageSize(params.get("pageSize"), DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE);
    const statusParam = params.get("status")?.trim().toLowerCase();
    const search = params.get("search")?.trim();
    const deletedFilter =
      statusParam === "inactive" ? { not: null } : statusParam === "active" ? null : undefined;
    const where: Record<string, any> = {};
    if (deletedFilter !== undefined) {
      where.deletedAt = deletedFilter;
    }
    if (search) {
      where.OR = [
        { firstName: { contains: search, mode: "insensitive" } },
        { lastName: { contains: search, mode: "insensitive" } },
        { email: { contains: search, mode: "insensitive" } },
        { phone: { contains: search, mode: "insensitive" } },
      ];
    }

    const total = await db.client.count({ where });
    const clients = await db.client.findMany({
      where,
      orderBy: [{ lastBookingAt: "desc" }, { id: "asc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true,
        firstName: true,
        lastName: true,
        phone: true,
        email: true,
        address: true,
        deletedAt: true,
        bookings: {
          take: 1,
          orderBy: { startAt: "desc" },
          select: { startAt: true },
        },
        _count: { select: { bookings: true } },
      },
    });

    const items = clients.map((c) => {
      const lastBooking = c.bookings[0];
      return {
        id: c.id,
        firstName: c.firstName,
        lastName: c.lastName,
        phone: c.phone,
        email: c.email,
        address: c.address,
        lastBooking: lastBooking?.startAt ?? null,
        totalBookings: c._count.bookings,
        deletedAt: c.deletedAt,
      };
    });

    return NextResponse.json({
      items,
      page,
      pageSize,
      total,
      hasMore: page * pageSize < total,
      sort: { field: "lastBookingAt", direction: "desc" },
      filters: {
        status: statusParam ?? null,
        search: search ?? null,
      },
    });
  } catch (error: unknown) {
    console.error('[api/clients] FULL ERROR:', error instanceof Error ? { message: error.message, stack: error.stack?.split('\n').slice(0,5) } : error);
    const msg = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: "Failed to load clients", message: msg },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  let ctx;
  try {
    ctx = await getRequestContext();
    requireOwnerOrAdmin(ctx);
  } catch (error) {
    if (error instanceof ForbiddenError) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const db = getScopedDb(ctx);
    const body = await request.json();
    const { firstName, lastName, phone, email, address } = body;

    if (!firstName?.trim() || !lastName?.trim() || !phone?.trim()) {
      return NextResponse.json({ error: "First name, last name, and phone are required" }, { status: 400 });
    }

    // Check duplicate by phone
    const existing = await db.client.findFirst({
      where: { phone: phone.trim() },
      select: { id: true },
    });
    if (existing) {
      return NextResponse.json({ error: "A client with this phone number already exists" }, { status: 409 });
    }

    const welcomeToken = randomUUID();

    // Create client + user in transaction
    const result = await db.$transaction(async (tx: any) => {
      const client = await tx.client.create({
        data: {
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          phone: phone.trim(),
          email: email?.trim() || null,
          address: address?.trim() || null,
        },
      });

      await tx.user.create({
        data: {
          name: `${firstName.trim()} ${lastName.trim()}`,
          email: email?.trim() || `client-${client.id}@snout.local`,
          role: "client",
          clientId: client.id,
          passwordHash: null,
          welcomeToken,
          welcomeTokenExpiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        },
      });

      return client;
    });

    const baseUrl = env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

    return NextResponse.json({
      id: result.id,
      firstName: result.firstName,
      lastName: result.lastName,
      phone: result.phone,
      setupLink: `${baseUrl}/client/setup?token=${welcomeToken}`,
    }, { status: 201 });
  } catch (error: unknown) {
    console.error("[api/clients POST] ERROR:", error);
    const msg = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: "Failed to create client", message: msg }, { status: 500 });
  }
}
