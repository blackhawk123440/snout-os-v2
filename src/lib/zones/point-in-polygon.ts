/**
 * Point-in-polygon detection for service zone filtering.
 * Uses ray-casting algorithm.
 */

type Point = [number, number]; // [lng, lat]
type Polygon = Point[]; // Array of [lng, lat] coordinates

/**
 * Determine if a point is inside a polygon using ray-casting.
 */
export function pointInPolygon(point: Point, polygon: Polygon): boolean {
  const [x, y] = point;
  let inside = false;

  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [xi, yi] = polygon[i];
    const [xj, yj] = polygon[j];

    const intersect = yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }

  return inside;
}

/**
 * GeoJSON polygon config structure stored in OrgServiceArea.config
 */
export interface ZonePolygonConfig {
  type: 'polygon';
  coordinates: Point[];
  sitterIds?: string[];
  color?: string;
}

/**
 * Parse the config field from OrgServiceArea into a typed polygon config.
 */
export function parseZoneConfig(config: string | null): ZonePolygonConfig | null {
  if (!config) return null;
  try {
    const parsed = JSON.parse(config);
    if (parsed.type === 'polygon' && Array.isArray(parsed.coordinates)) {
      return parsed as ZonePolygonConfig;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Find which zones a point falls within.
 * Returns matching zone IDs and their assigned sitter IDs.
 */
export async function findZonesForPoint(
  orgId: string,
  lat: number,
  lng: number,
): Promise<Array<{ zoneId: string; zoneName: string; sitterIds: string[] }>> {
  const { prisma } = await import('@/lib/db');

  const zones = await (prisma as any).orgServiceArea.findMany({
    where: { orgId, enabled: true, type: 'polygon' },
  });

  const matches: Array<{ zoneId: string; zoneName: string; sitterIds: string[] }> = [];

  for (const zone of zones) {
    const config = parseZoneConfig(zone.config);
    if (!config) continue;

    if (pointInPolygon([lng, lat], config.coordinates)) {
      matches.push({
        zoneId: zone.id,
        zoneName: zone.name,
        sitterIds: config.sitterIds || [],
      });
    }
  }

  return matches;
}

/**
 * Filter sitters by zone for a given address location.
 * Returns the filtered sitter IDs, or all sitters if no zones match.
 */
export async function filterSittersByZone(
  orgId: string,
  lat: number | null,
  lng: number | null,
): Promise<{ filteredSitterIds: string[] | null; matchedZones: string[]; noZoneMatch: boolean }> {
  if (lat == null || lng == null) {
    return { filteredSitterIds: null, matchedZones: [], noZoneMatch: false };
  }

  const zones = await findZonesForPoint(orgId, lat, lng);

  if (zones.length === 0) {
    return { filteredSitterIds: null, matchedZones: [], noZoneMatch: true };
  }

  // Combine sitter IDs from all matching zones
  const sitterIdSet = new Set<string>();
  for (const zone of zones) {
    for (const id of zone.sitterIds) {
      sitterIdSet.add(id);
    }
  }

  return {
    filteredSitterIds: sitterIdSet.size > 0 ? Array.from(sitterIdSet) : null,
    matchedZones: zones.map(z => z.zoneName),
    noZoneMatch: false,
  };
}
