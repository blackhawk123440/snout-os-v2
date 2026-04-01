import { describe, expect, it } from 'vitest';
import { getPortalRole, normalizePortalRole } from '@/lib/portal-role';

describe('portal-role', () => {
  it('normalizes role strings case-insensitively', () => {
    expect(normalizePortalRole('CLIENT')).toBe('client');
    expect(normalizePortalRole('SITTER')).toBe('sitter');
    expect(normalizePortalRole('Admin')).toBe('owner');
  });

  it('falls back to linked role ids when role casing is missing or unexpected', () => {
    expect(getPortalRole({ role: 'CLIENT_PORTAL', clientId: 'client-1' })).toBe('client');
    expect(getPortalRole({ role: 'field_staff', sitterId: 'sitter-1' })).toBe('sitter');
  });

  it('defaults to owner for authenticated users without a portal-specific link', () => {
    expect(getPortalRole({ role: 'OWNER' })).toBe('owner');
    expect(getPortalRole({ role: undefined })).toBe('owner');
  });
});
