/**
 * GET  /api/ops/keys - List all clients with their key / lockbox info
 * POST /api/ops/keys - Update key record for a client
 */

import { NextRequest, NextResponse } from "next/server";
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

    const clients = await db.client.findMany({
      where: {},
      select: {
        id: true,
        firstName: true,
        lastName: true,
        keyStatus: true,
        keyHolder: true,
        keyLocation: true,
        lockboxCode: true,
        doorAlarmCode: true,
        keyNotes: true,
        keyGivenAt: true,
        keyReturnedAt: true,
      },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    });

    const toIso = (d: Date | null | undefined) =>
      d instanceof Date ? d.toISOString() : d ?? null;

    // Owner/admin get full access including lockbox & alarm codes
    const keys = clients.map((c: any) => ({
      clientId: c.id,
      clientName: [c.firstName, c.lastName].filter(Boolean).join(" ").trim() || "Client",
      keyStatus: c.keyStatus || "none",
      keyHolder: c.keyHolder || null,
      keyLocation: c.keyLocation || null,
      lockboxCode: c.lockboxCode || null,
      doorAlarmCode: c.doorAlarmCode || null,
      keyNotes: c.keyNotes || null,
      keyGivenAt: toIso(c.keyGivenAt),
      keyReturnedAt: toIso(c.keyReturnedAt),
    }));

    return NextResponse.json({ keys });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: "Failed to load key records", message },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
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

  let body: {
    clientId?: string;
    keyStatus?: string;
    keyHolder?: string;
    keyNotes?: string;
    keyLocation?: string;
    lockboxCode?: string;
    doorAlarmCode?: string;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const clientId = typeof body.clientId === "string" ? body.clientId.trim() : "";
  if (!clientId) {
    return NextResponse.json(
      { error: "Missing required field: clientId" },
      { status: 400 }
    );
  }

  try {
    const db = getScopedDb(ctx);

    // Verify the client exists within the org
    const client = await db.client.findFirst({
      where: { id: clientId },
      select: { id: true },
    });
    if (!client) {
      return NextResponse.json(
        { error: "Client not found" },
        { status: 404 }
      );
    }

    const data: Record<string, unknown> = {};

    if (typeof body.keyStatus === "string") {
      const allowed = ["none", "with_client", "with_sitter", "with_owner", "lockbox"];
      if (!allowed.includes(body.keyStatus)) {
        return NextResponse.json(
          { error: `Invalid keyStatus. Allowed: ${allowed.join(", ")}` },
          { status: 400 }
        );
      }
      data.keyStatus = body.keyStatus;

      // Auto-set timestamps based on status transitions
      if (body.keyStatus === "with_sitter" || body.keyStatus === "with_owner") {
        data.keyGivenAt = new Date();
        data.keyReturnedAt = null;
      } else if (body.keyStatus === "with_client" || body.keyStatus === "none") {
        data.keyReturnedAt = new Date();
      }
    }

    if (typeof body.keyHolder === "string") data.keyHolder = body.keyHolder.trim() || null;
    if (typeof body.keyNotes === "string") data.keyNotes = body.keyNotes.trim() || null;
    if (typeof body.keyLocation === "string") data.keyLocation = body.keyLocation.trim() || null;
    if (typeof body.lockboxCode === "string") data.lockboxCode = body.lockboxCode.trim() || null;
    if (typeof body.doorAlarmCode === "string") data.doorAlarmCode = body.doorAlarmCode.trim() || null;

    if (Object.keys(data).length === 0) {
      return NextResponse.json(
        { error: "No fields to update" },
        { status: 400 }
      );
    }

    const updated = await db.client.update({
      where: { id: clientId },
      data,
      select: {
        id: true,
        firstName: true,
        lastName: true,
        keyStatus: true,
        keyHolder: true,
        keyLocation: true,
        lockboxCode: true,
        doorAlarmCode: true,
        keyNotes: true,
        keyGivenAt: true,
        keyReturnedAt: true,
      },
    });

    const toIso = (d: Date | null | undefined) =>
      d instanceof Date ? d.toISOString() : d ?? null;

    return NextResponse.json({
      success: true,
      key: {
        clientId: updated.id,
        clientName: [updated.firstName, updated.lastName].filter(Boolean).join(" ").trim() || "Client",
        keyStatus: updated.keyStatus || "none",
        keyHolder: updated.keyHolder || null,
        keyLocation: updated.keyLocation || null,
        lockboxCode: updated.lockboxCode || null,
        doorAlarmCode: updated.doorAlarmCode || null,
        keyNotes: updated.keyNotes || null,
        keyGivenAt: toIso(updated.keyGivenAt),
        keyReturnedAt: toIso(updated.keyReturnedAt),
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: "Failed to update key record", message },
      { status: 500 }
    );
  }
}
