/**
 * SaaS Readiness Audit — Auth Security Tests
 * These tests PROVE auth security claims by execution, not by reading code.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// ─── Test 1: Deleted user cannot authenticate ─────────────────────────

const mockFindUnique = vi.fn();
vi.mock('@/lib/db', () => ({
  prisma: {
    user: { findUnique: (...args: unknown[]) => mockFindUnique(...args) },
  },
}));

vi.mock('@/lib/auth', () => ({
  auth: vi.fn(),
}));

import { getRequestContext } from '@/lib/request-context';
import { auth } from '@/lib/auth';

describe('Auth Security Audit', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Test 1: Deleted user cannot authenticate', () => {
    it('throws "Account has been deleted" for soft-deleted user', async () => {
      vi.mocked(auth).mockResolvedValue({
        user: { id: 'deleted-user', orgId: 'org-1', role: 'owner' },
      } as any);

      mockFindUnique.mockResolvedValue({
        id: 'deleted-user',
        deletedAt: new Date('2025-06-01'),
        role: 'owner',
        orgId: 'org-1',
      });

      await expect(getRequestContext()).rejects.toThrow('Account has been deleted');
    });

    it('allows non-deleted user through', async () => {
      vi.mocked(auth).mockResolvedValue({
        user: { id: 'active-user', orgId: 'org-1', role: 'owner' },
      } as any);

      mockFindUnique.mockResolvedValue({
        id: 'active-user',
        deletedAt: null,
        role: 'owner',
        orgId: 'org-1',
      });

      const ctx = await getRequestContext();
      expect(ctx.userId).toBe('active-user');
    });
  });

  describe('Test 2: Unauthenticated request is rejected', () => {
    it('throws Unauthorized when no session exists', async () => {
      vi.mocked(auth).mockResolvedValue(null as any);

      await expect(getRequestContext()).rejects.toThrow('Unauthorized');
    });

    it('throws Unauthorized when session has no user', async () => {
      vi.mocked(auth).mockResolvedValue({ user: null } as any);

      await expect(getRequestContext()).rejects.toThrow('Unauthorized');
    });
  });

  describe('Test 3: RBAC enforcement', () => {
    it('requireRole rejects wrong role', async () => {
      const { requireRole, ForbiddenError } = await import('@/lib/rbac');
      const ctx = { orgId: 'org-1', role: 'client' as const, userId: 'u1', sitterId: null, clientId: 'c1' };

      expect(() => requireRole(ctx, 'owner')).toThrow(ForbiddenError);
    });

    it('requireRole accepts correct role', async () => {
      const { requireRole } = await import('@/lib/rbac');
      const ctx = { orgId: 'org-1', role: 'owner' as const, userId: 'u1', sitterId: null, clientId: null };

      expect(() => requireRole(ctx, 'owner')).not.toThrow();
    });

    it('requireAnyRole rejects unauthorized role', async () => {
      const { requireAnyRole, ForbiddenError } = await import('@/lib/rbac');
      const ctx = { orgId: 'org-1', role: 'client' as const, userId: 'u1', sitterId: null, clientId: 'c1' };

      expect(() => requireAnyRole(ctx, ['owner', 'admin'])).toThrow(ForbiddenError);
    });

    it('requireSuperAdmin rejects non-superadmin', async () => {
      const { requireSuperAdmin, ForbiddenError } = await import('@/lib/rbac');
      const ctx = { orgId: 'org-1', role: 'owner' as const, userId: 'u1', sitterId: null, clientId: null };

      expect(() => requireSuperAdmin(ctx)).toThrow(ForbiddenError);
    });

    it('requireSuperAdmin accepts superadmin', async () => {
      const { requireSuperAdmin } = await import('@/lib/rbac');
      const ctx = { orgId: 'org-1', role: 'superadmin' as const, userId: 'u1', sitterId: null, clientId: null };

      expect(() => requireSuperAdmin(ctx)).not.toThrow();
    });

    it('requireClientContext rejects missing clientId', async () => {
      const { requireClientContext, ForbiddenError } = await import('@/lib/rbac');
      const ctx = { orgId: 'org-1', role: 'client' as const, userId: 'u1', sitterId: null, clientId: null };

      expect(() => requireClientContext(ctx)).toThrow(ForbiddenError);
    });
  });

  describe('Test 4: Role normalization', () => {
    it('superadmin is a valid AppRole (type-level check)', () => {
      type Check = 'superadmin' extends import('@/lib/request-context').AppRole ? true : false;
      const check: Check = true;
      expect(check).toBe(true);
    });

    it('unknown role is rejected (not silently treated as public)', async () => {
      vi.mocked(auth).mockResolvedValue({
        user: { id: 'u1', orgId: 'org-1', role: 'hacker' },
      } as any);

      mockFindUnique.mockResolvedValue({
        id: 'u1',
        deletedAt: null,
        role: 'hacker',
        orgId: 'org-1',
      });

      await expect(getRequestContext()).rejects.toThrow('Unauthorized: user role not assigned');
    });
  });

  describe('Test 5: assertOrgAccess prevents cross-org access', () => {
    it('throws on org mismatch', async () => {
      const { assertOrgAccess, ForbiddenError } = await import('@/lib/rbac');
      expect(() => assertOrgAccess('org-a', 'org-b')).toThrow(ForbiddenError);
    });

    it('throws on null entity orgId', async () => {
      const { assertOrgAccess, ForbiddenError } = await import('@/lib/rbac');
      expect(() => assertOrgAccess(null, 'org-b')).toThrow(ForbiddenError);
    });

    it('passes on matching org', async () => {
      const { assertOrgAccess } = await import('@/lib/rbac');
      expect(() => assertOrgAccess('org-a', 'org-a')).not.toThrow();
    });
  });
});
