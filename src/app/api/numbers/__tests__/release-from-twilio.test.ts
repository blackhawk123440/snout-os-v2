/**
 * Tests for POST /api/numbers/[id]/release-from-twilio
 *
 * Covers:
 * - Successful Twilio release + DB update
 * - Idempotency (already released)
 * - Twilio 404 (number already gone) → still marks as released
 * - Twilio failure → DB status unchanged, honest error
 * - No providerNumberSid → falls back to e164 lookup
 * - Missing number record → 404
 * - DB update failure after Twilio release → reports inconsistency
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock getRequestContext
vi.mock('@/lib/request-context', () => ({
  getRequestContext: vi.fn().mockResolvedValue({
    orgId: 'org-1',
    userId: 'user-1',
    role: 'owner',
  }),
}));

// Mock DB
const mockFindFirst = vi.fn();
const mockUpdate = vi.fn().mockResolvedValue({});
const mockEventLogCreate = vi.fn().mockResolvedValue({ id: 'evt-1' });

vi.mock('@/lib/tenancy', () => ({
  getScopedDb: () => ({
    messageNumber: {
      findFirst: (...args: any[]) => mockFindFirst(...args),
      update: (...args: any[]) => mockUpdate(...args),
    },
  }),
}));

vi.mock('@/lib/db', () => ({
  prisma: {
    eventLog: { create: (...args: any[]) => mockEventLogCreate(...args) },
  },
}));

// Mock Twilio client
const mockTwilioRemove = vi.fn();
const mockTwilioList = vi.fn();
const mockTwilioClient = {
  incomingPhoneNumbers: Object.assign(
    (sid: string) => ({ remove: mockTwilioRemove }),
    { list: mockTwilioList }
  ),
};

vi.mock('@/lib/messaging/provider-credentials', () => ({
  getProviderCredentials: vi.fn().mockResolvedValue({
    accountSid: 'AC_test',
    authToken: 'test_token',
    source: 'environment',
  }),
  getTwilioClientFromCredentials: vi.fn().mockReturnValue(mockTwilioClient),
}));

function makeRequest() {
  return new Request('http://localhost/api/numbers/num-1/release-from-twilio', {
    method: 'POST',
  });
}

const context = { params: Promise.resolve({ id: 'num-1' }) };

describe('release-from-twilio', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('releases from Twilio and updates DB on success', async () => {
    mockFindFirst.mockResolvedValueOnce({
      id: 'num-1',
      e164: '+15551234567',
      provider: 'twilio',
      providerNumberSid: 'PN_abc123',
      status: 'active',
      numberClass: 'pool',
      assignedSitterId: null,
      _count: { MessageThread: 0 },
    });
    mockTwilioRemove.mockResolvedValueOnce(true);

    const { POST } = await import('../[id]/release-from-twilio/route');
    const res = await POST(makeRequest() as any, context);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.message).toContain('+15551234567');

    // Verify Twilio was called
    expect(mockTwilioRemove).toHaveBeenCalledTimes(1);

    // Verify DB update
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'num-1' },
        data: expect.objectContaining({
          status: 'released',
          assignedSitterId: null,
          assignedThreadId: null,
        }),
      })
    );

    // Verify audit event
    expect(mockEventLogCreate).toHaveBeenCalled();
    const auditCall = mockEventLogCreate.mock.calls.find(
      (c: any) => c[0]?.data?.eventType === 'number.released_from_twilio'
    );
    expect(auditCall).toBeTruthy();
  });

  it('returns success if already released (idempotent)', async () => {
    mockFindFirst.mockResolvedValueOnce({
      id: 'num-1',
      e164: '+15551234567',
      status: 'released',
      _count: { MessageThread: 0 },
    });

    const { POST } = await import('../[id]/release-from-twilio/route');
    const res = await POST(makeRequest() as any, context);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.alreadyReleased).toBe(true);
    expect(mockTwilioRemove).not.toHaveBeenCalled();
  });

  it('treats Twilio 404 as success (number already gone)', async () => {
    mockFindFirst.mockResolvedValueOnce({
      id: 'num-1',
      e164: '+15551234567',
      providerNumberSid: 'PN_abc123',
      status: 'active',
      _count: { MessageThread: 0 },
    });
    mockTwilioRemove.mockRejectedValueOnce({ code: 20404, status: 404, message: 'not found' });

    const { POST } = await import('../[id]/release-from-twilio/route');
    const res = await POST(makeRequest() as any, context);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.twilioNote).toContain('404');
    // DB should still be updated to 'released'
    expect(mockUpdate).toHaveBeenCalled();
  });

  it('returns 502 and leaves DB unchanged on Twilio failure', async () => {
    mockFindFirst.mockResolvedValueOnce({
      id: 'num-1',
      e164: '+15551234567',
      providerNumberSid: 'PN_abc123',
      status: 'active',
      _count: { MessageThread: 0 },
    });
    mockTwilioRemove.mockRejectedValueOnce(new Error('Twilio service unavailable'));

    const { POST } = await import('../[id]/release-from-twilio/route');
    const res = await POST(makeRequest() as any, context);
    const data = await res.json();

    expect(res.status).toBe(502);
    expect(data.error).toContain('Twilio service unavailable');
    expect(data.numberStatus).toBe('active'); // DB status unchanged
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it('falls back to e164 lookup when no providerNumberSid', async () => {
    mockFindFirst.mockResolvedValueOnce({
      id: 'num-1',
      e164: '+15551234567',
      providerNumberSid: '',
      status: 'active',
      _count: { MessageThread: 0 },
    });
    mockTwilioList.mockResolvedValueOnce([{ sid: 'PN_found' }]);
    // The remove call is on the found SID
    mockTwilioRemove.mockResolvedValueOnce(true);

    const { POST } = await import('../[id]/release-from-twilio/route');
    const res = await POST(makeRequest() as any, context);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
    expect(mockTwilioList).toHaveBeenCalledWith(
      expect.objectContaining({ phoneNumber: '+15551234567' })
    );
  });

  it('returns 404 when number record not found', async () => {
    mockFindFirst.mockResolvedValueOnce(null);

    const { POST } = await import('../[id]/release-from-twilio/route');
    const res = await POST(makeRequest() as any, context);

    expect(res.status).toBe(404);
  });

  it('reports inconsistency when Twilio succeeds but DB fails', async () => {
    mockFindFirst.mockResolvedValueOnce({
      id: 'num-1',
      e164: '+15551234567',
      providerNumberSid: 'PN_abc123',
      status: 'active',
      _count: { MessageThread: 0 },
    });
    mockTwilioRemove.mockResolvedValueOnce(true);
    mockUpdate.mockRejectedValueOnce(new Error('DB connection lost'));

    const { POST } = await import('../[id]/release-from-twilio/route');
    const res = await POST(makeRequest() as any, context);
    const data = await res.json();

    expect(res.status).toBe(500);
    expect(data.twilioReleased).toBe(true);
    expect(data.dbError).toContain('DB connection lost');

    // Verify inconsistency is logged
    const failLog = mockEventLogCreate.mock.calls.find(
      (c: any) => c[0]?.data?.eventType === 'number.release_db_update_failed'
    );
    expect(failLog).toBeTruthy();
  });

  it('reports active threads that will be orphaned', async () => {
    mockFindFirst.mockResolvedValueOnce({
      id: 'num-1',
      e164: '+15551234567',
      providerNumberSid: 'PN_abc123',
      status: 'active',
      _count: { MessageThread: 3 },
    });
    mockTwilioRemove.mockResolvedValueOnce(true);

    const { POST } = await import('../[id]/release-from-twilio/route');
    const res = await POST(makeRequest() as any, context);
    const data = await res.json();

    expect(data.activeThreadsOrphaned).toBe(3);
  });
});
