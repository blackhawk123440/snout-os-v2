import { beforeEach, describe, expect, it, vi } from 'vitest';
import { upsertCanonicalMessageNumbersFromTwilio } from '../sync-inventory';

const db = {
  messageNumber: {
    findFirst: vi.fn(),
    update: vi.fn(),
    create: vi.fn(),
  },
};

describe('upsertCanonicalMessageNumbersFromTwilio', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates front_desk first and pool for remaining numbers', async () => {
    db.messageNumber.findFirst.mockResolvedValue(null);
    await upsertCanonicalMessageNumbersFromTwilio(db as any, 'default', [
      { sid: 'PN_FRONT', phoneNumber: '+15550001111' },
      { sid: 'PN_POOL', phoneNumber: '+15550002222' },
    ]);

    expect(db.messageNumber.create).toHaveBeenCalledTimes(2);
    expect(db.messageNumber.create).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        data: expect.objectContaining({
          orgId: 'default',
          numberClass: 'front_desk',
          provider: 'twilio',
          providerNumberSid: 'PN_FRONT',
        }),
      })
    );
    expect(db.messageNumber.create).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        data: expect.objectContaining({
          orgId: 'default',
          numberClass: 'pool',
          provider: 'twilio',
          providerNumberSid: 'PN_POOL',
        }),
      })
    );
  });
});

