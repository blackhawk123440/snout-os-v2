/**
 * Public Routes Allowlist (Gate B Phase 1)
 * 
 * Defines which routes must always remain publicly accessible,
 * even when auth protection is enabled.
 */

/**
 * Check if a path matches any public route pattern
 */
export function isPublicRoute(pathname: string): boolean {
  const publicRoutes = [
    // Booking form submission (must remain public)
    "/api/form",
    
    // Stripe webhook (must remain public, but will be validated)
    "/api/webhooks/stripe",
    
    // SMS webhook (must remain public, but will be validated)
    "/api/webhooks/sms",
    
    // Health check (public for monitoring)
    "/api/health",
    
    // Payment return/confirmation pages (must remain public)
    "/tip/", // All tip payment pages
    "/tip/success",
    "/tip/payment",
    "/tip/cancel",
    "/tip/link-builder", // Tip link builder (public)
    "/tip/t/", // Tip redirect route (public)
    "/tip/[amount]/[sitter]", // Dynamic tip routes

    // Tip API endpoints (public — tip pages don't require login)
    "/api/tip/",
    
    // Static booking form (served from public directory)
    "/booking-form.html",
    
    // NextAuth routes (must be public for auth to work)
    "/api/auth/",
    "/login",
    "/forgot-password",
    "/reset-password",
    "/pricing",
    "/privacy",
    "/terms",

    // E2E test auth - route is public so setup can call it; the route itself
    // returns 403 in production (NODE_ENV check) and requires x-e2e-key
    "/api/ops/e2e-login",

    // Sitter onboarding (accessed via invite link, no auth yet)
    "/sitter/onboard",
    "/api/sitter/onboard/",

    // Client self-setup (accessed via welcome link, no auth yet)
    "/client/setup",
    "/api/client/setup/",

    // Messaging webhooks (public, validated by provider signatures)
    "/api/messages/webhook/",

    // Cron routes (public at middleware, validated by INTERNAL_API_KEY in-route)
    "/api/cron/",

    // Offers expiration (cron-like, validated in-route)
    "/api/offers/",
  ];

  // Exact match
  if (publicRoutes.includes(pathname)) {
    return true;
  }

  // Prefix match for paths that start with these patterns
  for (const route of publicRoutes) {
    if (pathname.startsWith(route)) {
      return true;
    }
  }

  // NextAuth routes pattern (CRITICAL - must be public)
  if (pathname.startsWith("/api/auth/")) {
    return true;
  }
  
  // Login page must be public
  if (pathname === "/login") {
    return true;
  }

  return false;
}

