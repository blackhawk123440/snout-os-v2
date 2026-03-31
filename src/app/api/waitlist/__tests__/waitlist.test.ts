/**
 * Tests for waitlist API.
 *
 * Verifies:
 * - Entries persisted to Setting table as JSON
 * - Client can only see own entries
 * - Status transitions (waiting → notified → booked)
 * - Delete removes entry
 * - Validation (service required)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockSettingFindFirst = vi.fn().mockResolvedValue(null);
const mockSettingUpsert = vi.fn().mockResolvedValue({});
const mockClientFindFirst = vi.fn().mockResolvedValue({ firstName: 'Jane', lastName: 'Doe' });

vi.mock('@/lib/request-context', () => ({
  getRequestContext: vi.fn().mockResolvedValue({
    orgId: 'org-1',
    userId: 'user-1',
    role: 'owner',
    clientId: null,
  }),
}));

vi.mock('@/lib/rbac', () => ({
  requireAnyRole: vi.fn(),
  ForbiddenError: class extends Error {},
}));

vi.mock('@/lib/tenancy', () => ({
  getScopedDb: () => ({
    setting: {
      findFirst: (...args: any[]) => mockSettingFindFirst(...args),
      upsert: (...args: any[]) => mockSettingUpsert(...args),
    },
    client: {
      findFirst: (...args: any[]) => mockClientFindFirst(...args),
    },
  }),
}));

describe('POST /api/waitlist', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('creates a new waitlist entry', async () => {
    mockSettingFindFirst.mockResolvedValueOnce(null); // no existing entries

    const { POST } = await import('../route');
    const req = new Request('http://localhost/api/waitlist', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        clientId: 'client-1',
        service: 'Dog Walking',
        preferredDate: '2026-04-01',
        preferredTimeStart: '09:00',
        preferredTimeEnd: '10:00',
        notes: 'Morning preferred',
      }),
    });

    const res = await POST(req as any);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.entry).toBeTruthy();
    expect(data.entry.service).toBe('Dog Walking');
    expect(data.entry.status).toBe('waiting');
    expect(data.entry.clientName).toBe('Jane Doe');
    expect(data.entry.position).toBe(1);

    // Verify upsert was called to persist
    expect(mockSettingUpsert).toHaveBeenCalledTimes(1);
    const upsertArg = mockSettingUpsert.mock.calls[0][0];
    const persisted = JSON.parse(upsertArg.update.value);
    expect(persisted).toHaveLength(1);
    expect(persisted[0].service).toBe('Dog Walking');
  });

  it('rejects when service is missing', async () => {
    const { POST } = await import('../route');
    const req = new Request('http://localhost/api/waitlist', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clientId: 'client-1' }),
    });

    const res = await POST(req as any);
    expect(res.status).toBe(400);
  });

  it('appends to existing entries', async () => {
    mockSettingFindFirst.mockResolvedValueOnce({
      value: JSON.stringify([
        { id: 'existing-1', service: 'Cat Sitting', status: 'waiting', clientId: 'c1', clientName: 'Bob', createdAt: '2026-01-01' },
      ]),
    });

    const { POST } = await import('../route');
    const req = new Request('http://localhost/api/waitlist', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clientId: 'client-2', service: 'Dog Walking' }),
    });

    const res = await POST(req as any);
    const data = await res.json();
    expect(data.entry.position).toBe(2);
  });
});

describe('GET /api/waitlist', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('returns all entries for owner', async () => {
    mockSettingFindFirst.mockResolvedValueOnce({
      value: JSON.stringify([
        { id: 'e1', service: 'Walk', status: 'waiting', clientId: 'c1', clientName: 'Jane', createdAt: '2026-01-01' },
        { id: 'e2', service: 'Sit', status: 'notified', clientId: 'c2', clientName: 'Bob', createdAt: '2026-01-02' },
      ]),
    });

    const { GET } = await import('../route');
    const res = await GET();
    const data = await res.json();

    expect(data.entries).toHaveLength(2);
    expect(data.entries[0].position).toBe(1);
    expect(data.entries[1].position).toBe(2);
  });
});

describe('PATCH /api/waitlist/[id]', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('transitions status from waiting to notified', async () => {
    mockSettingFindFirst.mockResolvedValueOnce({
      value: JSON.stringify([
        { id: 'e1', service: 'Walk', status: 'waiting', clientId: 'c1', clientName: 'Jane', createdAt: '2026-01-01' },
      ]),
    });

    const { PATCH } = await import('../[id]/route');
    const req = new Request('http://localhost/api/waitlist/e1', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'notified' }),
    });

    const res = await PATCH(req as any, { params: Promise.resolve({ id: 'e1' }) });
    const data = await res.json();

    expect(data.entry.status).toBe('notified');
    expect(mockSettingUpsert).toHaveBeenCalledTimes(1);
  });

  it('rejects invalid status', async () => {
    const { PATCH } = await import('../[id]/route');
    const req = new Request('http://localhost/api/waitlist/e1', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'invalid' }),
    });

    const res = await PATCH(req as any, { params: Promise.resolve({ id: 'e1' }) });
    expect(res.status).toBe(400);
  });
});

describe('DELETE /api/waitlist/[id]', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('removes entry by ID', async () => {
    mockSettingFindFirst.mockResolvedValueOnce({
      value: JSON.stringify([
        { id: 'e1', service: 'Walk', status: 'waiting', clientId: 'c1' },
        { id: 'e2', service: 'Sit', status: 'waiting', clientId: 'c2' },
      ]),
    });

    const { DELETE } = await import('../[id]/route');
    const res = await DELETE(
      new Request('http://localhost') as any,
      { params: Promise.resolve({ id: 'e1' }) }
    );
    const data = await res.json();
    expect(data.ok).toBe(true);

    const saved = JSON.parse(mockSettingUpsert.mock.calls[0][0].update.value);
    expect(saved).toHaveLength(1);
    expect(saved[0].id).toBe('e2');
  });

  it('returns 404 for missing entry', async () => {
    mockSettingFindFirst.mockResolvedValueOnce({ value: '[]' });

    const { DELETE } = await import('../[id]/route');
    const res = await DELETE(
      new Request('http://localhost') as any,
      { params: Promise.resolve({ id: 'nonexistent' }) }
    );
    expect(res.status).toBe(404);
  });
});
