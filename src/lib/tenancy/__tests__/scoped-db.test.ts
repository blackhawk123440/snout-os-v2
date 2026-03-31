/**
 * Scoped DB tests (Batch 7)
 * - getScopedDb throws when orgId missing
 * - Unscoped tenant query is impossible (scoped client always injects orgId)
 * - Missing orgId in ctx throws InvariantError 403
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { InvariantError } from '@/lib/invariant';
import { getScopedDb } from '../scoped-db';

vi.mock('@/lib/db', () => ({
  prisma: {
    messageThread: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      upsert: vi.fn(),
    },
  },
}));

import { prisma } from '@/lib/db';

describe('getScopedDb', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('throws InvariantError 403 when ctx.orgId is missing', async () => {
    expect(() => getScopedDb(null)).toThrow(InvariantError);
    expect(() => getScopedDb(undefined)).toThrow(InvariantError);
    expect(() => getScopedDb({ orgId: '' })).toThrow(InvariantError);

    try {
      getScopedDb(null);
    } catch (e) {
      expect(e).toBeInstanceOf(InvariantError);
      expect((e as InvariantError).code).toBe(403);
      expect((e as InvariantError).message).toContain('Organization context required');
    }
  });

  it('injects orgId into findMany where for tenant models', async () => {
    (prisma as any).messageThread.findMany.mockResolvedValue([]);
    const db = getScopedDb({ orgId: 'org-123' });
    await db.messageThread.findMany({
      where: { status: 'active' },
    });

    expect((prisma as any).messageThread.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ orgId: 'org-123', status: 'active' }),
      })
    );
  });

  it('converts findUnique to findFirst with orgId for tenant models', async () => {
    (prisma as any).messageThread.findFirst.mockResolvedValue(null);
    const db = getScopedDb({ orgId: 'org-123' });
    await db.messageThread.findUnique({
      where: { id: 'thread-1' },
    });

    expect((prisma as any).messageThread.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: 'thread-1', orgId: 'org-123' }),
      })
    );
  });

  it('injects orgId into create data for tenant models', async () => {
    (prisma as any).messageThread.create.mockResolvedValue({ id: 't1', orgId: 'org-123' });
    const db = getScopedDb({ orgId: 'org-123' });
    await db.messageThread.create({
      data: { clientId: 'c1', messageNumberId: 'n1', threadType: 'front_desk' },
    });

    expect((prisma as any).messageThread.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ orgId: 'org-123', clientId: 'c1' }),
      })
    );
  });

  it('rejects create when data.orgId conflicts with ctx', () => {
    const db = getScopedDb({ orgId: 'org-123' });
    expect(() =>
      db.messageThread.create({
        data: { orgId: 'org-other', clientId: 'c1', messageNumberId: 'n1', threadType: 'front_desk' },
      })
    ).toThrow(InvariantError);
  });
});
