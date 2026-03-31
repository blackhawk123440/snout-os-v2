import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { checkRateLimit } from "@/lib/rate-limit";
import { getPublicOrgContext } from "@/lib/request-context";

const INFO_RATE_LIMIT = {
  keyPrefix: "tip-info",
  limit: 30,
  windowSec: 60, // 30 lookups per minute per IP
};

/**
 * GET /api/tip/sitter-info?sitter_id=<alias-or-id>
 * Returns sitter display name for the tip page.
 * Public endpoint — tip pages are client-facing without login.
 */
export async function GET(request: NextRequest) {
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const rl = await checkRateLimit(ip, INFO_RATE_LIMIT);
  if (!rl.success) {
    return NextResponse.json(
      { name: null },
      { status: 429, headers: { "Retry-After": String(rl.retryAfter ?? 60) } }
    );
  }

  const sitterId = request.nextUrl.searchParams.get("sitter_id");

  if (!sitterId) {
    return NextResponse.json({ name: null });
  }

  try {
    const { orgId } = getPublicOrgContext(request);

    // Try direct lookup by sitter ID — scoped to org
    const sitter = await prisma.sitter.findFirst({
      where: { id: sitterId, orgId },
      select: { firstName: true, lastName: true },
    });

    if (sitter) {
      const name = [sitter.firstName, sitter.lastName].filter(Boolean).join(" ").trim();
      return NextResponse.json({ name: name || null });
    }

    // Try lookup by name alias (e.g., "john-smith") — scoped to org
    const nameParts = sitterId.split("-");
    if (nameParts.length >= 2) {
      const sitters = await prisma.sitter.findMany({
        where: { orgId },
        select: { firstName: true, lastName: true },
      });
      const match = sitters.find((s) => {
        const fullName = [s.firstName, s.lastName]
          .filter(Boolean)
          .join("-")
          .toLowerCase();
        return fullName === sitterId.toLowerCase();
      });
      if (match) {
        const name = [match.firstName, match.lastName].filter(Boolean).join(" ").trim();
        return NextResponse.json({ name: name || null });
      }
    }

    return NextResponse.json({ name: null });
  } catch (error) {
    console.error("[tip/sitter-info] Error:", error);
    return NextResponse.json({ name: null });
  }
}
