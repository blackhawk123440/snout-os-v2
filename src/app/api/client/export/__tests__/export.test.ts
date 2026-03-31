/**
 * Client self-export tests (Batch 12)
 * - Client self-export works (200) and does not leak other clients
 * - Returns 403 when clientId missing
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('@/lib/request-context', () => ({
  getRequestContext: vi.fn(),
}));

vi.mock('@/lib/tenancy', () => ({
  getScopedDb: vi.fn(() => ({
    client: {
      findFirst: vi.fn().mockResolvedValue({ id: 'client-a', deletedAt: null }),
    },
  })),
}));

vi.mock('@/lib/export-client-data', () => ({
  buildClientExportBundle: vi.fn(),
}));

vi.mock('@/lib/log-event', () => ({
  logEvent: vi.fn().mockResolvedValue(undefined),
}));

import { getRequestContext } from '@/lib/request-context';
import { buildClientExportBundle } from '@/lib/export-client-data';
import { logEvent } from '@/lib/log-event';
import { GET } from '@/app/api/client/export/route';

describe('export client self', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('client self-export works (200) and does not leak other clients', async () => {
    (getRequestContext as any).mockResolvedValue({
      orgId: 'org-1',
      role: 'client',
      clientId: 'client-a',
      userId: 'u1',
    });
    (buildClientExportBundle as any).mockResolvedValue({
      exportedAt: new Date().toISOString(),
      client: { id: 'client-a', firstName: 'Jane', lastName: 'Doe' },
      pets: [],
      bookings: [],
      reports: [],
      messages: [],
      payments: { charges: [], refunds: [] },
    });

    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.client.id).toBe('client-a');
    expect(buildClientExportBundle).toHaveBeenCalledWith(
      expect.anything(),
      'org-1',
      'client-a'
    );
    expect(logEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'client.export.requested',
        entityId: 'client-a',
        metadata: expect.objectContaining({ clientId: 'client-a', requestedBy: 'client_self' }),
      })
    );
    expect(logEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'client.export.completed',
        entityId: 'client-a',
      })
    );
  });

  it('returns 403 when clientId is missing on session', async () => {
    (getRequestContext as any).mockResolvedValue({
      orgId: 'org-1',
      role: 'client',
      clientId: null,
      userId: 'u1',
    });

    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(403);
    expect(body.error).toBe('Forbidden');
    expect(buildClientExportBundle).not.toHaveBeenCalled();
  });
});
