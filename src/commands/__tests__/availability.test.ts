/**
 * Command Availability Tests
 * UI Constitution V1 - Phase 3
 */

import { describe, it, expect } from 'vitest';
import { CommandContext } from '../types';
import {
  hasBookingEntity,
  hasClientEntity,
  isOnRoute,
  hasBookingStatus,
  allOf,
  anyOf,
  not,
} from '../availability';

describe('Command Availability', () => {
  const baseContext: CommandContext = {
    currentRoute: '/bookings',
    user: { id: 'user1' },
    permissions: [],
  };

  it('should detect booking entity', () => {
    const ctx: CommandContext = {
      ...baseContext,
      selectedEntity: {
        type: 'booking',
        id: 'booking1',
        data: { status: 'pending' },
      },
    };

    expect(hasBookingEntity(ctx)).toBe(true);
    expect(hasBookingEntity(baseContext)).toBe(false);
  });

  it('should detect client entity', () => {
    const ctx: CommandContext = {
      ...baseContext,
      selectedEntity: {
        type: 'client',
        id: 'client1',
      },
    };

    expect(hasClientEntity(ctx)).toBe(true);
    expect(hasClientEntity(baseContext)).toBe(false);
  });

  it('should check route', () => {
    expect(isOnRoute(baseContext, '/bookings')).toBe(true);
    expect(isOnRoute(baseContext, '/calendar')).toBe(false);
    expect(isOnRoute({ ...baseContext, currentRoute: '/bookings/123' }, '/bookings')).toBe(true);
  });

  it('should check booking status', () => {
    const ctx: CommandContext = {
      ...baseContext,
      selectedEntity: {
        type: 'booking',
        id: 'booking1',
        data: { status: 'pending' },
      },
    };

    expect(hasBookingStatus(ctx, 'pending')).toBe(true);
    expect(hasBookingStatus(ctx, 'confirmed')).toBe(false);
  });

  it('should compose rules with allOf', () => {
    const rule = allOf(
      (ctx) => ctx.currentRoute === '/bookings',
      (ctx) => !!ctx.selectedEntity
    );

    const ctx1: CommandContext = {
      ...baseContext,
      selectedEntity: { type: 'booking', id: '1' },
    };
    expect(rule(ctx1)).toBe(true);

    const ctx2: CommandContext = { ...baseContext };
    expect(rule(ctx2)).toBe(false);
  });

  it('should compose rules with anyOf', () => {
    const rule = anyOf(
      (ctx) => ctx.currentRoute === '/bookings',
      (ctx) => ctx.currentRoute === '/calendar'
    );

    expect(rule(baseContext)).toBe(true);
    expect(rule({ ...baseContext, currentRoute: '/dashboard' })).toBe(false);
  });

  it('should negate rules', () => {
    const rule = not((ctx) => ctx.currentRoute === '/bookings');
    expect(rule(baseContext)).toBe(false);
    expect(rule({ ...baseContext, currentRoute: '/calendar' })).toBe(true);
  });
});
