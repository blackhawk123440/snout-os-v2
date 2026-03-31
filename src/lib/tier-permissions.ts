/**
 * Tier Permissions Engine
 *
 * Granular permissions per sitter tier: pool access, booking type
 * restrictions, commission splits. Enforced at assignment time.
 *
 * Sitters without a tier assigned are treated as the default (Trainee)
 * tier — most restrictive permissions.
 */

import { prisma } from "@/lib/db";

export interface TierPermissions {
  // Pool & Assignment
  canJoinPools: boolean;
  canAutoAssign: boolean;
  canLeadPool: boolean;

  // Booking Types
  canOvernight: boolean;
  canSameDay: boolean;
  canHighValue: boolean;
  canRecurring: boolean;
  canHouseSits: boolean;
  canTwentyFourHourCare: boolean;

  // Special Privileges
  canOverrideDecline: boolean;

  // Earnings
  commissionSplit: number; // Percentage (0-100)
}

export interface TierInfo {
  id: string;
  name: string;
  priorityLevel: number;
  permissions: TierPermissions;
  badgeColor?: string;
  badgeStyle?: string;
}

/** Default permissions for sitters without a tier (most restrictive). */
const DEFAULT_PERMISSIONS: TierPermissions = {
  canJoinPools: false,
  canAutoAssign: false,
  canLeadPool: false,
  canOvernight: false,
  canSameDay: false,
  canHighValue: false,
  canRecurring: false,
  canHouseSits: false,
  canTwentyFourHourCare: false,
  canOverrideDecline: false,
  commissionSplit: 65.0,
};

/**
 * Convert a SitterTier DB row to the permissions interface.
 */
export function tierToPermissions(tier: any): TierPermissions {
  return {
    canJoinPools: tier.canJoinPools ?? false,
    canAutoAssign: tier.canAutoAssign ?? false,
    canLeadPool: tier.canLeadPool ?? false,
    canOvernight: tier.canOvernight ?? false,
    canSameDay: tier.canSameDay ?? false,
    canHighValue: tier.canHighValue ?? false,
    canRecurring: tier.canRecurring ?? false,
    canHouseSits: tier.canTakeHouseSits ?? false,
    canTwentyFourHourCare: tier.canTakeTwentyFourHourCare ?? false,
    canOverrideDecline: tier.canOverrideDecline ?? false,
    commissionSplit: tier.commissionSplit ?? 70.0,
  };
}

/**
 * Get tier permissions for a sitter.
 * Returns default (restrictive) permissions if sitter has no tier.
 */
export async function getSitterTierPermissions(sitterId: string): Promise<TierPermissions> {
  const sitter = await prisma.sitter.findUnique({
    where: { id: sitterId },
    include: { currentTier: true },
  });

  if (!sitter || !sitter.currentTier) {
    return { ...DEFAULT_PERMISSIONS };
  }

  return tierToPermissions(sitter.currentTier);
}

/**
 * Get tier info (name, permissions, badge) for a sitter.
 * Returns null if sitter has no tier.
 */
export async function getSitterTierInfo(sitterId: string): Promise<TierInfo | null> {
  const sitter = await prisma.sitter.findUnique({
    where: { id: sitterId },
    include: { currentTier: true },
  });

  if (!sitter?.currentTier) return null;

  const tier = sitter.currentTier;
  return {
    id: tier.id,
    name: tier.name,
    priorityLevel: tier.priorityLevel,
    permissions: tierToPermissions(tier),
    badgeColor: tier.badgeColor ?? undefined,
    badgeStyle: tier.badgeStyle ?? undefined,
  };
}

/**
 * Check if sitter can be assigned to a booking.
 * Returns { allowed, reasons[] } with all failing checks.
 */
