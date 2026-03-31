/**
 * Sitters List Route
 *
 * GET: Proxies to NestJS API or uses Prisma directly
 * POST: Creates a new sitter using Prisma
 */

import { NextRequest, NextResponse } from 'next/server';
import { mintApiJWT } from '@/lib/api/jwt';
import { getScopedDb } from '@/lib/tenancy';
import { getRequestContext } from '@/lib/request-context';
import { requireAnyRole, ForbiddenError } from '@/lib/rbac';
import { parsePage, parsePageSize } from '@/lib/pagination';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL;
const DEFAULT_PAGE_SIZE = 50;
const MAX_PAGE_SIZE = 200;

export async function GET(request: NextRequest) {
  let ctx;
  try {
    ctx = await getRequestContext();
    requireAnyRole(ctx, ['owner', 'admin', 'sitter']);
  } catch (error) {
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    return NextResponse.json(
      { error: 'Unauthorized' },
      {
        status: 401,
        headers: {
          'X-Snout-Api': 'sitters-route-hit',
          'X-Snout-Auth': 'missing-session',
        },
      }
    );
  }

  // Always resolve orgId: context or "default" for single-tenant/staging (no "Organization ID missing" for authenticated owner/admin/sitter)
  const orgId = (ctx.orgId != null && String(ctx.orgId).trim() !== '') ? String(ctx.orgId).trim() : 'default';

  try {
    const db = getScopedDb({ orgId });
    const url = (request as NextRequest).nextUrl ?? new URL(request.url);
    const params = url.searchParams;
    const page = parsePage(params.get('page'), 1);
    const pageSize = parsePageSize(params.get('pageSize'), DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE);
    const statusParam = params.get('status')?.trim().toLowerCase();
    const search = params.get('search')?.trim();
    const activeFilter =
      statusParam === 'active' ? true : statusParam === 'inactive' ? false : null;

  // If API is configured, try to proxy to it
  if (API_BASE_URL) {
    try {
      // Mint API JWT token from session
      // (user and orgId already declared above)
      const apiToken = await mintApiJWT({
        userId: ctx.userId || '',
        orgId,
        role: ctx.role,
        sitterId: ctx.sitterId || null,
      });

      // Map to API endpoint: /api/sitters -> /api/numbers/sitters
      const apiUrl = `${API_BASE_URL}/api/numbers/sitters`;

      const response = await fetch(apiUrl, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiToken}`,
        },
      });

      const contentType = response.headers.get('content-type');
      let responseData: any;

      if (contentType?.includes('application/json')) {
        responseData = await response.json();
      } else {
        responseData = await response.text();
      }

      if (!response.ok) {
        // If API returns error, fall through to Prisma fallback
        throw new Error(`API returned ${response.status}: ${JSON.stringify(responseData)}`);
      }

      // API may return array or { sitters: [...] } - normalize to array
      let sitters: any[] = [];
      if (Array.isArray(responseData)) {
        sitters = responseData;
      } else if (responseData.sitters && Array.isArray(responseData.sitters)) {
        sitters = responseData.sitters;
      }
      if (activeFilter !== null) {
        sitters = sitters.filter((s: any) => Boolean(s.active ?? s.isActive) === activeFilter);
      }
      if (search) {
        const term = search.toLowerCase();
        sitters = sitters.filter((s: any) =>
          String(s.firstName || s.name || '').toLowerCase().includes(term) ||
          String(s.lastName || '').toLowerCase().includes(term) ||
          String(s.email || '').toLowerCase().includes(term) ||
          String(s.phone || '').toLowerCase().includes(term)
        );
      }
      if (ctx.role === 'sitter' && ctx.sitterId) {
        sitters = sitters.filter((s: any) => s.id === ctx.sitterId);
      }

      // If backend API doesn't include assignedNumberId, fetch it from Prisma
      // (user and orgId already declared above)
      const total = sitters.length;
      const paged = sitters.slice((page - 1) * pageSize, page * pageSize);
      const sitterIds = paged.map((s: any) => s.id).filter(Boolean);

      let numberMap = new Map<string, string>();
      if (sitterIds.length > 0) {
        try {
          const assignedNumbers = await (db as any).messageNumber.findMany({
            where: {
              assignedSitterId: { in: sitterIds },
              numberClass: 'sitter',
              status: 'active',
            },
            select: {
              id: true,
              assignedSitterId: true,
            },
          });
          assignedNumbers.forEach((num: any) => {
            if (num.assignedSitterId) {
              numberMap.set(num.assignedSitterId, num.id);
            }
          });
        } catch (error) {
          console.warn('[BFF Proxy] Failed to fetch assigned numbers:', error);
          // Continue without assignedNumberId - not critical
        }
      }

      // Transform to match frontend expectations
      const transformedSitters = paged.map((sitter: any) => ({
        id: sitter.id,
        firstName: sitter.firstName || (sitter.name ? sitter.name.split(' ')[0] : ''),
        lastName: sitter.lastName || (sitter.name ? sitter.name.split(' ').slice(1).join(' ') : ''),
        name: sitter.name || `${sitter.firstName || ''} ${sitter.lastName || ''}`.trim(),
        phone: sitter.phone || null,
        email: sitter.email || null,
        personalPhone: sitter.personalPhone || null,
        isActive: sitter.isActive ?? sitter.active ?? true,
        commissionPercentage: sitter.commissionPercentage || 80.0,
        createdAt: sitter.createdAt,
        updatedAt: sitter.updatedAt,
        currentTier: sitter.currentTier || null,
        assignedNumberId: sitter.assignedNumberId || numberMap.get(sitter.id) || null,
        deletedAt: sitter.deletedAt ?? null,
      }));

      return NextResponse.json(
        {
          items: transformedSitters,
          page,
          pageSize,
          total,
          hasMore: page * pageSize < total,
          sort: { field: 'createdAt', direction: 'desc' },
          filters: {
            status: statusParam ?? null,
            search: search ?? null,
          },
        },
        {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
            'X-Snout-Api': 'sitters-route-hit',
            'X-Snout-Route': 'proxy',
            'X-Snout-OrgId': orgId,
            'X-Snout-Org-Resolved': '1',
          },
        }
      );
    } catch (error: any) {
      console.error('[BFF Proxy] Failed to forward sitters request, falling back to Prisma:', error);
      // Fall through to Prisma fallback
    }
  }

  // Fallback: Use Prisma directly
  try {
    // (user and orgId already declared above)

    const where: Record<string, any> = {
      ...(ctx.role === 'sitter' && ctx.sitterId ? { id: ctx.sitterId } : {}),
    };
    if (activeFilter !== null) where.active = activeFilter;
    if (search) {
      where.OR = [
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { phone: { contains: search, mode: 'insensitive' } },
      ];
    }
    const total = await (db as any).sitter.count({ where });
    // Get sitters for this org with their assigned numbers
    const sitters = await (db as any).sitter.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true,
        firstName: true,
        lastName: true,
        phone: true,
        email: true,
        personalPhone: true,
        active: true,
        commissionPercentage: true,
        createdAt: true,
        updatedAt: true,
        currentTierId: true,
        deletedAt: true,
      },
    }) as any[];

    // Get assigned numbers for all sitters in one query
    const sitterIds = sitters.map(s => s.id);
    const assignedNumbers = await (db as any).messageNumber.findMany({
      where: {
        assignedSitterId: { in: sitterIds },
        numberClass: 'sitter',
        status: 'active',
      },
      select: {
        id: true,
        assignedSitterId: true,
        e164: true,
      },
    });

    // Create a map of sitterId -> numberId
    const numberMap = new Map<string, string>();
    assignedNumbers.forEach((num: any) => {
      if (num.assignedSitterId) {
        numberMap.set(num.assignedSitterId, num.id);
      }
    });

    // Transform sitters to match frontend expectations
    const transformedSitters = sitters.map((sitter) => ({
      id: sitter.id,
      firstName: sitter.firstName || '',
      lastName: sitter.lastName || '',
      name: [sitter.firstName, sitter.lastName].filter(Boolean).join(' ') || 'Unnamed',
      phone: sitter.phone || null,
      email: sitter.email || null,
      personalPhone: sitter.personalPhone || null,
      isActive: sitter.active ?? true,
      commissionPercentage: sitter.commissionPercentage ?? 80.0,
      createdAt: sitter.createdAt,
      updatedAt: sitter.updatedAt,
      currentTierId: sitter.currentTierId || null,
      assignedNumberId: numberMap.get(sitter.id) || null,
      deletedAt: sitter.deletedAt ?? null,
    }));

    return NextResponse.json(
      {
        items: transformedSitters,
        page,
        pageSize,
        total,
        hasMore: page * pageSize < total,
        sort: { field: 'createdAt', direction: 'desc' },
        filters: {
          status: statusParam ?? null,
          search: search ?? null,
        },
      },
      {
        headers: {
          'X-Snout-Api': 'sitters-route-hit',
          'X-Snout-Route': 'prisma-fallback',
          'X-Snout-OrgId': orgId,
          'X-Snout-Org-Resolved': '1',
        },
      }
    );
  } catch (error: any) {
    console.error('[api/sitters] FULL ERROR:', error instanceof Error ? { message: error.message, stack: error.stack?.split('\n').slice(0,5) } : error);
    return NextResponse.json(
      { error: 'Failed to fetch sitters', message: error.message },
      {
        status: 500,
        headers: {
          'X-Snout-Api': 'sitters-route-hit',
          'X-Snout-Route': 'error',
          'X-Snout-OrgId': orgId,
        },
      }
    );
  }
  } catch (error: any) {
    console.error('[api/sitters] FULL ERROR (outer):', error instanceof Error ? { message: error.message, stack: error.stack?.split('\n').slice(0,5) } : error);
    return NextResponse.json(
      { error: 'Failed to fetch sitters', message: error.message },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  let ctx;
  try {
    ctx = await getRequestContext();
    requireAnyRole(ctx, ['owner', 'admin']);
  } catch (error) {
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const normalizeString = (value: unknown): string => {
      if (typeof value === 'string') return value.trim();
      if (typeof value === 'number' || typeof value === 'boolean') return String(value);
      return '';
    };
    const normalizeOptionalString = (value: unknown): string | null => {
      const normalized = normalizeString(value);
      return normalized.length > 0 ? normalized : null;
    };
    const parseBoolean = (value: unknown, defaultValue: boolean): boolean => {
      if (typeof value === 'boolean') return value;
      if (typeof value === 'string') {
        const lowered = value.trim().toLowerCase();
        if (lowered === 'true') return true;
        if (lowered === 'false') return false;
      }
      return defaultValue;
    };
    const parseCommission = (value: unknown): number => {
      if (typeof value === 'number' && Number.isFinite(value)) return value;
      if (typeof value === 'string') {
        const parsed = Number(value.trim());
        if (Number.isFinite(parsed)) return parsed;
      }
      return 80.0;
    };

    const firstName = normalizeString(body?.firstName);
    const lastName = normalizeString(body?.lastName);
    const phone = normalizeString(body?.phone);
    const email = normalizeString(body?.email);
    const isActive = parseBoolean(body?.isActive, true);
    const commissionPercentage = parseCommission(body?.commissionPercentage);
    const personalPhone = normalizeOptionalString(body?.personalPhone);
    const openphonePhone = normalizeOptionalString(body?.openphonePhone);
    const phoneType = normalizeOptionalString(body?.phoneType);

    // Validate required fields
    if (!firstName || !lastName) {
      return NextResponse.json(
        { error: 'Missing required fields: firstName, lastName' },
        { status: 400 }
      );
    }
    if (!Number.isFinite(commissionPercentage) || commissionPercentage < 0 || commissionPercentage > 100) {
      return NextResponse.json(
        { error: 'Invalid commissionPercentage. Must be a number between 0 and 100.' },
        { status: 400 }
      );
    }

    const orgId = ctx.orgId;
    const db = getScopedDb(ctx);

    // Create sitter using current Prisma schema fields.
    const sitter = await db.sitter.create({
      data: {
        firstName,
        lastName,
        phone: phone || '',
        email: email || '',
        active: isActive,
        commissionPercentage,
        personalPhone: personalPhone || null,
        openphonePhone: openphonePhone || null,
        phoneType: phoneType || null,
      },
    });

    // If sitter is active, assign a dedicated masked number (persistent assignment)
    if (isActive === true) {
      try {
        const { assignSitterMaskedNumber } = await import('@/lib/messaging/number-helpers');
        const { getMessagingProvider } = await import('@/lib/messaging/provider-factory');

        const provider = await getMessagingProvider(orgId);
        await assignSitterMaskedNumber(orgId, sitter.id, provider);
      } catch (error: any) {
        // Log but don't fail sitter creation if number assignment fails
        console.warn(`[Sitter Creation] Failed to assign number to new sitter ${sitter.id}:`, error);
      }
    }

    // Return sitter in format expected by frontend
    return NextResponse.json({
      sitter: {
        id: sitter.id,
        firstName: sitter.firstName,
        lastName: sitter.lastName,
        name: `${sitter.firstName} ${sitter.lastName}`.trim(),
        phone: sitter.phone || null,
        email: sitter.email || null,
        personalPhone: sitter.personalPhone || null,
        openphonePhone: sitter.openphonePhone || null,
        phoneType: sitter.phoneType || null,
        isActive: sitter.active,
        commissionPercentage: sitter.commissionPercentage ?? 80.0,
        createdAt: sitter.createdAt,
        updatedAt: sitter.updatedAt,
        currentTier: null,
      }
    }, { status: 201 });
  } catch (error: any) {
    console.error('[Sitters API] Failed to create sitter:', error);
    return NextResponse.json(
      { error: 'Failed to create sitter', message: error.message },
      { status: 500 }
    );
  }
}
