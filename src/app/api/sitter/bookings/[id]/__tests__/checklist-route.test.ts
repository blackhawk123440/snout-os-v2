import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockBookingFindFirst = vi.fn();
const mockChecklistFindUnique = vi.fn();
const mockChecklistCreate = vi.fn();
const mockChecklistUpdate = vi.fn();

vi.mock('@/lib/tenancy', () => ({
  getScopedDb: vi.fn(() => ({
    booking: {
      findFirst: (...args: unknown[]) => mockBookingFindFirst(...args),
    },
    bookingChecklistItem: {
      findUnique: (...args: unknown[]) => mockChecklistFindUnique(...args),
      create: (...args: unknown[]) => mockChecklistCreate(...args),
      update: (...args: unknown[]) => mockChecklistUpdate(...args),
    },
  })),
}));

vi.mock('@/lib/request-context', () => ({
  getRequestContext: vi.fn(),
}));

vi.mock('@/lib/rbac', () => ({
  requireRole: vi.fn(),
  ForbiddenError: class ForbiddenError extends Error {},
}));

import { getRequestContext } from '@/lib/request-context';
import { PATCH } from '@/app/api/sitter/bookings/[id]/checklist/route';

describe('PATCH /api/sitter/bookings/[id]/checklist', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getRequestContext).mockResolvedValue({
      orgId: 'org-1',
      role: 'sitter',
      userId: 'u1',
      sitterId: 's1',
      clientId: null,
    } as never);
    mockBookingFindFirst.mockResolvedValue({ id: 'b1', orgId: 'org-1' });
  });

  it('is idempotent when checked=true and item already checked', async () => {
    mockChecklistFindUnique.mockResolvedValue({
      id: 'ci1',
      checkedAt: new Date('2026-03-03T10:00:00.000Z'),
    });
    const res = await PATCH(
      new Request('http://localhost/api/sitter/bookings/b1/checklist', {
        method: 'PATCH',
        body: JSON.stringify({ type: 'arrived', checked: true }),
      }),
      { params: Promise.resolve({ id: 'b1' }) }
    );
    expect(res.status).toBe(200);
    expect(mockChecklistUpdate).not.toHaveBeenCalled();
    expect(mockChecklistCreate).not.toHaveBeenCalled();
  });

  it('blocks uncheck when checked item is older than lock window', async () => {
    mockChecklistFindUnique.mockResolvedValue({
      id: 'ci1',
      checkedAt: new Date(Date.now() - 6 * 60 * 1000),
    });
    const res = await PATCH(
      new Request('http://localhost/api/sitter/bookings/b1/checklist', {
        method: 'PATCH',
        body: JSON.stringify({ type: 'arrived', checked: false }),
      }),
      { params: Promise.resolve({ id: 'b1' }) }
    );
    expect(res.status).toBe(400);
    expect(mockChecklistUpdate).not.toHaveBeenCalled();
  });
});
