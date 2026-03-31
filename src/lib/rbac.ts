import type { AppRole, RequestContext } from "@/lib/request-context";

export class ForbiddenError extends Error {
  constructor(message = "Forbidden") {
    super(message);
    this.name = "ForbiddenError";
  }
}

/**
 * Require clientId on session for client portal endpoints.
 * Throws ForbiddenError (403) if ctx.clientId is missing.
 * Use after requireRole(ctx, 'client').
 */
export function requireClientContext(ctx: RequestContext): asserts ctx is RequestContext & { clientId: string } {
  if (!ctx.clientId) {
    throw new ForbiddenError("Client profile missing on session");
  }
}

export function requireRole(ctx: RequestContext, role: AppRole): void {
  if (ctx.role !== role) {
    throw new ForbiddenError();
  }
}

export function requireAnyRole(ctx: RequestContext, roles: AppRole[]): void {
  if (!roles.includes(ctx.role)) {
    throw new ForbiddenError();
  }
}

/** Require owner or admin. Use for /ops and admin-only routes. */
export function requireOwnerOrAdmin(ctx: RequestContext): void {
  requireAnyRole(ctx, ["owner", "admin"]);
}

/** Require superadmin. Use for /admin/* platform management routes. */
export function requireSuperAdmin(ctx: RequestContext): void {
  requireAnyRole(ctx, ["superadmin"]);
}

/**
 * Assert entity belongs to user's org. Reject if not.
 * Use when loading entities to prevent cross-org leaks.
 */
export function assertOrgAccess(entityOrgId: string | null | undefined, ctxOrgId: string): void {
  if (!entityOrgId || entityOrgId !== ctxOrgId) {
    throw new ForbiddenError("Access denied: organization mismatch");
  }
}
