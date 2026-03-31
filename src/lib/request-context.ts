import { auth } from "@/lib/auth";
import { env } from "@/lib/env";
import { prisma } from "@/lib/db";
import { resolveCorrelationId } from "@/lib/correlation-id";

export type AppRole = "owner" | "admin" | "sitter" | "client" | "superadmin" | "public";

export interface RequestContext {
  orgId: string;
  role: AppRole;
  userId: string | null;
  sitterId: string | null;
  clientId: string | null;
  correlationId?: string;
}

const normalizeRole = (role: unknown): AppRole => {
  const value = String(role || "").toLowerCase();
  if (value === "owner" || value === "admin" || value === "sitter" || value === "client" || value === "superadmin") {
    return value;
  }
  return "public";
};

const getLockedOrgId = () => env.PERSONAL_ORG_ID || "default";

export const isPersonalMode = () => env.NEXT_PUBLIC_PERSONAL_MODE === true;

export async function getRequestContext(request?: Request): Promise<RequestContext> {
  const session = await auth();
  if (!session?.user) {
    throw new Error("Unauthorized");
  }

  const userId = typeof (session.user as Record<string, unknown>).id === "string"
    ? (session.user as Record<string, unknown>).id as string
    : null;

  let dbUser: { deletedAt: Date | null; role: string | null; orgId: string | null } | null = null;
  if (userId) {
    dbUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { deletedAt: true, role: true, orgId: true },
    });
    if (dbUser?.deletedAt) {
      throw new Error("Account has been deleted");
    }
  }

  const user = session.user as Record<string, unknown>;
  let role = normalizeRole(user.role);
  const sitterId = typeof user.sitterId === "string" ? user.sitterId : null;
  const clientId = typeof user.clientId === "string" ? user.clientId : null;
  // Staging/legacy: resolve role from DB when session has no role so owner/admin always get access
  if (role === "public" && dbUser?.role) {
    const dbRole = normalizeRole(dbUser.role);
    if (dbRole === "owner" || dbRole === "admin") role = dbRole;
  }
  // Users without an explicit role remain "public" — never auto-promote to owner
  if (role === "public" && userId) {
    throw new Error("Unauthorized: user role not assigned");
  }

  const correlationId = resolveCorrelationId(request);

  if (isPersonalMode()) {
    return {
      orgId: getLockedOrgId(),
      role,
      userId,
      sitterId,
      clientId,
      correlationId,
    };
  }

  let orgId = typeof user.orgId === "string" ? user.orgId.trim() : "";
  if (!orgId && dbUser?.orgId && String(dbUser.orgId).trim()) orgId = String(dbUser.orgId).trim();
  if (!orgId) orgId = "default";

  return {
    orgId,
    role,
    userId,
    sitterId,
    clientId,
    correlationId,
  };
}

export function getPublicOrgContext(requestOrHost?: Request | string): RequestContext {
  if (!isPersonalMode()) {
    throw new Error("Public booking is disabled in SaaS mode until org binding is configured");
  }
  const request = typeof requestOrHost === "string" ? undefined : requestOrHost;

  return {
    orgId: getLockedOrgId(),
    role: "public",
    userId: null,
    sitterId: null,
    clientId: null,
    correlationId: resolveCorrelationId(request),
  };
}

export interface PublicBookingStagingStatus {
  runtime: string;
  enabled: boolean;
  configured: boolean;
  requestHost: string;
  orgId: string | null;
  reason: string | null;
}

export function getPublicBookingStagingStatus(requestHost?: string): PublicBookingStagingStatus {
  const runtime = process.env.RUNTIME_ENV_NAME || "development";
  const enabled = runtime === "staging" && process.env.ENABLE_PUBLIC_BOOKING_STAGING === "true";
  const requestHostLower = String(requestHost || "").toLowerCase();
  const bindings = String(process.env.PUBLIC_BOOKING_STAGING_ORG_BINDINGS || "")
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => {
      const [host, orgId] = entry.split("=").map((part) => part.trim());
      return { host: host?.toLowerCase(), orgId: orgId || null };
    })
    .filter((entry) => !!entry.host && !!entry.orgId);
  const binding = bindings.find((entry) => entry.host === requestHostLower);
  if (!enabled) {
    return { runtime, enabled: false, configured: bindings.length > 0, requestHost: requestHostLower, orgId: null, reason: "ENABLE_PUBLIC_BOOKING_STAGING must be true in staging" };
  }
  if (bindings.length === 0) {
    return { runtime, enabled: true, configured: false, requestHost: requestHostLower, orgId: null, reason: "PUBLIC_BOOKING_STAGING_ORG_BINDINGS is empty" };
  }
  if (!binding?.orgId) {
    return { runtime, enabled: true, configured: false, requestHost: requestHostLower, orgId: null, reason: "request host is not bound to a staging org" };
  }
  return { runtime, enabled: true, configured: true, requestHost: requestHostLower, orgId: binding.orgId, reason: null };
}