export async function canSitterTakeBooking(
  sitterId: string,
  booking: {
    service: string;
    startAt: Date;
    createdAt?: Date;
    totalPrice: number;
    clientId?: string | null;
    isRecurring?: boolean;
  }
): Promise<{ allowed: boolean; reasons: string[] }> {
  const permissions = await getSitterTierPermissions(sitterId);
  const reasons: string[] = [];

  // Check overnight/extended care
  const overnightServices = ['Housesitting', 'House Sitting', 'Overnight', '24/7 Care'];
  const isOvernight = overnightServices.some(
    (s) => booking.service.toLowerCase() === s.toLowerCase()
  );
  if (isOvernight && !permissions.canOvernight) {
    reasons.push('Tier does not allow overnight/extended care bookings');
  }

  // Check house sits specifically
  if (booking.service.toLowerCase().includes('house sit') && !permissions.canHouseSits) {
    reasons.push('Tier does not allow house sitting');
  }

  // Check 24-hour care
  if (booking.service.toLowerCase().includes('24/7') && !permissions.canTwentyFourHourCare) {
    reasons.push('Tier does not allow 24/7 care');
  }

  // Check same-day bookings (booked less than 24 hours before start)
  const now = new Date();
  const hoursUntilBooking = (new Date(booking.startAt).getTime() - now.getTime()) / (1000 * 60 * 60);
  const isSameDay = hoursUntilBooking < 24 && hoursUntilBooking > 0;
  if (isSameDay && !permissions.canSameDay) {
    reasons.push('Tier does not allow same-day bookings');
  }

  // Check high-value bookings (>= $500)
  if (booking.totalPrice >= 500 && !permissions.canHighValue) {
    reasons.push('Tier does not allow high-value bookings ($500+)');
  }

  // Check recurring
  if (booking.isRecurring && !permissions.canRecurring) {
    reasons.push('Tier does not allow recurring bookings');
  }

  return { allowed: reasons.length === 0, reasons };
}

/**
 * Check if sitter can join a sitter pool.
 */
export async function canSitterJoinPool(sitterId: string): Promise<boolean> {
  const permissions = await getSitterTierPermissions(sitterId);
  return permissions.canJoinPools;
}

/**
 * Check if sitter can be auto-assigned (without owner approval).
 */
export async function canSitterAutoAssign(sitterId: string): Promise<boolean> {
  const permissions = await getSitterTierPermissions(sitterId);
  return permissions.canAutoAssign;
}

/**
 * Get tier ranking weight for sitter pool selection.
 * Higher tier = higher weight.
 */
export async function getTierRankingWeight(sitterId: string): Promise<number> {
  const sitter = await prisma.sitter.findUnique({
    where: { id: sitterId },
    include: { currentTier: true },
  });

  if (!sitter) return 0;
  if (!sitter.currentTier) return 1;

  return sitter.currentTier.priorityLevel;
}

/**
 * Get all eligible sitters for a booking, ranked by tier priority.
 * Filters out sitters whose tier doesn't permit the booking type.
 */
export async function getEligibleSittersForBooking(
  booking: {
    service: string;
    startAt: Date;
    createdAt?: Date;
    totalPrice: number;
    clientId?: string | null;
    isRecurring?: boolean;
  },
  options?: {
    orgId?: string;
    includeInactive?: boolean;
    maxResults?: number;
  }
): Promise<Array<{ sitterId: string; tierName: string; tierWeight: number; canAutoAssign: boolean }>> {
  const where: any = {
    deletedAt: null,
  };
  if (!options?.includeInactive) where.active = true;
  if (options?.orgId) where.orgId = options.orgId;

  const sitters = await prisma.sitter.findMany({
    where,
    include: { currentTier: true },
  });

  const eligible: Array<{ sitterId: string; tierName: string; tierWeight: number; canAutoAssign: boolean }> = [];

  for (const sitter of sitters) {
    const check = await canSitterTakeBooking(sitter.id, booking);
    if (check.allowed) {
      const permissions = sitter.currentTier ? tierToPermissions(sitter.currentTier) : DEFAULT_PERMISSIONS;
      eligible.push({
        sitterId: sitter.id,
        tierName: sitter.currentTier?.name ?? 'Unassigned',
        tierWeight: sitter.currentTier?.priorityLevel ?? 0,
        canAutoAssign: permissions.canAutoAssign,
      });
    }
  }

  // Sort by tier priority descending
  eligible.sort((a, b) => b.tierWeight - a.tierWeight);

  if (options?.maxResults) {
    return eligible.slice(0, options.maxResults);
  }

  return eligible;
}

/**
 * Log a tier-related event for audit trail.
 */
export async function logTierOverride(params: {
  sitterId: string;
  bookingId: string;
  overrideReason: string;
  overriddenBy: string;
  blockedReasons: string[];
}): Promise<void> {
  try {
    const sitter = await prisma.sitter.findUnique({
      where: { id: params.sitterId },
      select: { orgId: true },
    });

    if (sitter) {
      await prisma.eventLog.create({
        data: {
          orgId: sitter.orgId,
          eventType: 'tier.override',
          bookingId: params.bookingId,
          status: 'success',
          metadata: JSON.stringify({
            sitterId: params.sitterId,
            overrideReason: params.overrideReason,
            overriddenBy: params.overriddenBy,
            blockedReasons: params.blockedReasons,
          }),
        },
      });
    }
  } catch (error) {
    console.error('[tier-permissions] Failed to log tier override:', error);
  }
}
