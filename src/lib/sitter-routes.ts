/**
 * Sitter Routes (Phase 5.1)
 * 
 * Defines which routes are accessible to sitters when ENABLE_SITTER_AUTH is true.
 * Per Master Spec 7.1: Sitters can see only their assigned bookings and limited client data.
 */

/**
 * Check if a path is a sitter route
 * Sitter routes are accessible to authenticated sitters
 */
export function isSitterRoute(pathname: string): boolean {
  // Sitter dashboard
  if (pathname === "/sitter" || pathname.startsWith("/sitter/")) {
    return true;
  }

  // Sitter API routes (scoped to their own data)
  if (pathname.startsWith("/api/sitter/")) {
    return true;
  }

  // Sitter dashboard API (if different from /sitter/)
  if (pathname.startsWith("/api/sitters/") && pathname.includes("/dashboard")) {
    return true;
  }

  // Reports API (sitters can submit reports for their bookings)
  // Per Master Spec 7.1.3: Sitter messaging is allowed only in contexts tied to assignments
  if (pathname === "/api/reports" || pathname.startsWith("/api/reports/")) {
    return true;
  }

  // Sitter earnings API (Phase 5.3)
  if (pathname.startsWith("/api/sitter/") && pathname.includes("/earnings")) {
    return true;
  }

  return false;
}

/**
 * Check if a path is restricted from sitters
 * Per Master Spec 7.1.2: Sitters cannot see payments, pricing settings, 
 * global automation settings, or other sitters data
 */
export function isSitterRestrictedRoute(pathname: string): boolean {
  // Owner-only operational pages
  if (pathname.startsWith('/setup')) return true;
  if (pathname.startsWith('/twilio-setup')) return true;
  if (pathname.startsWith('/messaging')) return true;
  if (pathname.startsWith('/numbers')) return true;
  if (pathname.startsWith('/assignments')) return true;
  if (pathname.startsWith('/messages')) return true; // Sitters must use /sitter/inbox
  if (pathname.startsWith('/calendar')) return true;
  if (pathname.startsWith('/clients')) return true;
  if (pathname.startsWith('/sitters')) return true;
  if (pathname.startsWith('/reports')) return true;
  if (pathname.startsWith('/growth')) return true;
  if (pathname.startsWith('/payroll')) return true;
  if (pathname.startsWith('/integrations')) return true;
  if (pathname.startsWith('/templates')) return true;
  if (pathname.startsWith('/automation')) return true;
  if (pathname === '/' || pathname === '') return true; // Root dashboard is owner-only
  if (pathname.startsWith('/owner-dashboard')) return true; // Owner dashboard
  if (pathname.startsWith('/command-center')) return true; // Owner command center
  // Payment admin routes
  if (pathname.startsWith("/api/payments")) {
    return true;
  }

  // Settings routes (global settings)
  if (pathname.startsWith("/api/settings")) {
    return true;
  }

  // Automation settings
  if (pathname.startsWith("/api/automations") && !pathname.includes("/ledger")) {
    // Allow ledger (read-only) but not settings
    return true;
  }

  // Pricing settings
  if (pathname.startsWith("/api/pricing-rules")) {
    return true;
  }

  if (pathname.startsWith("/api/service-configs")) {
    return true;
  }

  // Other sitters' data (admin routes that list all sitters)
  if (pathname === "/api/sitters" || pathname === "/api/sitters/") {
    return true;
  }

  // Owner messaging API routes (sitters use /api/sitter/threads)
  if (pathname.startsWith("/api/messages/threads")) {
    return true;
  }
  if (pathname.startsWith("/api/messages/send")) {
    return true;
  }
  if (pathname.startsWith("/api/messages/") && pathname.includes("/retry")) {
    return true;
  }
  if (pathname.startsWith("/api/routing/")) {
    return true;
  }

  // Admin-only pages
  if (pathname.startsWith("/settings")) {
    return true;
  }

  if (pathname.startsWith("/payments")) {
    return true;
  }

  if (pathname.startsWith("/bookings") && !pathname.startsWith("/sitter")) {
    return true;
  }

  // Ops pages (owner/admin only)
  if (pathname.startsWith("/ops")) {
    return true;
  }

  // Ops API routes
  if (pathname.startsWith("/api/ops")) {
    return true;
  }

  return false;
}

