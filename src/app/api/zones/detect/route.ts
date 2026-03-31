/**
 * GET /api/zones/detect?lat=X&lng=Y
 *
 * Detects which service zones a location falls within
 * and returns filtered sitter IDs for that zone.
 * Used during booking creation to filter the sitter dropdown.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getRequestContext } from '@/lib/request-context';
import { filterSittersByZone } from '@/lib/zones/point-in-polygon';

export async function GET(request: NextRequest) {
  let ctx;
  try {
    ctx = await getRequestContext();
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const lat = parseFloat(searchParams.get('lat') || '');
  const lng = parseFloat(searchParams.get('lng') || '');

  if (isNaN(lat) || isNaN(lng)) {
    return NextResponse.json({
      filteredSitterIds: null,
      matchedZones: [],
      noZoneMatch: false,
      message: 'No coordinates provided — showing all sitters',
    });
  }

  try {
    const result = await filterSittersByZone(ctx.orgId, lat, lng);

    return NextResponse.json({
      ...result,
      message: result.noZoneMatch
        ? 'Address does not fall within any service zone — showing all sitters'
        : result.matchedZones.length > 0
        ? `Matched zones: ${result.matchedZones.join(', ')}`
        : 'No polygon zones configured',
    });
  } catch (error) {
    return NextResponse.json({ error: 'Zone detection failed' }, { status: 500 });
  }
}
