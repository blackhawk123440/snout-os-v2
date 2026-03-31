/**
 * Role casing consistency tests. Prevents regressions from mixed "owner" vs "OWNER" usage.
 */
import { describe, it, expect } from 'vitest';
import { normalizeRole, ROLE_OWNER, ROLE_SITTER, ROLE_CLIENT, ROLE_ADMIN, ROLE_PUBLIC } from '@/lib/roles';

describe('roles', () => {
  describe('normalizeRole', () => {
    it('normalizes uppercase to lowercase', () => {
      expect(normalizeRole('OWNER')).toBe(ROLE_OWNER);
      expect(normalizeRole('SITTER')).toBe(ROLE_SITTER);
      expect(normalizeRole('CLIENT')).toBe(ROLE_CLIENT);
      expect(normalizeRole('ADMIN')).toBe(ROLE_ADMIN);
    });

    it('preserves lowercase', () => {
      expect(normalizeRole('owner')).toBe(ROLE_OWNER);
      expect(normalizeRole('sitter')).toBe(ROLE_SITTER);
      expect(normalizeRole('client')).toBe(ROLE_CLIENT);
    });

    it('returns public for unknown roles', () => {
      expect(normalizeRole('unknown')).toBe(ROLE_PUBLIC);
      expect(normalizeRole('')).toBe(ROLE_PUBLIC);
      expect(normalizeRole(null)).toBe(ROLE_PUBLIC);
      expect(normalizeRole(undefined)).toBe(ROLE_PUBLIC);
    });
  });
});
