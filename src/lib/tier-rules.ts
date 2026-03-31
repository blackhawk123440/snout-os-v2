/**
 * Tier Rules (Phase 5.2)
 * 
 * Implements tier-based rules for pay split and eligibility.
 * Per Master Spec 7.2: Tier rules, pay split, eligibility for complex routines, service types.
 */

import { prisma } from "./db";

/**
 * Get commission percentage for a sitter
 * Per Master Spec 7.2.2: Tier rules override sitter-level commission
 * Returns tier commission if available, otherwise falls back to sitter.commissionPercentage
 */
export async function getSitterCommissionPercentage(sitterId: string): Promise<number> {
  const { getSitterTierPermissions } = await import('./tier-permissions');
  const permissions = await getSitterTierPermissions(sitterId);
  
  if (permissions) {
    // Tier-based commission takes precedence
    return permissions.commissionSplit;
  }

  // Fallback to sitter's individual commission
  // Note: Sitter model doesn't have commissionPercentage field in messaging schema
  // Use default commission percentage
  return 80.0;
}

/**
 * Check if sitter is eligible for a service type
 * Per Master Spec 7.2.2: Eligibility for complex routines, service types
 * Now uses centralized tier permission engine
 */
export async function isSitterEligibleForService(
  sitterId: string,
  service: string
): Promise<{ eligible: boolean; reason?: string }> {
  const { getSitterTierPermissions } = await import('./tier-permissions');
  const permissions = await getSitterTierPermissions(sitterId);

  if (!permissions) {
    return { eligible: false, reason: "Sitter has no tier assigned" };
  }

  // Check tier eligibility for complex services
  if (service === "Housesitting" || service === "House Sitting") {
    if (!permissions.canHouseSits) {
      return {
        eligible: false,
        reason: "Sitter tier does not allow house sitting assignments",
      };
    }
  }

  if (service === "24/7 Care" || service === "24/7") {
    if (!permissions.canTwentyFourHourCare) {
      return {
        eligible: false,
        reason: "Sitter tier does not allow 24/7 care assignments",
      };
    }
  }

  return { eligible: true };
}

/**
 * Get all eligible sitters for a service type
 * Filters sitters based on tier eligibility
 */
export async function getEligibleSittersForService(service: string): Promise<string[]> {
  // Note: Sitter model doesn't have currentTier relation in messaging schema
  // Get all active sitters and check eligibility via tier-permissions
  const sitters = await (prisma as any).sitter.findMany({
    where: { active: true },
    select: { id: true },
  });

  const eligibleSitterIds: string[] = [];

  for (const sitter of sitters) {
    const eligibility = await isSitterEligibleForService(sitter.id, service);
    if (eligibility.eligible) {
      eligibleSitterIds.push(sitter.id);
    }
  }

  return eligibleSitterIds;
}

