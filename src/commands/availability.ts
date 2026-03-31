/**
 * Command Availability Rules
 * UI Constitution V1 - Phase 3
 * 
 * Centralized availability logic for commands based on context.
 */

import { CommandContext } from './types';

/**
 * Check if booking entity is available in context
 */
export function hasBookingEntity(ctx: CommandContext): boolean {
  return ctx.selectedEntity?.type === 'booking' && !!ctx.selectedEntity.id;
}

/**
 * Check if client entity is available in context
 */
export function hasClientEntity(ctx: CommandContext): boolean {
  return ctx.selectedEntity?.type === 'client' && !!ctx.selectedEntity.id;
}

/**
 * Check if sitter entity is available in context
 */
export function hasSitterEntity(ctx: CommandContext): boolean {
  return ctx.selectedEntity?.type === 'sitter' && !!ctx.selectedEntity.id;
}

/**
 * Check if we're on a specific route
 */
export function isOnRoute(ctx: CommandContext, route: string): boolean {
  return ctx.currentRoute === route || ctx.currentRoute.startsWith(route + '/');
}

/**
 * Check if booking has specific status
 */
export function hasBookingStatus(ctx: CommandContext, status: string): boolean {
  if (!hasBookingEntity(ctx)) return false;
  return ctx.selectedEntity?.data?.status === status;
}

/**
 * Check if feature flag is enabled
 */
export function hasFeatureFlag(ctx: CommandContext, flag: string): boolean {
  return ctx.featureFlags?.[flag] === true;
}

/**
 * Check if we're on mobile (from user agent or context)
 */
export function isMobile(ctx: CommandContext): boolean {
  // Could be passed in context or detected
  return typeof window !== 'undefined' && window.innerWidth < 768;
}

/**
 * Check if command should be available based on route
 */
export function availableOnRoute(ctx: CommandContext, routes: string[]): boolean {
  return routes.some(route => isOnRoute(ctx, route));
}

/**
 * Check if command should be available when entity is selected
 */
export function availableWithEntity(ctx: CommandContext, entityTypes: string[]): boolean {
  if (!ctx.selectedEntity) return false;
  return entityTypes.includes(ctx.selectedEntity.type);
}

/**
 * Composite availability rule
 */
export function allOf(...rules: Array<(ctx: CommandContext) => boolean>): (ctx: CommandContext) => boolean {
  return (ctx) => rules.every(rule => rule(ctx));
}

/**
 * Composite availability rule (any)
 */
export function anyOf(...rules: Array<(ctx: CommandContext) => boolean>): (ctx: CommandContext) => boolean {
  return (ctx) => rules.some(rule => rule(ctx));
}

/**
 * Negate availability rule
 */
export function not(rule: (ctx: CommandContext) => boolean): (ctx: CommandContext) => boolean {
  return (ctx) => !rule(ctx);
}
