/**
 * Permission & Role System
 * 
 * Utilities for checking user permissions
 */

import { prisma } from "@/lib/db";

type Resource = string; // e.g., "client.phone", "booking.edit", "sitter.payout"
type Action = "read" | "write" | "delete" | "manage";

interface PermissionCheck {
  userId: string;
  userType: "sitter" | "admin";
  resource: Resource;
  action: Action;
}

/**
 * Check if a user has permission for a resource/action
 */
export async function hasPermission(
  userId: string,
  userType: "sitter" | "admin",
  resource: Resource,
  action: Action
): Promise<boolean> {
  try {
    // Note: UserRole model doesn't exist in messaging dashboard schema
    // Use role from User model instead (using type assertion)
    const user = await (prisma as any).user.findUnique({
      where: { id: userId },
      select: { role: true },
    });

    // For messaging dashboard, use simple role-based permissions
    // Admin/owner has all permissions, sitter has limited permissions
    if (user?.role === 'owner' || user?.role === 'admin') {
      return true; // Owners/admins have all permissions
    }

    // Sitter permissions are handled by role field
    // Note: Detailed permission system not available in messaging schema
    return false;
  } catch (error) {
    console.error("Permission check error:", error);
    return false;
  }
}

/**
 * Get all permissions for a user
 */
export async function getUserPermissions(
  userId: string,
  userType: "sitter" | "admin"
): Promise<Array<{ resource: string; action: string }>> {
  try {
    // Note: UserRole model doesn't exist in messaging dashboard schema
    // Use role from User model (using type assertion)
    const user = await (prisma as any).user.findUnique({
      where: { id: userId },
      select: { role: true },
    });

    if (!user) {
      return [];
    }

    // Return basic permissions based on role
    if (user.role === 'owner' || user.role === 'admin') {
      return [{ resource: '*', action: '*' }]; // All permissions
    }

    return []; // Sitters have limited permissions
  } catch (error) {
    console.error("Get permissions error:", error);
    return [];
  }
}

/**
 * Check if user can see client phone number
 */
export async function canSeeClientPhone(
  userId: string,
  userType: "sitter" | "admin"
): Promise<boolean> {
  return hasPermission(userId, userType, "client.phone", "read");
}

/**
 * Check if user can edit bookings
 */
export async function canEditBooking(
  userId: string,
  userType: "sitter" | "admin"
): Promise<boolean> {
  return hasPermission(userId, userType, "booking.edit", "write");
}

/**
 * Check if user can see pricing
 */
export async function canSeePricing(
  userId: string,
  userType: "sitter" | "admin"
): Promise<boolean> {
  return hasPermission(userId, userType, "booking.pricing", "read");
}

/**
 * Check if user can view sitter payouts
 */
export async function canViewPayouts(
  userId: string,
  userType: "sitter" | "admin"
): Promise<boolean> {
  return hasPermission(userId, userType, "sitter.payout", "read");
}



