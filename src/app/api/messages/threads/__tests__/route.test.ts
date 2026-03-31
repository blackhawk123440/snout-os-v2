import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GET } from '@/app/api/messages/threads/route';

const mockFindMany = vi.fn();

vi.mock('@/lib/request-context', () => ({
  getRequestContext: vi.fn(),
}));

vi.mock('@/lib/tenancy', () => ({
  getScopedDb: vi.fn(() => ({
    messageThread: {
      findMany: (...args: unknown[]) => mockFindMany(...args),
    },
  })),
}));

vi.mock('@/lib/messaging/thread-number', () => ({
  ensureThreadHasMessageNumber: vi.fn().mockResolvedValue(null),
}));

import { getRequestContext } from '@/lib/request-context';

describe('GET /api/messages/threads', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(Math, 'random').mockReturnValue(0);
    vi.mocked(getRequestContext).mockResolvedValue({
      orgId: 'org-1',
      role: 'owner',
      userId: 'owner-1',
    } as never);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns cursor pagination metadata', async () => {
    mockFindMany
      .mockResolvedValueOnce([]) // missingLinks
      .mockResolvedValueOnce([
        {
          id: 't1',
          orgId: 'org-1',
          clientId: 'c1',
          assignedSitterId: null,
          status: 'open',
          threadType: 'front_desk',
          lastMessageAt: new Date('2026-03-01T10:00:00.000Z'),
          createdAt: new Date('2026-03-01T09:00:00.000Z'),
          messageNumber: { id: 'n1', e164: '+15550001', numberClass: 'front_desk', status: 'active' },
          assignmentWindows: [],
          client: { id: 'c1', firstName: 'Client', lastName: 'One' },
          sitter: null,
        },
        {
          id: 't2',
          orgId: 'org-1',
          clientId: 'c2',
          assignedSitterId: null,
          status: 'open',
          threadType: 'front_desk',
          lastMessageAt: new Date('2026-03-01T09:00:00.000Z'),
          createdAt: new Date('2026-03-01T08:00:00.000Z'),
          messageNumber: { id: 'n2', e164: '+15550002', numberClass: 'front_desk', status: 'active' },
          assignmentWindows: [],
          client: { id: 'c2', firstName: 'Client', lastName: 'Two' },
          sitter: null,
        },
      ]);

    const res = await GET(new Request('http://localhost/api/messages/threads?pageSize=1') as any);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.items).toHaveLength(1);
    expect(body.nextCursor).toBe('t1');
    expect(body.hasMore).toBe(true);
    expect(body.sort).toEqual({ field: 'lastMessageAt', direction: 'desc' });
    expect(mockFindMany).toHaveBeenLastCalledWith(
      expect.objectContaining({
        take: 2,
        orderBy: [{ lastMessageAt: 'desc' }, { id: 'desc' }],
      })
    );
  });

  it('caps page size and applies cursor for stable pagination', async () => {
    mockFindMany.mockResolvedValueOnce([]); // no rows on cursor page

    const res = await GET(new Request('http://localhost/api/messages/threads?pageSize=999&cursor=t1') as any);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.items).toHaveLength(0);
    expect(body.nextCursor).toBeNull();
    expect(mockFindMany).toHaveBeenLastCalledWith(
      expect.objectContaining({
        take: 201,
        skip: 1,
        cursor: { id: 't1' },
        orderBy: [{ lastMessageAt: 'desc' }, { id: 'desc' }],
      })
    );
  });
});
