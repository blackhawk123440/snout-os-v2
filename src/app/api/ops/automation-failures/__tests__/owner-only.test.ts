/**
 * Ops automation-failures endpoint is owner/admin only.
 * Sitter and client must receive 403.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('@/lib/request-context', () => ({
  getRequestContext: vi.fn(),
}));

vi.mock('@/lib/db', () => ({
  prisma: {
    eventLog: { findMany: vi.fn().mockResolvedValue([]) },
  },
}));

import { GET } from '@/app/api/ops/automation-failures/route';
import { getRequestContext } from '@/lib/request-context';

describe('ops automation-failures owner-only', () => {
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

    const response = await GET(new Request('http://localhost/api/ops/automation-failures'));
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

    const response = await GET(new Request('http://localhost/api/ops/automation-failures'));
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.error).toBe('Forbidden');
  });

  it('returns 200 when role is owner', async () => {
    (getRequestContext as any).mockResolvedValue({
      orgId: 'org-1',
      role: 'owner',
      userId: 'u1',
    });

    const response = await GET(new Request('http://localhost/api/ops/automation-failures'));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toHaveProperty('items');
    expect(body).toHaveProperty('count');
  });
});
