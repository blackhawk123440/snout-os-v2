/**
 * Tier Name Mapper
 * 
 * Maps between canonical tier names (Trainee/Certified/Trusted/Elite) and
 * computation tier names (Bronze/Silver/Gold/Platinum).
 * 
 * Single source of truth for tier naming across the app.
 */

/**
 * Canonical tier names (used in UI badges, seed data, database)
 */
export type CanonicalTierName = 'Trainee' | 'Certified' | 'Trusted' | 'Elite';

/**
 * Computation tier names (used in tier engine)
 */
export type ComputationTierName = 'Bronze' | 'Silver' | 'Gold' | 'Platinum';

/**
 * Mapping from computation tier to canonical tier
 */
const COMPUTATION_TO_CANONICAL: Record<ComputationTierName, CanonicalTierName> = {
  Bronze: 'Trainee',
  Silver: 'Certified',
  Gold: 'Trusted',
  Platinum: 'Elite',
};

/**
 * Mapping from canonical tier to computation tier
 */
const CANONICAL_TO_COMPUTATION: Record<CanonicalTierName, ComputationTierName> = {
  Trainee: 'Bronze',
  Certified: 'Silver',
  Trusted: 'Gold',
  Elite: 'Platinum',
};

/**
 * Convert computation tier name to canonical tier name
 */
export function toCanonicalTierName(computationName: ComputationTierName | string): CanonicalTierName {
  if (computationName in COMPUTATION_TO_CANONICAL) {
    return COMPUTATION_TO_CANONICAL[computationName as ComputationTierName];
  }
  // If already canonical, return as-is
  if (['Trainee', 'Certified', 'Trusted', 'Elite'].includes(computationName)) {
    return computationName as CanonicalTierName;
  }
  // Default fallback
  return 'Trainee';
}

/**
 * Convert canonical tier name to computation tier name
 */
export function toComputationTierName(canonicalName: CanonicalTierName | string): ComputationTierName {
  if (canonicalName in CANONICAL_TO_COMPUTATION) {
    return CANONICAL_TO_COMPUTATION[canonicalName as CanonicalTierName];
  }
  // If already computation, return as-is
  if (['Bronze', 'Silver', 'Gold', 'Platinum'].includes(canonicalName)) {
    return canonicalName as ComputationTierName;
  }
  // Default fallback
  return 'Bronze';
}

/**
 * Get tier level (1-4) for display
 */
export function getTierLevel(tierName: CanonicalTierName | string): number {
  const canonical = toCanonicalTierName(tierName);
  const levels: Record<CanonicalTierName, number> = {
    Trainee: 1,
    Certified: 2,
    Trusted: 3,
    Elite: 4,
  };
  return levels[canonical] || 1;
}

/**
 * Get tier icon name for display
 */
export function getTierIcon(tierName: CanonicalTierName | string): string {
  const canonical = toCanonicalTierName(tierName);
  const icons: Record<CanonicalTierName, string> = {
    Trainee: 'seedling',
    Certified: 'certificate',
    Trusted: 'shield-check',
    Elite: 'crown',
  };
  return icons[canonical] || 'seedling';
}

/**
 * Get tier color for display
 */
export function getTierColor(tierName: CanonicalTierName | string): string {
  const canonical = toCanonicalTierName(tierName);
  const colors: Record<CanonicalTierName, string> = {
    Trainee: '#F5F5F5', // Light gray
    Certified: '#8B6F47', // Soft brown
    Trusted: '#8B6F47', // Brown
    Elite: '#8B6F47', // Brown with accent
  };
  return colors[canonical] || '#F5F5F5';
}

/**
 * Get all tiers in order
 */
export function getAllTiers(): CanonicalTierName[] {
  return ['Trainee', 'Certified', 'Trusted', 'Elite'];
}
