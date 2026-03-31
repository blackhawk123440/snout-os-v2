/**
 * GET /api/ops/bookings/[id]/sitter-suggestions
 * AI-ranked sitter suggestions for a booking
 * Returns: ranked sitter list with reasons
 */

import { NextResponse } from 'next/server';
import { getRequestContext } from '@/lib/request-context';
import { requireAnyRole, ForbiddenError } from '@/lib/rbac';
import { getSitterSuggestionsForBooking } from '@/lib/ai';
import { InvariantError, invariantErrorResponse } from '@/lib/invariant';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
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

  const { id: bookingId } = await params;

  try {
    const suggestions = await getSitterSuggestionsForBooking(bookingId, ctx.orgId);
    return NextResponse.json({ suggestions });
  } catch (error: unknown) {
    if (error instanceof InvariantError) {
      return NextResponse.json(invariantErrorResponse(error), { status: error.code });
    }
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: 'Failed to get sitter suggestions', message },
      { status: 500 }
    );
  }
}
