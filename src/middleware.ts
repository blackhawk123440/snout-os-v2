/**
 * Middleware (Gate B Phase 2.1)
 * 
 * Authentication middleware. Enforces authentication on protected routes
 * when ENABLE_AUTH_PROTECTION feature flag is set to true.
 */

import { NextRequest, NextResponse } from "next/server";
import { isPublicRoute } from "@/lib/public-routes";
import { isProtectedRoute } from "@/lib/protected-routes";
import { isSitterRoute, isSitterRestrictedRoute } from "@/lib/sitter-routes";
import { isClientRoute } from "@/lib/client-routes";
import { env } from "@/lib/env";
import { getSessionSafe } from "@/lib/auth-helpers";
import { checkRateLimit } from "@/lib/rate-limit";

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  // Phase 2: Role separation enforcement - ALWAYS ENABLED for production
  // Feature flags can disable for development, but default to enabled
  const enableAuthProtection = env.ENABLE_AUTH_PROTECTION !== false; // Default true unless explicitly false
  const enableSitterAuth = env.ENABLE_SITTER_AUTH !== false; // Default true unless explicitly false
  const enablePermissionChecks = env.ENABLE_PERMISSION_CHECKS !== false; // Default true unless explicitly false

  // Get session to check role
  const session = await getSessionSafe();

  // Public routes bypass ALL auth/role checks — must run first.
  // Sitter onboard and client setup are accessed via invite link before login.
  if (isPublicRoute(pathname)) {
    return NextResponse.next();
  }

  // Keep general authenticated API traffic on its own limiter class so /api/auth/session
  // burst traffic doesn't collapse regular app requests.
  if (pathname.startsWith("/api/") && !pathname.startsWith("/api/auth/") && session?.user) {
    const user = session.user as Record<string, unknown>;
    const userId = typeof user.id === "string" ? user.id : "unknown";
    const orgId = typeof user.orgId === "string" ? user.orgId : "default";
    const rl = await checkRateLimit(`${orgId}:${userId}`, {
      keyPrefix: "auth-traffic",
      limit: Number(process.env.AUTH_TRAFFIC_LIMIT_PER_MINUTE || "1800"),
      windowSec: 60,
    });
    if (!rl.success) {
      return NextResponse.json(
        { error: "Too many requests", retryAfter: rl.retryAfter },
        { status: 429, headers: { "Retry-After": String(rl.retryAfter ?? 60) } }
      );
    }
  }

  // Client role: redirect owner/sitter routes to client portal
  const isClient = session?.user && (
    (session.user as any).clientId ||
    (session.user as any).role === 'client'
  );
  if (isClient && !pathname.startsWith('/api/')) {
    if (pathname.startsWith('/finance')) {
      return new NextResponse('Forbidden', { status: 403 });
    }
    if (isClientRoute(pathname)) {
      return NextResponse.next();
    }
    // Client trying to access non-client route -> redirect to client home or client booking flow
    if (pathname === '/bookings/new') {
      return NextResponse.redirect(new URL('/client/bookings/new', request.url));
    }
    if (pathname.startsWith('/bookings')) {
      return NextResponse.redirect(new URL('/client/bookings', request.url));
    }
    if (pathname.startsWith('/sitter') || pathname.startsWith('/dashboard') || pathname.startsWith('/owner-dashboard') ||
        pathname.startsWith('/command-center') || pathname.startsWith('/calendar') ||
        pathname.startsWith('/clients') || pathname.startsWith('/sitters') || pathname.startsWith('/messaging') ||
        pathname.startsWith('/messages') || pathname.startsWith('/numbers') || pathname.startsWith('/assignments') ||
        pathname.startsWith('/twilio-setup') || pathname.startsWith('/reports') || pathname.startsWith('/growth') ||
        pathname.startsWith('/payroll') || pathname.startsWith('/money') || pathname.startsWith('/settings') || pathname.startsWith('/integrations') ||
        pathname.startsWith('/ops') || pathname === '/' || pathname === '') {
      return NextResponse.redirect(new URL('/client/home', request.url));
    }
  }

  // Phase 5.1: If sitter auth is enabled, check sitter restrictions first
  if (enableSitterAuth) {
    // Check if user is a sitter (has sitterId in session or role === 'sitter')
    const isSitter = session?.user && (
      (session.user as any).sitterId || 
      (session.user as any).role === 'sitter'
    );
    
    // If user is authenticated as a sitter, enforce sitter restrictions
    if (isSitter) {
      if (!pathname.startsWith('/api/') && (pathname.startsWith('/finance') || pathname.startsWith('/money'))) {
        return new NextResponse('Forbidden', { status: 403 });
      }
      // Per Master Spec 7.1.2: Sitters cannot access restricted routes
      if (isSitterRestrictedRoute(pathname)) {
        // Redirect /messages to /sitter/inbox (UI route)
        if (pathname.startsWith('/messages')) {
          return NextResponse.redirect(new URL('/sitter/inbox', request.url));
        }
        // Page routes: redirect to sitter today (avoids 403 on HTML, better UX)
        if (!pathname.startsWith('/api/')) {
          return NextResponse.redirect(new URL('/sitter/dashboard', request.url));
        }
        return NextResponse.json(
          { error: "Access denied: This route is not available to sitters" },
          { status: 403 }
        );
      }
      
      // Allow sitter routes to proceed (they will be checked in API routes)
      if (isSitterRoute(pathname)) {
        return NextResponse.next();
      }
    }
  }

  // If auth protection is disabled, allow all requests (current behavior)
  if (!enableAuthProtection) {
    return NextResponse.next();
  }

  // Check if route is protected (public routes already handled above)
  if (isProtectedRoute(pathname)) {
    if (!session) {
      if (pathname.startsWith('/api/')) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
      // No session - redirect to login
      const loginUrl = new URL("/login", request.url);
      loginUrl.searchParams.set("callbackUrl", pathname);
      return NextResponse.redirect(loginUrl);
    }
    
    // Session exists - allow request to proceed
    return NextResponse.next();
  }

  // Route is neither public nor protected — only static assets and unknown paths reach here.
  // All /api/ routes MUST be registered in isPublicRoute() or isProtectedRoute().
  if (pathname.startsWith("/api/")) {
    // Unregistered API route — deny by default for defense-in-depth
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }
  return NextResponse.next();
}

export const config = {
  matcher: [
    // Match all request paths except for the ones starting with:
    // - _next/static (static files)
    // - _next/image (image optimization files)
    // - favicon.ico (favicon file)
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
