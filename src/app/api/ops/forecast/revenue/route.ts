/**
 * GET /api/ops/forecast/revenue?range=90d
 * Revenue forecast with AI commentary
 */

import { NextRequest, NextResponse } from 'next/server';
import { getRequestContext } from '@/lib/request-context';
import { requireAnyRole, ForbiddenError } from '@/lib/rbac';
import { getRevenueForecast } from '@/lib/ai';
import { InvariantError, invariantErrorResponse } from '@/lib/invariant';

export async function GET(request: NextRequest) {
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

  const range = request.nextUrl.searchParams.get('range') || '90d';
  const includeAi = request.nextUrl.searchParams.get('ai') === 'true';
  const match = range.match(/^(\d+)d$/);
  const rangeDays = match ? Math.min(365, Math.max(7, parseInt(match[1], 10))) : 90;

  try {
    const result = await getRevenueForecast(ctx.orgId, rangeDays, includeAi);
    return NextResponse.json(result);
  } catch (error: unknown) {
    if (error instanceof InvariantError) {
      return NextResponse.json(invariantErrorResponse(error), { status: error.code });
    }
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: 'Failed to load forecast', message },
      { status: 500 }
    );
  }
}
