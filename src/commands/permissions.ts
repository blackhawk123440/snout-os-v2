/**
 * Command Permissions
 * UI Constitution V1 - Phase 3
 * 
 * Centralized permission checks. Never allow UI to bypass permission logic.
 */

import { CommandContext } from './types';

/**
 * Check if user has specific permission
 */
export function hasPermission(ctx: CommandContext, permission: string): boolean {
  if (!ctx.permissions) return false;
  return ctx.permissions.includes(permission) || ctx.permissions.includes('*');
}

/**
 * Check if user has any of the specified permissions
 */
export function hasAnyPermission(ctx: CommandContext, permissions: string[]): boolean {
  if (!ctx.permissions) return false;
  return permissions.some(perm => hasPermission(ctx, perm));
}

/**
 * Check if user has all of the specified permissions
 */
export function hasAllPermissions(ctx: CommandContext, permissions: string[]): boolean {
  if (!ctx.permissions) return false;
  return permissions.every(perm => hasPermission(ctx, perm));
}

/**
 * Check if user is authenticated
 */
export function isAuthenticated(ctx: CommandContext): boolean {
  return !!ctx.user?.id;
}

/**
 * Check if user has admin role
 */
export function isAdmin(ctx: CommandContext): boolean {
  return ctx.user?.role === 'admin' || hasPermission(ctx, 'admin');
}

/**
 * Default permission check - all authenticated users
 */
export function defaultPermission(ctx: CommandContext): boolean {
  return isAuthenticated(ctx);
}

/**
 * Admin-only permission
 */
export function adminOnly(ctx: CommandContext): boolean {
  return isAdmin(ctx);
}

/**
 * Permission check that always allows (use with caution)
 */
export function alwaysAllowed(ctx: CommandContext): boolean {
  return true;
}

/**
 * Permission check that never allows
 */
export function neverAllowed(ctx: CommandContext): boolean {
  return false;
}
