import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { createHmac } from 'crypto';

const mockDb = {
  booking: {
    findFirst: vi.fn(),
    update: vi.fn(),
  },
  sitter: {
    findFirst: vi.fn(),
    findMany: vi.fn(),
  },
  setting: {
    findUnique: vi.fn(),
    findFirst: vi.fn(),
  },
  commandCenterAttentionState: {
    findFirst: vi.fn(),
    deleteMany: vi.fn(),
    upsert: vi.fn(),
  },
  eventLog: {
    findFirst: vi.fn(),
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
vi.mock('@/lib/dispatch-control', () => ({
  forceAssignSitter: vi.fn(),
}));
vi.mock('@/lib/log-event', () => ({
  logEvent: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('@/lib/rate-limit', () => ({
  checkRateLimit: vi.fn().mockResolvedValue({ success: true, remaining: 1, resetAt: 9999999999 }),
  getRateLimitIdentifier: vi.fn().mockReturnValue('127.0.0.1'),
  rateLimitResponse: vi.fn(() => new Response(JSON.stringify({ error: 'Too many requests' }), { status: 429 })),
}));
vi.mock('@/lib/calendar-queue', () => ({
  enqueueCalendarSync: vi.fn().mockResolvedValue('job-id'),
}));

import { POST } from '@/app/api/ops/command-center/staffing/resolve/route';
import { getRequestContext } from '@/lib/request-context';
import { forceAssignSitter } from '@/lib/dispatch-control';
import { enqueueCalendarSync } from '@/lib/calendar-queue';

function makeReq(body: unknown) {
  return new NextRequest('http://localhost/api/ops/command-center/staffing/resolve', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('POST /api/ops/command-center/staffing/resolve', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (getRequestContext as any).mockResolvedValue({
      orgId: 'org-1',
      role: 'owner',
      userId: 'owner-1',
    });
    mockDb.eventLog.create.mockResolvedValue({ id: 'evt-1' });
    mockDb.setting.findUnique.mockResolvedValue(null);
    mockDb.sitter.findFirst.mockResolvedValue(null);
  });

  it('assign success', async () => {
    mockDb.booking.findFirst
      .mockResolvedValueOnce({
        id: 'booking-1',
        orgId: 'org-1',
        firstName: 'Client',
        lastName: 'One',
        service: 'Dog Walk',
        sitterId: null,
        status: 'pending',
        dispatchStatus: 'manual_required',
        startAt: new Date('2026-03-05T10:00:00.000Z'),
        endAt: new Date('2026-03-05T11:00:00.000Z'),
      })
      .mockResolvedValueOnce(null);
    mockDb.eventLog.findFirst.mockResolvedValue(null);
    mockDb.commandCenterAttentionState.findFirst.mockResolvedValue(null);
    (forceAssignSitter as any).mockResolvedValue(undefined);

    const res = await POST(
      makeReq({
        itemId: 'unassigned:booking-1',
        action: 'assign_notify',
        sitterId: 'sitter-1',
      })
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.assignmentId).toBe('staffing_assign:booking-1');
    expect(body.bookingId).toBe('booking-1');
    expect(body.sitterId).toBe('sitter-1');
    expect(typeof body.rollbackToken).toBe('string');
    expect(body.notifySent).toBe(true);
  });

  it('no available sitter', async () => {
    mockDb.booking.findFirst
      .mockResolvedValueOnce({
        id: 'booking-1',
        orgId: 'org-1',
        firstName: 'Client',
        lastName: 'One',
        service: 'Dog Walk',
        sitterId: null,
        status: 'pending',
        dispatchStatus: 'manual_required',
        startAt: new Date('2026-03-05T10:00:00.000Z'),
        endAt: new Date('2026-03-05T11:00:00.000Z'),
      })
      .mockResolvedValueOnce({ id: 'overlap-1' });
    mockDb.eventLog.findFirst.mockResolvedValue(null);

    const res = await POST(
      makeReq({
        itemId: 'unassigned:booking-1',
        action: 'assign_notify',
        sitterId: 's1',
      })
    );
    const body = await res.json();
    expect(res.status).toBe(409);
    expect(body.error).toContain('overlapping confirmed booking');
  });

  it('idempotent retry', async () => {
    mockDb.booking.findFirst.mockResolvedValue({
      id: 'booking-1',
      orgId: 'org-1',
      firstName: 'Client',
      lastName: 'One',
      service: 'Dog Walk',
      sitterId: 'sitter-1',
      status: 'confirmed',
      dispatchStatus: 'assigned',
      startAt: new Date('2026-03-05T10:00:00.000Z'),
      endAt: new Date('2026-03-05T11:00:00.000Z'),
    });
    mockDb.eventLog.findFirst.mockResolvedValue({
      metadata: JSON.stringify({
        assignmentId: 'staffing_assign:booking-1',
        sitterId: 'sitter-1',
        rollbackTokenId: 'rbk_booking-1_token-1',
        notifySent: true,
      }),
    });

    const res = await POST(
      makeReq({
        itemId: 'unassigned:booking-1',
        action: 'assign_notify',
      })
    );
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.idempotent).toBe(true);
    expect(body.sitterId).toBe('sitter-1');
    expect(body.notifySent).toBe(true);
    expect(typeof body.rollbackToken).toBe('string');
  });

  it('rollback success', async () => {
    const tokenId = 'rbk_booking-1_token-1';
    const assignmentId = 'staffing_assign:booking-1';
    const actorUserId = 'owner-1';
    const secret =
      process.env.ROLLBACK_TOKEN_SECRET ||
      process.env.NEXTAUTH_SECRET ||
      'dev-rollback-token-secret-change-me';
    const sig = createHmac('sha256', secret)
      .update(`${tokenId}:${assignmentId}:booking-1:${actorUserId}`)
      .digest('base64url');
    const rollbackToken = Buffer.from(`${tokenId}:${assignmentId}:${sig}`).toString('base64url');

    mockDb.booking.findFirst.mockResolvedValue({
      id: 'booking-1',
      orgId: 'org-1',
      firstName: 'Client',
      lastName: 'One',
      service: 'Dog Walk',
      sitterId: 'sitter-1',
      status: 'confirmed',
      dispatchStatus: 'assigned',
      startAt: new Date('2026-03-05T10:00:00.000Z'),
      endAt: new Date('2026-03-05T11:00:00.000Z'),
    });
    mockDb.eventLog.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        metadata: JSON.stringify({
          tokenId,
          actorUserId,
          bookingId: 'booking-1',
          previousSitterId: null,
          previousStatus: 'pending',
          previousDispatchStatus: 'manual_required',
          previousAttentionState: null,
        }),
      });
    mockDb.booking.update.mockResolvedValue({ id: 'booking-1' });
    mockDb.commandCenterAttentionState.deleteMany.mockResolvedValue({ count: 1 });
    mockDb.eventLog.create.mockResolvedValue({ id: 'evt-used' });

    const res = await POST(
      makeReq({
        itemId: 'unassigned:booking-1',
        action: 'rollback',
        rollbackToken,
      })
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.assignmentId).toBe('staffing_assign:booking-1');
    expect(body.sitterId).toBe(null);
    // Calendar consistency: rollback must enqueue delete for old sitter (no upsert when previousSitterId is null)
    expect(enqueueCalendarSync).toHaveBeenCalledWith({
      type: 'delete',
      bookingId: 'booking-1',
      sitterId: 'sitter-1',
      orgId: 'org-1',
    });
  });

  it('rollback invalid token', async () => {
    mockDb.booking.findFirst.mockResolvedValue({
      id: 'booking-1',
      orgId: 'org-1',
      firstName: 'Client',
      lastName: 'One',
      service: 'Dog Walk',
      sitterId: 'sitter-1',
      status: 'confirmed',
      dispatchStatus: 'assigned',
      startAt: new Date('2026-03-05T10:00:00.000Z'),
      endAt: new Date('2026-03-05T11:00:00.000Z'),
    });
    const res = await POST(
      makeReq({
        itemId: 'unassigned:booking-1',
        action: 'rollback',
        rollbackToken: 'bad-token',
      })
    );
    expect(res.status).toBe(400);
  });

  it('cross-org protection (booking not found in scoped db)', async () => {
    mockDb.booking.findFirst.mockResolvedValue(null);
    const res = await POST(
      makeReq({
        itemId: 'unassigned:booking-other-org',
        action: 'assign_notify',
      })
    );
    expect(res.status).toBe(404);
  });

  it('allows overlap item resolution by targeting first booking id', async () => {
    mockDb.booking.findFirst
      .mockResolvedValueOnce({
        id: 'booking-a',
        orgId: 'org-1',
        firstName: 'Client',
        lastName: 'Overlap',
        service: 'Walk',
        sitterId: null,
        status: 'pending',
        dispatchStatus: 'manual_required',
        startAt: new Date('2026-03-05T10:00:00.000Z'),
        endAt: new Date('2026-03-05T11:00:00.000Z'),
      })
      .mockResolvedValueOnce(null);
    mockDb.eventLog.findFirst.mockResolvedValue(null);
    mockDb.commandCenterAttentionState.findFirst.mockResolvedValue(null);
    (forceAssignSitter as any).mockResolvedValue(undefined);

    const res = await POST(
      makeReq({
        itemId: 'overlap:booking-a_booking-b',
        action: 'assign_notify',
        sitterId: 'sitter-1',
      })
    );
    expect(res.status).toBe(200);
  });
});
