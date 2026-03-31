/**
 * GDPR export endpoint tests (Batch 12)
 * - Owner can export any client in org (200)
 * - Sitter/client cannot export other clients (403/404)
 * - EventLog emitted for export requested/completed
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('@/lib/request-context', () => ({
  getRequestContext: vi.fn(),
}));

vi.mock('@/lib/tenancy', () => ({
  getScopedDb: vi.fn(() => ({
    client: { findFirst: vi.fn() },
  })),
}));

vi.mock('@/lib/export-client-data', () => ({
  buildClientExportBundle: vi.fn(),
}));

vi.mock('@/lib/log-event', () => ({
  logEvent: vi.fn().mockResolvedValue(undefined),
}));

import { getRequestContext } from '@/lib/request-context';
import { getScopedDb } from '@/lib/tenancy';
import { buildClientExportBundle } from '@/lib/export-client-data';
import { logEvent } from '@/lib/log-event';
import { POST } from '@/app/api/ops/clients/[clientId]/export/route';

describe('export ops clients', () => {
  const mockDb = {
    client: { findFirst: vi.fn() },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    (getScopedDb as any).mockReturnValue(mockDb);
  });

  it('owner can export any client in org (200)', async () => {
    (getRequestContext as any).mockResolvedValue({
      orgId: 'org-1',
      role: 'owner',
      userId: 'u1',
    });
    (mockDb.client.findFirst as any).mockResolvedValue({ id: 'client-1' });
    (buildClientExportBundle as any).mockResolvedValue({
      exportedAt: new Date().toISOString(),
      client: { id: 'client-1', firstName: 'Jane', lastName: 'Doe' },
      pets: [],
      bookings: [],
      reports: [],
      messages: [],
      payments: { charges: [], refunds: [] },
    });

    const res = await POST(new Request('http://localhost/api/ops/clients/client-1/export'), {
      params: Promise.resolve({ clientId: 'client-1' }),
    });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.client.id).toBe('client-1');
    expect(logEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'client.export.requested',
        entityId: 'client-1',
        metadata: expect.objectContaining({ clientId: 'client-1' }),
      })
    );
    expect(logEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'client.export.completed',
        entityId: 'client-1',
      })
    );
  });

  it('returns 404 when client not found in org', async () => {
    (getRequestContext as any).mockResolvedValue({
      orgId: 'org-1',
      role: 'owner',
      userId: 'u1',
    });
    (mockDb.client.findFirst as any).mockResolvedValue(null);

    const res = await POST(new Request('http://localhost/api/ops/clients/client-other/export'), {
      params: Promise.resolve({ clientId: 'client-other' }),
    });
    const body = await res.json();

    expect(res.status).toBe(404);
    expect(body.error).toBe('Client not found');
    expect(buildClientExportBundle).not.toHaveBeenCalled();
  });

  it('returns 403 when role is sitter', async () => {
    (getRequestContext as any).mockResolvedValue({
      orgId: 'org-1',
      role: 'sitter',
      sitterId: 's1',
      userId: 'u1',
    });

    const res = await POST(new Request('http://localhost/api/ops/clients/client-1/export'), {
      params: Promise.resolve({ clientId: 'client-1' }),
    });
    const body = await res.json();

    expect(res.status).toBe(403);
    expect(body.error).toBe('Forbidden');
    expect(getScopedDb).not.toHaveBeenCalled();
  });

  it('returns 403 when role is client', async () => {
    (getRequestContext as any).mockResolvedValue({
      orgId: 'org-1',
      role: 'client',
      clientId: 'c1',
      userId: 'u1',
    });

    const res = await POST(new Request('http://localhost/api/ops/clients/client-1/export'), {
      params: Promise.resolve({ clientId: 'client-1' }),
    });
    const body = await res.json();

    expect(res.status).toBe(403);
    expect(body.error).toBe('Forbidden');
  });
});
