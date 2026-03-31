/**
 * Ops calendar repair endpoint is owner/admin only and org-scoped.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('@/lib/request-context', () => ({
  getRequestContext: vi.fn(),
}));

vi.mock('@/lib/tenancy', () => ({
  getScopedDb: vi.fn(() => ({
    sitter: {
      findUnique: vi.fn().mockResolvedValue({ id: 's1', orgId: 'org-1' }),
    },
  })),
}));

vi.mock('@/lib/calendar-queue', () => ({
  enqueueCalendarSync: vi.fn().mockResolvedValue('job-123'),
}));

vi.mock('@/lib/log-event', () => ({
  logEvent: vi.fn().mockResolvedValue(undefined),
}));

import { POST } from '@/app/api/ops/calendar/repair/route';
import { getRequestContext } from '@/lib/request-context';

describe('ops calendar repair owner-only', () => {
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

    const response = await POST(
      new Request('http://localhost/api/ops/calendar/repair', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sitterId: 's1' }),
      })
    );
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

    const response = await POST(
      new Request('http://localhost/api/ops/calendar/repair', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sitterId: 's1' }),
      })
    );
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.error).toBe('Forbidden');
  });

  it('returns 200 and enqueues job when role is owner', async () => {
    (getRequestContext as any).mockResolvedValue({
      orgId: 'org-1',
      role: 'owner',
      userId: 'u1',
    });

    const response = await POST(
      new Request('http://localhost/api/ops/calendar/repair', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sitterId: 's1' }),
      })
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.jobId).toBe('job-123');
    expect(body.range).toBeDefined();
  });

  it('returns 200 when role is admin', async () => {
    (getRequestContext as any).mockResolvedValue({
      orgId: 'org-1',
      role: 'admin',
      userId: 'u1',
    });

    const response = await POST(
      new Request('http://localhost/api/ops/calendar/repair', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sitterId: 's1' }),
      })
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
  });

  it('returns 404 when sitter not found (org-scoped)', async () => {
    const { getScopedDb } = await import('@/lib/tenancy');
    (getRequestContext as any).mockResolvedValue({
      orgId: 'org-1',
      role: 'owner',
      userId: 'u1',
    });
    (getScopedDb as any).mockReturnValue({
      sitter: { findUnique: vi.fn().mockResolvedValue(null) },
    });

    const response = await POST(
      new Request('http://localhost/api/ops/calendar/repair', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sitterId: 'nonexistent' }),
      })
    );
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body.error).toBe('Sitter not found');
  });

  it('returns 400 when sitterId missing', async () => {
    (getRequestContext as any).mockResolvedValue({
      orgId: 'org-1',
      role: 'owner',
      userId: 'u1',
    });

    const response = await POST(
      new Request('http://localhost/api/ops/calendar/repair', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toContain('sitterId');
  });
});
