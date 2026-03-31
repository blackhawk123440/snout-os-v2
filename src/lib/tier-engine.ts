/**
 * Sitter Tier & Performance Engine
 * 
 * Calculates sitter tiers based on performance metrics
 */

import { prisma } from "@/lib/db";
import { emitSitterTierChanged } from "./event-emitter";

interface TierCalculationResult {
  sitterId: string;
  previousTierId: string | null;
  newTierId: string;
  points: number;
  completionRate: number;
  responseRate: number;
  tierName: string;
}

/**
 * Calculate points for a sitter based on completed bookings
 */
export async function calculateSitterPoints(
  sitterId: string,
  periodStart: Date,
  periodEnd: Date
): Promise<number> {
  // Note: Booking model not available in messaging dashboard schema
  // Return 0 - tier points calculation not available
  return 0;
  
  // Original code (commented out - Booking model not available):
  // const bookings = await prisma.booking.findMany({ ... });
  // ... (Booking model queries disabled)
}

/**
 * Calculate completion rate for a sitter
 */
export async function calculateCompletionRate(
  sitterId: string,
  periodStart: Date,
  periodEnd: Date
): Promise<number> {
  // Note: Booking model not available in messaging dashboard schema
  // Return 0 - completion rate calculation not available
  return 0;
  
  // Original code (commented out - Booking model not available):
  // const [completed, assigned] = await Promise.all([ ... ]);
  // ... (Booking model queries disabled)
}

/**
 * Calculate response rate for a sitter
 * (Response to sitter pool offers, messages, etc.)
 */
export async function calculateResponseRate(
  sitterId: string,
  periodStart: Date,
  periodEnd: Date
): Promise<number> {
  // Note: SitterPoolOffer model not available in messaging dashboard schema
  // Return 0 - response rate calculation not available
  return 0;
  
  // Original code (commented out - SitterPoolOffer model not available):
  // const offers = await prisma.sitterPoolOffer.findMany({ ... });
  // ... (SitterPoolOffer model queries disabled)
}

/**
 * Determine tier for a sitter based on metrics
 */
export async function determineSitterTier(
  points: number,
  completionRate: number,
  responseRate: number
): Promise<string | null> {
  // Note: SitterTier model not available in messaging dashboard schema
  // Return null - tier determination not available
  return null;
  
  // Original code (commented out - SitterTier model not available):
  // const tiers = await prisma.sitterTier.findMany({ ... });
  // ... (SitterTier model queries disabled)
  return null;
}

/**
 * Calculate and assign tier for a single sitter
 */
export async function calculateSitterTier(
  sitterId: string,
  periodStart: Date,
  periodEnd: Date,
  orgId?: string
): Promise<TierCalculationResult | null> {
  // Note: API schema Sitter model doesn't have currentTier relation
  const sitter = orgId
    ? await (prisma as any).sitter.findFirst({ where: { id: sitterId, orgId } })
    : await prisma.sitter.findUnique({ where: { id: sitterId } });

  if (!sitter) {
    return null;
  }

  // Note: Tier system not available in messaging dashboard schema
  // Return null - tier calculation not available
  return null;
  
  // Original code (commented out - Booking/SitterTier models not available):
  // const [points, completionRate, responseRate] = await Promise.all([ ... ]);
  // ... (Tier calculation disabled)
  return null;
}

/**
 * Calculate tiers for all sitters (monthly job)
 */
export async function calculateAllSitterTiers(
  periodStart?: Date,
  periodEnd?: Date,
  orgId?: string
): Promise<TierCalculationResult[]> {
  // Default to last month if not specified
  const end = periodEnd || new Date();
  const start = periodStart || new Date(end.getFullYear(), end.getMonth() - 1, 1);

  const whereClause: any = { active: true };
  if (orgId) whereClause.orgId = orgId;

  const sitters = await (prisma as any).sitter.findMany({
    where: whereClause,
  });

  const results: TierCalculationResult[] = [];

  for (const sitter of sitters) {
    try {
      const result = await calculateSitterTier(sitter.id, start, end, orgId);
      if (result) {
        results.push(result);
      }
    } catch (error) {
      console.error(`Failed to calculate tier for sitter ${sitter.id}:`, error);
    }
  }

  return results;
}



