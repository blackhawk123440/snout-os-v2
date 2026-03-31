/**
 * Sitter Helper Functions (Phase 5.1)
 * 
 * Server-side helpers for sitter authentication and access control.
 * Per Master Spec 7.1: Sitters can see only their assigned bookings and limited client data.
 */

import { NextRequest } from "next/server";
import { getCurrentUserSafe } from "./auth-helpers";
import { prisma } from "./db";

/**
 * Get current sitter from session
 * Returns sitter ID if user is authenticated and linked to a sitter
 */
export async function getCurrentSitterId(request?: NextRequest): Promise<string | null> {
  try {
    const user = await getCurrentUserSafe(request);
    if (!user?.sitterId) {
      return null;
    }
    return user.sitterId;
  } catch (error) {
    return null;
  }
}

/**
 * Get current sitter record from session
 * Returns full sitter record if user is authenticated and linked to a sitter
 */
export async function getCurrentSitter(request?: NextRequest): Promise<any | null> {
  try {
    const user = await getCurrentUserSafe(request);
    if (!user?.sitterId) {
      return null;
    }

    // Scope sitter lookup by orgId to prevent cross-tenant access
    const orgId = user.orgId;
    const sitter = orgId
      ? await (prisma as any).sitter.findFirst({ where: { id: user.sitterId, orgId } })
      : await prisma.sitter.findUnique({ where: { id: user.sitterId } });

    return sitter;
  } catch (error) {
    return null;
  }
}

/**
 * Require sitter authentication
 * Throws error if user is not authenticated as a sitter
 */
export class SitterAuthError extends Error {
  constructor(message: string = "Sitter authentication required") {
    super(message);
    this.name = "SitterAuthError";
  }
}

export async function requireSitter(request?: NextRequest): Promise<any> {
  const sitter = await getCurrentSitter(request);
  if (!sitter) {
    throw new SitterAuthError("Sitter authentication required");
  }
  return sitter;
}

/**
 * Verify sitter has access to a booking
 * Returns true if booking is assigned to the sitter
 */
export async function verifySitterBookingAccess(
  sitterId: string,
  bookingId: string
): Promise<boolean> {
  // Note: Booking model not available in messaging dashboard schema
  // Return false - booking access verification not available
  return false;
  
  /* Original code (commented out):
  try {
    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      select: { sitterId: true },
    });

    return booking?.sitterId === sitterId;
  } catch (error) {
    return false;
  }
  */
}

/**
 * Client-facing sitter profile (trust badge).
 * Never exposes raw SRS scores — only human-readable statements.
 */
export interface ClientSitterProfile {
  tierLabel: string | null;
  statements: string[];
}

export function buildClientFacingSitterProfile(
  snapshot: { tier: string; rolling30dBreakdownJson: string; visits30d?: number },
  completedVisits: number
): ClientSitterProfile {
  const tierMap: Record<string, string | null> = {
    foundation: null,
    reliant: 'Reliable',
    trusted: 'Highly Trusted',
    preferred: 'Top Rated',
  };
  const tierLabel = tierMap[snapshot.tier] ?? null;

  const statements: string[] = [];

  if (completedVisits >= 5) {
    statements.push(`${completedVisits} visits completed`);
  }

  try {
    const breakdown = JSON.parse(snapshot.rolling30dBreakdownJson || '{}');
    if (breakdown.timeliness >= 90) statements.push('Always on time');
    else if (breakdown.timeliness >= 75) statements.push('Punctual');
    if (breakdown.accuracy >= 90) statements.push('Thorough visit reports');
    if (breakdown.responsiveness >= 85) statements.push('Quick to respond');
    if (breakdown.engagement >= 85) statements.push('Detailed updates');
  } catch { /* ignore parse errors */ }

  return { tierLabel, statements: statements.slice(0, 2) };
}

/**
 * Limit client data for sitter view
 * Per Master Spec 7.1.1: Only data required to do the job
 */
export function limitClientDataForSitter(booking: any): any {
  return {
    id: booking.id,
    firstName: booking.firstName,
    lastName: booking.lastName,
    phone: booking.phone,
    address: booking.address,
    pickupAddress: booking.pickupAddress,
    dropoffAddress: booking.dropoffAddress,
    service: booking.service,
    startAt: booking.startAt,
    endAt: booking.endAt,
    status: booking.status,
    notes: booking.notes,
    pets: booking.pets?.map((pet: any) => ({
      id: pet.id,
      name: pet.name,
      species: pet.species,
      breed: pet.breed,
      age: pet.age,
      notes: pet.notes,
    })) || [],
    timeSlots: booking.timeSlots || [],
    // Exclude: email, totalPrice, paymentStatus, stripePaymentLinkUrl, tipLinkUrl, pricingSnapshot
    // Exclude: clientId, sitterId (sitter can see their own ID but not others)
    // Exclude: other bookings, payment info, pricing settings
  };
}

