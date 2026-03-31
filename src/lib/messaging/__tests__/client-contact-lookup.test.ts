import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createClientContact, findClientContactByPhone, getClientE164ForClient } from '../client-contact-lookup';

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    $queryRawUnsafe: vi.fn(),
    $executeRawUnsafe: vi.fn(),
    client: {
      findFirst: vi.fn(),
    },
  },
}));

vi.mock('@/lib/db', () => ({
  prisma: prismaMock,
}));

describe('client-contact lookup fallbacks', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns null when ClientContact table is missing', async () => {
    prismaMock.$queryRawUnsafe.mockRejectedValueOnce(
      new Error('Raw query failed. Code: `42P01`. Message: relation "ClientContact" does not exist')
    );
    const result = await findClientContactByPhone('default', '+15550001111');
    expect(result).toBeNull();
  });

  it('falls back to client.phone when contact table is missing', async () => {
    prismaMock.$queryRawUnsafe.mockRejectedValueOnce(
      new Error('Raw query failed. Code: `42P01`. Message: relation "ClientContact" does not exist')
    );
    prismaMock.client.findFirst.mockResolvedValueOnce({ phone: '+15550002222' });
    const result = await getClientE164ForClient('default', 'client-1');
    expect(result).toBe('+15550002222');
  });

  it('no-ops createClientContact when table is missing', async () => {
    prismaMock.$executeRawUnsafe.mockRejectedValueOnce(
      new Error('Raw query failed. Code: `42P01`. Message: relation "ClientContact" does not exist')
    );
    await expect(
      createClientContact({
        id: 'contact-1',
        orgId: 'default',
        clientId: 'client-1',
        e164: '+15550003333',
      })
    ).resolves.toBeUndefined();
  });
});

