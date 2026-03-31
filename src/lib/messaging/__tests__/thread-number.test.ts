import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ensureThreadHasMessageNumber } from '../thread-number';

const mockDb = {
  messageThread: {
    findUnique: vi.fn(),
    update: vi.fn(),
  },
  messageNumber: {
    findFirst: vi.fn(),
  },
};

vi.mock('@/lib/tenancy', () => ({
  getScopedDb: vi.fn(() => mockDb),
}));

describe('ensureThreadHasMessageNumber', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('backfills missing messageNumberId from active front desk number', async () => {
    mockDb.messageThread.findUnique.mockResolvedValue({
      id: 'thread-1',
      messageNumberId: null,
      maskedNumberE164: null,
      numberClass: null,
      assignedSitterId: null,
    });
    mockDb.messageNumber.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        id: 'num-frontdesk',
        e164: '+15550001111',
        numberClass: 'front_desk',
      });

    await ensureThreadHasMessageNumber('org-1', 'thread-1');

    expect(mockDb.messageThread.update).toHaveBeenCalledWith({
      where: { id: 'thread-1' },
      data: {
        messageNumberId: 'num-frontdesk',
        maskedNumberE164: '+15550001111',
        numberClass: 'front_desk',
      },
    });
  });

  it('no-ops when no active number inventory exists', async () => {
    mockDb.messageThread.findUnique.mockResolvedValue({
      id: 'thread-2',
      messageNumberId: null,
      maskedNumberE164: null,
      numberClass: null,
      assignedSitterId: null,
    });
    mockDb.messageNumber.findFirst.mockResolvedValue(null);

    await ensureThreadHasMessageNumber('org-1', 'thread-2');
    expect(mockDb.messageThread.update).not.toHaveBeenCalled();
  });
});

