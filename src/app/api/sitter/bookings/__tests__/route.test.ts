import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockBookingFindMany = vi.fn();
const mockUserFindFirst = vi.fn();

vi.mock('@/lib/db', () => ({
  prisma: {
    booking: { findMany: (...args: unknown[]) => mockBookingFindMany(...args) },
    user: { findFirst: (...args: unknown[]) => mockUserFindFirst(...args) },
  },
}));

vi.mock('@/lib/request-context', () => ({
  getRequestContext: vi.fn(),
}));

vi.mock('@/lib/rbac', () => ({
  requireRole: vi.fn(),
  ForbiddenError: class ForbiddenError extends Error {},
}));

vi.mock('@/lib/org-scope', () => ({
  whereOrg: (_orgId: string, where: unknown) => where,
}));

import { GET } from '@/app/api/sitter/bookings/route';
import { getRequestContext } from '@/lib/request-context';

describe('GET /api/sitter/bookings', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getRequestContext).mockResolvedValue({
      orgId: 'org-1',
      role: 'sitter',
      userId: 'u1',
      sitterId: 's1',
      clientId: null,
    } as never);
  });

  it('returns empty array when no bookings', async () => {
    mockBookingFindMany.mockResolvedValueOnce([]);

    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual({ bookings: [] });
  });

  it('falls back to user.sitterId when sitterId missing on session', async () => {
    vi.mocked(getRequestContext).mockResolvedValueOnce({
      orgId: 'org-1',
      role: 'sitter',
      userId: 'u1',
      sitterId: null,
      clientId: null,
    } as never);
    mockUserFindFirst.mockResolvedValueOnce({ sitterId: 's99' });
    mockBookingFindMany.mockResolvedValueOnce([]);

    const res = await GET();

    expect(res.status).toBe(200);
    expect(mockUserFindFirst).toHaveBeenCalledTimes(1);
    expect(mockBookingFindMany).toHaveBeenCalledTimes(1);
  });

  it('returns 403 when authenticated user has no sitter profile', async () => {
    vi.mocked(getRequestContext).mockResolvedValueOnce({
      orgId: 'org-1',
      role: 'sitter',
      userId: 'u1',
      sitterId: null,
      clientId: null,
    } as never);
    mockUserFindFirst.mockResolvedValueOnce({ sitterId: null });

    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(403);
    expect(body.error).toBe('Sitter profile not found for user');
    expect(mockBookingFindMany).not.toHaveBeenCalled();
  });
});
