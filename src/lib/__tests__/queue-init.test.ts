/**
 * Tests for queue initialization resilience.
 *
 * Verifies:
 * - Individual worker failures don't crash the whole init
 * - workerHealth tracks success/failure per worker
 * - Healthy workers continue even when others fail
 * - All workers are attempted regardless of failures
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock all dynamic imports used by initializeQueues
vi.mock('@/lib/queue-observability', () => ({
  attachQueueWorkerInstrumentation: vi.fn(),
  recordQueueJobQueued: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/lib/correlation-id', () => ({
  resolveCorrelationId: vi.fn().mockReturnValue('test-corr'),
  normalizeCorrelationId: vi.fn().mockReturnValue('test-corr'),
}));

// Mock BullMQ — Queue and Worker are used as `new Queue(name, opts)`, need classes
vi.mock('bullmq', () => {
  return {
    Queue: class MockQueue {
      name: string;
      constructor(name: string) { this.name = name; }
      add = vi.fn().mockResolvedValue({ id: 'job-1' });
    },
    Worker: class MockWorker {
      constructor() {}
      on = vi.fn();
    },
  };
});

// Mock Redis — IORedis is used as `new IORedis(url)`, needs a class
vi.mock('ioredis', () => {
  return {
    default: class MockIORedis {
      constructor() {}
    },
  };
});

// Track which workers were initialized
const initCalls: string[] = [];

vi.mock('@/lib/reminder-scheduler-queue', () => ({
  scheduleReminderDispatcher: vi.fn().mockImplementation(async () => { initCalls.push('reminder-scheduler'); }),
  initializeReminderSchedulerWorker: vi.fn(),
  reminderSchedulerQueue: { name: 'reminder-scheduler' },
}));

vi.mock('@/lib/automation-queue', () => ({
  initializeAutomationWorker: vi.fn().mockImplementation(() => { initCalls.push('automations'); }),
  automationQueue: { name: 'automations' },
}));

vi.mock('@/lib/messaging/outbound-queue', () => ({
  initializeOutboundMessageWorker: vi.fn().mockImplementation(() => { initCalls.push('messaging-outbound'); }),
}));

vi.mock('@/lib/messaging/thread-activity-queue', () => ({
  initializeThreadActivityWorker: vi.fn().mockImplementation(() => { initCalls.push('messaging-thread-activity'); }),
}));

vi.mock('@/lib/calendar-queue', () => ({
  initializeCalendarWorker: vi.fn().mockImplementation(() => { initCalls.push('calendar-sync'); }),
  scheduleInboundCalendarSync: vi.fn().mockResolvedValue(undefined),
  calendarQueue: { name: 'calendar-sync' },
}));

vi.mock('@/lib/pool-release-queue', () => ({
  initializePoolReleaseWorker: vi.fn().mockImplementation(() => { initCalls.push('pool-release'); }),
  schedulePoolRelease: vi.fn().mockResolvedValue(undefined),
  poolReleaseQueue: { name: 'pool-release' },
}));

vi.mock('@/lib/payout/payout-queue', () => ({
  initializePayoutWorker: vi.fn().mockImplementation(() => { initCalls.push('payouts'); }),
  payoutQueue: { name: 'payouts' },
}));

vi.mock('@/lib/finance/reconcile-queue', () => ({
  initializeFinanceReconcileWorker: vi.fn().mockImplementation(() => { initCalls.push('finance-reconcile'); }),
  financeReconcileQueue: { name: 'finance-reconcile' },
}));

vi.mock('@/lib/tiers/srs-queue', () => ({
  srsQueue: { name: 'srs' },
}));

describe('initializeQueues', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    initCalls.length = 0;
  });

  it('initializes all workers and tracks health', async () => {
    const { initializeQueues, workerHealth } = await import('../queue');

    await initializeQueues();

    expect(workerHealth.initialized).toBe(true);
    expect(workerHealth.startedAt).toBeInstanceOf(Date);

    // All 10 workers should be tracked
    const workerNames = Object.keys(workerHealth.workers);
    expect(workerNames.length).toBe(10);

    // All should be 'ok'
    for (const [name, info] of Object.entries(workerHealth.workers)) {
      expect(info.status).toBe('ok');
    }
  });

  it('continues initializing other workers when one fails', async () => {
    // Make automations fail
    const autoMock = await import('@/lib/automation-queue');
    (autoMock.initializeAutomationWorker as any).mockImplementationOnce(() => {
      throw new Error('Automations import broken');
    });

    const { initializeQueues, workerHealth } = await import('../queue');
    // Reset health state
    workerHealth.initialized = false;
    workerHealth.workers = {};

    await initializeQueues();

    // Should still be initialized (not thrown)
    expect(workerHealth.initialized).toBe(true);

    // Automations should be failed
    expect(workerHealth.workers['automations']?.status).toBe('failed');
    expect(workerHealth.workers['automations']?.error).toContain('Automations import broken');

    // Other workers should still be ok
    expect(workerHealth.workers['payouts']?.status).toBe('ok');
    expect(workerHealth.workers['calendar-sync']?.status).toBe('ok');
  });

  it('does not throw even when multiple workers fail', async () => {
    const autoMock = await import('@/lib/automation-queue');
    const calMock = await import('@/lib/calendar-queue');
    (autoMock.initializeAutomationWorker as any).mockImplementationOnce(() => {
      throw new Error('auto fail');
    });
    (calMock.initializeCalendarWorker as any).mockImplementationOnce(() => {
      throw new Error('cal fail');
    });

    const { initializeQueues, workerHealth } = await import('../queue');
    workerHealth.initialized = false;
    workerHealth.workers = {};

    // Should not throw
    await initializeQueues();

    expect(workerHealth.initialized).toBe(true);
    expect(workerHealth.workers['automations']?.status).toBe('failed');
    expect(workerHealth.workers['calendar-sync']?.status).toBe('failed');
    // Others still ok
    expect(workerHealth.workers['payouts']?.status).toBe('ok');
  });
});
