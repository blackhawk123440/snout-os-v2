/**
 * Command Permissions Tests
 * UI Constitution V1 - Phase 3
 */

import { describe, it, expect } from 'vitest';
import { CommandContext } from '../types';
import {
  hasPermission,
  hasAnyPermission,
  hasAllPermissions,
  isAuthenticated,
  isAdmin,
  defaultPermission,
  adminOnly,
  alwaysAllowed,
  neverAllowed,
} from '../permissions';

describe('Command Permissions', () => {
  const baseContext: CommandContext = {
    currentRoute: '/',
    user: { id: 'user1' },
    permissions: ['read', 'write'],
  };

  it('should check specific permission', () => {
    expect(hasPermission(baseContext, 'read')).toBe(true);
    expect(hasPermission(baseContext, 'delete')).toBe(false);
    expect(hasPermission({ ...baseContext, permissions: ['*'] }, 'anything')).toBe(true);
  });

  it('should check any permission', () => {
    expect(hasAnyPermission(baseContext, ['read', 'delete'])).toBe(true);
    expect(hasAnyPermission(baseContext, ['delete', 'admin'])).toBe(false);
  });

  it('should check all permissions', () => {
    expect(hasAllPermissions(baseContext, ['read', 'write'])).toBe(true);
    expect(hasAllPermissions(baseContext, ['read', 'delete'])).toBe(false);
  });

  it('should check authentication', () => {
    expect(isAuthenticated(baseContext)).toBe(true);
    expect(isAuthenticated({ ...baseContext, user: undefined })).toBe(false);
  });

  it('should check admin role', () => {
    expect(isAdmin({ ...baseContext, user: { id: 'user1', role: 'admin' } })).toBe(true);
    expect(isAdmin({ ...baseContext, permissions: ['admin'] })).toBe(true);
    expect(isAdmin(baseContext)).toBe(false);
  });

  it('should use default permission', () => {
    expect(defaultPermission(baseContext)).toBe(true);
    expect(defaultPermission({ ...baseContext, user: undefined })).toBe(false);
  });

  it('should allow admin only', () => {
    expect(adminOnly({ ...baseContext, user: { id: 'user1', role: 'admin' } })).toBe(true);
    expect(adminOnly(baseContext)).toBe(false);
  });

  it('should always allow', () => {
    expect(alwaysAllowed(baseContext)).toBe(true);
    expect(alwaysAllowed({ ...baseContext, user: undefined })).toBe(true);
  });

  it('should never allow', () => {
    expect(neverAllowed(baseContext)).toBe(false);
  });
});
