/**
 * Canonical /api/automations: owner/admin only. Sitter and client get 403.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('@/lib/request-context', () => ({
  getRequestContext: vi.fn(),
}));

vi.mock('@/lib/automation-utils', () => ({
  getAutomationSettings: vi.fn().mockResolvedValue({}),
  setAutomationSettings: vi.fn().mockResolvedValue({}),
}));

vi.mock('@/lib/tenancy', () => ({
  getScopedDb: vi.fn(() => ({
    eventLog: { count: vi.fn().mockResolvedValue(0) },
  })),
}));

import { GET } from '@/app/api/automations/route';
import { getRequestContext } from '@/lib/request-context';

describe('GET /api/automations owner-only', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 403 when role is sitter', async () => {
    (getRequestContext as any).mockResolvedValue({
      orgId: 'org-1',
      role: 'sitter',
      sitterId: 's1',
      userId: 'u1',
    });

    const response = await GET(new Request('http://localhost/api/automations'));
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.error).toBe('Forbidden');
  });

  it('returns 403 when role is client', async () => {
    (getRequestContext as any).mockResolvedValue({
      orgId: 'org-1',
      role: 'client',
      clientId: 'c1',
      userId: 'u1',
    });

    const response = await GET(new Request('http://localhost/api/automations'));
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.error).toBe('Forbidden');
  });

  it('returns 200 and items when role is owner', async () => {
    (getRequestContext as any).mockResolvedValue({
      orgId: 'org-1',
      role: 'owner',
      userId: 'u1',
    });

    const response = await GET(new Request('http://localhost/api/automations'));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toHaveProperty('items');
    expect(Array.isArray(body.items)).toBe(true);
  });
});
