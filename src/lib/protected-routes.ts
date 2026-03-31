/**
 * Protected Routes Matcher (Gate B Phase 2.1)
 * 
 * Defines which routes require authentication when ENABLE_AUTH_PROTECTION is true.
 * Only owner/admin surfaces are protected. Booking forms, webhooks, and health remain public.
 */

/**
 * Check if a path matches any protected route pattern
 */
export function isProtectedRoute(pathname: string): boolean {
  // Settings pages (all settings are admin-only)
  if (pathname.startsWith("/settings")) {
    return true;
  }

  // Automation pages
  if (pathname.startsWith("/automation")) {
    return true;
  }
  if (pathname.startsWith("/automation-center")) {
    return true;
  }

  // Payment/admin pages
  if (pathname.startsWith("/payments")) {
    return true;
  }
  if (pathname.startsWith("/payroll")) {
    return true;
  }
  if (pathname.startsWith("/finance")) {
    return true;
  }

  // Owner dashboard pages
  if (pathname.startsWith("/dashboard")) {
    return true;
  }
  if (pathname.startsWith("/reports")) {
    return true;
  }
  if (pathname.startsWith("/growth")) {
    return true;
  }
  if (pathname.startsWith("/sitters")) {
    return true;
  }
  if (pathname.startsWith("/numbers")) {
    return true;
  }
  if (pathname.startsWith("/assignments")) {
    return true;
  }
  if (pathname.startsWith("/twilio-setup")) {
    return true;
  }
  if (pathname.startsWith("/messaging")) {
    return true;
  }

      // Booking management pages (admin views, not the public form)
      if (pathname.startsWith("/bookings")) {
        return true;
      }

      // Exceptions page (Phase 6.3)
      if (pathname.startsWith("/exceptions")) {
        return true;
      }

  // Calendar pages
  if (pathname.startsWith("/calendar")) {
    return true;
  }

  // Client management pages
  if (pathname.startsWith("/clients")) {
    return true;
  }

  // Templates pages
  if (pathname.startsWith("/templates")) {
    return true;
  }

  // Integrations pages
  if (pathname.startsWith("/integrations")) {
    return true;
  }

  // Messages pages
  if (pathname.startsWith("/messages")) {
    return true;
  }
  if (pathname.startsWith("/messaging")) {
    return true;
  }
  if (pathname.startsWith("/numbers")) {
    return true;
  }
  if (pathname.startsWith("/assignments")) {
    return true;
  }
  if (pathname.startsWith("/twilio-setup")) {
    return true;
  }
  if (pathname.startsWith("/growth")) {
    return true;
  }
  if (pathname.startsWith("/reports")) {
    return true;
  }
  if (pathname.startsWith("/sitters")) {
    return true;
  }
  if (pathname.startsWith("/payroll")) {
    return true;
  }
  if (pathname.startsWith("/dashboard")) {
    return true;
  }

  // Admin API routes - Automations
  if (pathname.startsWith("/api/automations")) {
    return true;
  }

  // Admin API routes - Clients
  if (pathname.startsWith("/api/clients")) {
    return true;
  }

  // Admin API routes - Sitters
  if (pathname.startsWith("/api/sitters")) {
    return true;
  }

  // Admin API routes - Bookings (admin endpoints, not form submission)
  if (pathname.startsWith("/api/bookings")) {
    return true;
  }

  // Admin API routes - Settings
  if (pathname.startsWith("/api/settings")) {
    return true;
  }

  // Admin API routes - Pricing
  if (pathname.startsWith("/api/pricing-rules")) {
    return true;
  }
  if (pathname.startsWith("/api/service-configs")) {
    return true;
  }

  // Admin API routes - Discounts
  if (pathname.startsWith("/api/discounts")) {
    return true;
  }

  // Admin API routes - Stripe admin
  if (pathname.startsWith("/api/stripe")) {
    return true;
  }

  // Admin API routes - Payments admin
  if (pathname.startsWith("/api/payments")) {
    return true;
  }

      // Admin API routes - Reports
      if (pathname === "/api/reports" || pathname.startsWith("/api/reports/")) {
        return true;
      }

      // Admin API routes - Exceptions (Phase 6.3)
      if (pathname.startsWith("/api/exceptions")) {
        return true;
      }

  // Admin API routes - Integrations management
  if (pathname.startsWith("/api/integrations")) {
    return true;
  }

  // Admin API routes - Upload
  if (pathname.startsWith("/api/upload")) {
    return true;
  }

  // Admin API routes - Templates
  if (pathname.startsWith("/api/templates")) {
    return true;
  }

  // Admin API routes - Message templates
  if (pathname.startsWith("/api/message-templates")) {
    return true;
  }

  // Admin API routes - Custom fields
  if (pathname.startsWith("/api/custom-fields")) {
    return true;
  }

  // Admin API routes - Sitter tiers
  if (pathname.startsWith("/api/sitter-tiers")) {
    return true;
  }

  // Admin API routes - Booking tags
  if (pathname.startsWith("/api/booking-tags")) {
    return true;
  }

  // Admin API routes - Booking pipeline
  if (pathname.startsWith("/api/booking-pipeline")) {
    return true;
  }

  // Admin API routes - Roles
  if (pathname.startsWith("/api/roles")) {
    return true;
  }

  // Admin API routes - Service point weights
  if (pathname.startsWith("/api/service-point-weights")) {
    return true;
  }

  // Admin API routes - Business settings
  if (pathname.startsWith("/api/business-settings")) {
    return true;
  }

  // Admin API routes - Form fields (admin management)
  if (pathname.startsWith("/api/form-fields")) {
    return true;
  }

  // Import page and API (owner-only)
  if (pathname.startsWith("/import")) {
    return true;
  }
  if (pathname.startsWith("/api/ops/import")) {
    return true;
  }

  // Sitter pool (admin management)
  if (pathname.startsWith("/api/sitter-pool")) {
    return true;
  }

  // Client portal pages and API routes (protected for clients)
  if (pathname.startsWith("/client")) {
    return true;
  }
  if (pathname.startsWith("/api/client")) {
    return true;
  }

  // Dispatch routes (owner-only operations)
  if (pathname.startsWith("/api/dispatch")) {
    return true;
  }

  // Push notification routes (user-specific)
  if (pathname.startsWith("/api/push")) {
    return true;
  }

  // Realtime SSE streams (authenticated)
  if (pathname.startsWith("/api/realtime")) {
    return true;
  }

  // Setup routes (owner-only provider management)
  if (pathname.startsWith("/api/setup")) {
    return true;
  }

  // Messaging routes (authenticated; webhooks handled as public above)
  if (pathname.startsWith("/api/messages")) {
    return true;
  }

  // Number management routes (owner-only)
  if (pathname.startsWith("/api/numbers")) {
    return true;
  }

  // Analytics routes (owner/admin)
  if (pathname.startsWith("/api/analytics")) {
    return true;
  }

  // Sitter portal API routes (sitter-authenticated)
  if (pathname.startsWith("/api/sitter")) {
    return true;
  }

  // Payroll routes (owner/admin)
  if (pathname.startsWith("/api/payroll")) {
    return true;
  }

  // Assignment routes (owner/admin)
  if (pathname.startsWith("/api/assignments")) {
    return true;
  }

  // Routing history (authenticated)
  if (pathname.startsWith("/api/routing")) {
    return true;
  }

  // Zone detection (authenticated)
  if (pathname.startsWith("/api/zones")) {
    return true;
  }

  // Waitlist routes (owner/admin)
  if (pathname.startsWith("/api/waitlist")) {
    return true;
  }

  // Onboarding status (authenticated)
  if (pathname.startsWith("/api/onboarding")) {
    return true;
  }

  // Twilio-specific routes (authenticated)
  if (pathname.startsWith("/api/twilio")) {
    return true;
  }

  // Root dashboard page (admin)
  if (pathname === "/") {
    return true;
  }

  // Owner dashboard (alias for main dashboard)
  if (pathname.startsWith("/owner-dashboard")) {
    return true;
  }

  // Ops/metrics and forecast APIs (owner-only)
  if (pathname.startsWith("/api/ops/metrics")) {
    return true;
  }
  if (pathname.startsWith("/api/ops/forecast")) {
    return true;
  }
  if (pathname.startsWith("/api/ops/bookings")) {
    return true;
  }

  // Ops pages (owner-only: proof, automation-failures, etc.)
  if (pathname.startsWith("/ops")) {
    return true;
  }

  // Ops API routes (owner/admin only)
  if (pathname.startsWith("/api/ops")) {
    return true;
  }

  return false;
}

