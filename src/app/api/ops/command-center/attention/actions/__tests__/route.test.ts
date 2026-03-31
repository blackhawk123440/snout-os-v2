import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const mockDb = {
  commandCenterAttentionState: {
    upsert: vi.fn(),
  },
  eventLog: {
    create: vi.fn(),
  },
};

vi.mock('@/lib/request-context', () => ({
  getRequestContext: vi.fn(),
}));
vi.mock('@/lib/rbac', () => ({
  ForbiddenError: class ForbiddenError extends Error {},
  requireOwnerOrAdmin: vi.fn(),
}));
vi.mock('@/lib/tenancy', () => ({
  getScopedDb: vi.fn(() => mockDb),
}));

import { POST } from '@/app/api/ops/command-center/attention/actions/route';
import { getRequestContext } from '@/lib/request-context';

function makeReq(body: unknown) {
  return new NextRequest('http://localhost/api/ops/command-center/attention/actions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('POST /api/ops/command-center/attention/actions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (getRequestContext as any).mockResolvedValue({
      orgId: 'org-1',
      role: 'owner',
      userId: 'owner-1',
    });
    mockDb.commandCenterAttentionState.upsert.mockResolvedValue({});
    mockDb.eventLog.create.mockResolvedValue({});
  });

  it('persists snooze and writes event log', async () => {
    const res = await POST(makeReq({ id: 'automation_failure:evt-1', action: 'snooze_1h' }));
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.snoozedUntil).toBeTruthy();
    expect(mockDb.eventLog.create).toHaveBeenCalledTimes(1);
  });

  it('persists handled and writes event log', async () => {
    const res = await POST(makeReq({ id: 'unassigned:booking-1', action: 'mark_handled' }));
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.handledAt).toBeTruthy();
    expect(mockDb.eventLog.create).toHaveBeenCalledTimes(1);
  });
});

