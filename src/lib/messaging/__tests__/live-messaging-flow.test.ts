/**
 * Integration-style tests for the live messaging flow.
 *
 * Tests the actual code paths that production webhook handlers use:
 * - audit-trail persistence (EventLog)
 * - alert-helpers using EventLog (not the non-existent Alert model)
 * - provider factory fallback behavior
 * - anti-poaching flag creation
 *
 * These test the real function implementations with mocked Prisma,
 * NOT mock function stubs.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---- Prisma mock setup ----
const mockEventLogCreate = vi.fn().mockResolvedValue({ id: 'evt-1' });
const mockEventLogFindFirst = vi.fn().mockResolvedValue(null);
const mockEventLogFindMany = vi.fn().mockResolvedValue([]);

vi.mock('@/lib/db', () => ({
  prisma: {
    eventLog: {
      create: (...args: any[]) => mockEventLogCreate(...args),
      findFirst: (...args: any[]) => mockEventLogFindFirst(...args),
      findMany: (...args: any[]) => mockEventLogFindMany(...args),
    },
    // These are accessed by provider-factory fallback paths
    messageAccount: { findFirst: vi.fn().mockResolvedValue(null) },
    messageNumber: { findFirst: vi.fn().mockResolvedValue(null) },
    messageConversationFlag: {
      create: vi.fn().mockResolvedValue({ id: 'flag-1' }),
    },
    messageThread: {
      findFirst: vi.fn().mockResolvedValue(null),
      findUnique: vi.fn().mockResolvedValue(null),
    },
  },
}));

vi.mock('../provider-credentials', () => ({
  getProviderCredentials: vi.fn().mockResolvedValue(null),
}));

vi.mock('../event-logger', () => ({
  logEvent: vi.fn(),
}));

describe('live messaging flow: audit trail persistence', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('logMessagingEvent persists to EventLog.create', async () => {
    const { logMessagingEvent } = await import('../audit-trail');

    await logMessagingEvent({
      orgId: 'org-1',
      eventType: 'inbound_received',
      threadId: 'thread-1',
      messageId: 'msg-1',
      metadata: { from: '+15551234567' },
    });

    expect(mockEventLogCreate).toHaveBeenCalledTimes(1);
    const arg = mockEventLogCreate.mock.calls[0][0];
    expect(arg.data.orgId).toBe('org-1');
    expect(arg.data.eventType).toBe('messaging.inbound_received');
    expect(arg.data.status).toBe('success');

    const meta = JSON.parse(arg.data.metadata);
    expect(meta.threadId).toBe('thread-1');
    expect(meta.messageId).toBe('msg-1');
    expect(meta.from).toBe('+15551234567');
  });

  it('audit trail gracefully handles DB failure without throwing', async () => {
    mockEventLogCreate.mockRejectedValueOnce(new Error('connection refused'));
    const { logMessagingEvent } = await import('../audit-trail');

    // Must not throw
    await logMessagingEvent({
      orgId: 'org-1',
      eventType: 'outbound_sent',
    });
    // If we get here, the function didn't throw
    expect(true).toBe(true);
  });
});

describe('live messaging flow: alert-helpers uses EventLog, not Alert model', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('createAlert persists to EventLog with alert. prefix', async () => {
    const { createAlert } = await import('../alert-helpers');

    await createAlert({
      orgId: 'org-1',
      severity: 'critical',
      type: 'pool.exhausted',
      title: 'Pool Numbers Exhausted',
      description: 'All pool numbers at capacity',
      entityType: 'pool',
    });

    // Should have created EventLog entry (not Alert)
    expect(mockEventLogCreate).toHaveBeenCalled();
    const createCalls = mockEventLogCreate.mock.calls;
    // Find the alert EventLog create (not the logMessagingEvent one)
    const alertCreate = createCalls.find(
      (c: any) => c[0]?.data?.eventType === 'alert.pool.exhausted'
    );
    expect(alertCreate).toBeTruthy();
    expect(alertCreate[0].data.status).toBe('pending');

    const meta = JSON.parse(alertCreate[0].data.metadata);
    expect(meta.severity).toBe('critical');
    expect(meta.title).toBe('Pool Numbers Exhausted');
  });

  it('createAlert deduplicates within 24h window', async () => {
    // Simulate existing open alert
    mockEventLogFindFirst.mockResolvedValueOnce({
      id: 'existing-alert',
      eventType: 'alert.pool.exhausted',
      status: 'pending',
    });

    const { createAlert } = await import('../alert-helpers');

    await createAlert({
      orgId: 'org-1',
      severity: 'critical',
      type: 'pool.exhausted',
      title: 'Pool Numbers Exhausted',
      description: 'All pool numbers at capacity',
    });

    // Should NOT create a new EventLog entry for the alert itself
    const alertCreates = mockEventLogCreate.mock.calls.filter(
      (c: any) => c[0]?.data?.eventType === 'alert.pool.exhausted'
    );
    expect(alertCreates).toHaveLength(0);
  });

  it('createAlert does not throw on DB failure', async () => {
    mockEventLogFindFirst.mockRejectedValueOnce(new Error('DB down'));
    const { createAlert } = await import('../alert-helpers');

    // Must not throw — pool exhaustion caller depends on this
    await createAlert({
      orgId: 'org-1',
      severity: 'critical',
      type: 'pool.exhausted',
      title: 'test',
      description: 'test',
    });
    expect(true).toBe(true);
  });

  it('getOpenAlerts returns parsed EventLog rows', async () => {
    mockEventLogFindMany.mockResolvedValueOnce([
      {
        id: 'evt-1',
        orgId: 'org-1',
        eventType: 'alert.pool.exhausted',
        status: 'pending',
        metadata: JSON.stringify({
          severity: 'critical',
          title: 'Pool Exhausted',
          description: 'All numbers at capacity',
        }),
        createdAt: new Date(),
      },
    ]);

    const { getOpenAlerts } = await import('../alert-helpers');
    const alerts = await getOpenAlerts('org-1');

    expect(alerts).toHaveLength(1);
    expect(alerts[0].type).toBe('pool.exhausted');
    expect(alerts[0].severity).toBe('critical');
    expect(alerts[0].title).toBe('Pool Exhausted');
  });
});

describe('live messaging flow: provider factory', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.MESSAGING_PROVIDER;
    delete process.env.OPENPHONE_API_KEY;
    delete process.env.OPENPHONE_NUMBER_ID;
  });

  it('MockProvider.sendMessage throws descriptive error, not silent success', async () => {
    const { getMessagingProvider } = await import('../provider-factory');
    const provider = await getMessagingProvider('org-test');

    await expect(
      provider.sendMessage({ to: '+15551234567', body: 'test' })
    ).rejects.toThrow('No messaging provider configured');
  });

  it('MockProvider.updateSessionParticipants returns failure', async () => {
    const { getMessagingProvider } = await import('../provider-factory');
    const provider = await getMessagingProvider('org-test');

    const result = await provider.updateSessionParticipants({
      sessionSid: 's',
      clientParticipantSid: 'c',
      sitterParticipantSids: [],
    });
    expect(result.success).toBe(false);
    expect(result.error).toBeTruthy();
  });
});
