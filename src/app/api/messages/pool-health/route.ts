import { NextResponse } from "next/server";
import { getRequestContext } from "@/lib/request-context";
import { getNumberPoolHealth } from "@/lib/messaging/conversation-service";

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  let ctx;
  try {
    ctx = await getRequestContext();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (ctx.role !== "owner" && ctx.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const health = await getNumberPoolHealth(ctx.orgId);
  return NextResponse.json(health);
}
