/**
 * Runtime Proof Endpoint
 * 
 * GET /api/ops/runtime-proof
 * 
 * Returns machine-verifiable proof that Phase 6 is deployed and working.
 * Owner-only endpoint.
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { getPublicBookingStagingStatus } from '@/lib/request-context';

interface RouteCheck {
  path: string;
  present: boolean;
  accessible: boolean;
  status?: number;
  error?: string;
}

export async function GET(request: NextRequest) {
  // Require owner authentication
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    );
  }

  // Check if user is owner
  const user = await (prisma as any).user.findUnique({
    where: { id: session.user.id },
    select: { role: true },
  });

  if (user?.role !== 'owner') {
    return NextResponse.json(
      { error: 'Owner access required' },
      { status: 403 }
    );
  }

  const proof: {
    gitSha: string;
    buildTime: string;
    dbConnected: boolean;
    seedProofAvailable: boolean;
    routesPresent: RouteCheck[];
    navigation: { messagingAppearsOnce: boolean; hasDuplicates: boolean };
    auth: {
      userRole: string;
      sessionOk: boolean;
      cookieSecure: boolean;
    };
    publicBookingStaging: {
      enabled: boolean;
      configured: boolean;
      requestHost: string;
      orgId: string | null;
      reason: string | null;
    };
    ok: boolean;
    errors: string[];
  } = {
    gitSha: process.env.NEXT_PUBLIC_GIT_SHA || process.env.GIT_SHA || 'unknown',
    buildTime: process.env.NEXT_PUBLIC_BUILD_TIME || process.env.BUILD_TIME || 'unknown',
    dbConnected: false,
    seedProofAvailable: false,
    routesPresent: [],
    navigation: { messagingAppearsOnce: false, hasDuplicates: false },
    auth: {
      userRole: user?.role || 'unknown',
      sessionOk: !!session,
      cookieSecure: false,
    },
    publicBookingStaging: {
      enabled: false,
      configured: false,
      requestHost: '',
      orgId: null,
      reason: null,
    },
    ok: false,
    errors: [],
  };

  // Check database connection
  try {
    await prisma.$queryRaw`SELECT 1`;
    proof.dbConnected = true;
  } catch (error: any) {
    proof.errors.push(`Database connection failed: ${error.message}`);
  }

  // Check seed endpoint availability
  try {
    // Check if seed endpoint file exists by trying to import it
    const seedRoute = await import('@/app/api/messages/seed-proof/route');
    if (seedRoute && typeof seedRoute.POST === 'function') {
      proof.seedProofAvailable = true;
    }
  } catch (error: any) {
    proof.errors.push(`Seed endpoint not available: ${error.message}`);
  }

  // Check required routes
  const requiredRoutes: Array<{ path: string; method: string; checkFn?: () => Promise<boolean> }> = [
    { path: '/api/messages/seed-proof', method: 'POST' },
    { path: '/api/messages/threads', method: 'GET' },
    { path: '/api/messages/threads/:id/messages', method: 'GET' },
    { path: '/api/routing/threads/:id/history', method: 'GET' },
    { path: '/api/messages/:id/retry', method: 'POST' },
    { path: '/api/numbers/:id/quarantine', method: 'POST' },
    { path: '/api/numbers/:id/release', method: 'POST' },
  ];

  // Check routes by attempting to import them (using file system check would require fs module)
  // Instead, we'll mark routes as present if they can be imported, accessible if they export the method
  const routeChecks: Array<{ path: string; importPath: string; method: string }> = [
    { path: '/api/messages/seed-proof', importPath: '@/app/api/messages/seed-proof/route', method: 'POST' },
    { path: '/api/messages/threads', importPath: '@/app/api/messages/threads/route', method: 'GET' },
    { path: '/api/messages/threads/:id/messages', importPath: '@/app/api/messages/threads/[id]/messages/route', method: 'GET' },
    { path: '/api/routing/threads/:id/history', importPath: '@/app/api/routing/threads/[id]/history/route', method: 'GET' },
    { path: '/api/messages/:id/retry', importPath: '@/app/api/messages/[id]/retry/route', method: 'POST' },
    { path: '/api/numbers/:id/quarantine', importPath: '@/app/api/numbers/[id]/quarantine/route', method: 'POST' },
    { path: '/api/numbers/:id/release', importPath: '@/app/api/numbers/[id]/release/route', method: 'POST' },
  ];

  for (const route of routeChecks) {
    const check: RouteCheck = {
      path: route.path,
      present: false,
      accessible: false,
    };

    try {
      // Dynamic import with error handling
      const routeModule = await import(route.importPath).catch(() => null);
      if (routeModule) {
        const methodUpper = route.method.toUpperCase();
        const hasMethod = routeModule[methodUpper] || routeModule[route.method] || routeModule.default;
        if (hasMethod) {
          check.present = true;
          check.accessible = true;
          check.status = 200;
        } else {
          check.error = `Method ${route.method} not exported`;
          proof.errors.push(`Route ${route.path} exists but ${route.method} method not found`);
        }
      } else {
        check.error = 'Route module not found';
        proof.errors.push(`Route ${route.path} file not found`);
      }
    } catch (importError: any) {
      check.present = false;
      check.error = `Import failed: ${importError.message}`;
      proof.errors.push(`Route ${route.path} check failed: ${importError.message}`);
    }

    proof.routesPresent.push(check);
  }

  // Check navigation (read navigation.ts)
  try {
    const navigation = await import('@/lib/navigation');
    const messagingItems = navigation.navigation.filter(item => 
      item.label.toLowerCase().includes('messaging') || item.href === '/messages'
    );
    proof.navigation.messagingAppearsOnce = messagingItems.length === 1;
    proof.navigation.hasDuplicates = messagingItems.length > 1;
    
    // Check for children that would create duplicates
    const messagingItem = messagingItems[0];
    if (messagingItem?.children && messagingItem.children.length > 0) {
      proof.navigation.hasDuplicates = true;
      proof.errors.push('Messaging has children array - will create duplicate nav items');
    }
  } catch (error: any) {
    proof.errors.push(`Navigation check failed: ${error.message}`);
  }

  // Check auth cookie security
  const cookies = request.headers.get('cookie') || '';
  proof.auth.cookieSecure = cookies.includes('__Secure-') || cookies.includes('Secure');
  const status = getPublicBookingStagingStatus(request.headers.get('host') || '');
  proof.publicBookingStaging = {
    enabled: status.enabled,
    configured: status.configured,
    requestHost: status.requestHost,
    orgId: status.orgId,
    reason: status.reason,
  };

  // Determine overall ok status
  proof.ok = 
    proof.dbConnected &&
    proof.seedProofAvailable &&
    proof.routesPresent.every(r => r.present && r.accessible) &&
    proof.navigation.messagingAppearsOnce &&
    !proof.navigation.hasDuplicates &&
    proof.auth.sessionOk &&
    proof.errors.length === 0;

  return NextResponse.json(proof, {
    status: proof.ok ? 200 : 500,
  });
}
