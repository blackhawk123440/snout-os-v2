/**
 * SaaS Readiness Audit — Tenant Isolation Tests
 *
 * PROVES that getScopedDb prevents cross-org data access.
 * These tests verify the mechanical enforcement layer — not the DB,
 * but the proxy that wraps every query with orgId.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock prisma with tracking of all queries
const queryLog: Array<{ model: string; op: string; args: unknown }> = [];
const mockResult = { id: 'test-1', orgId: 'org-a' };

const createModelProxy = (modelName: string) => {
  return new Proxy({}, {
    get(_target, prop) {
      return (...args: unknown[]) => {
        queryLog.push({ model: modelName, op: prop as string, args: args[0] });
        if (prop === 'findMany') return Promise.resolve([]);
        if (prop === 'findFirst' || prop === 'findUnique') return Promise.resolve(null);
        if (prop === 'count') return Promise.resolve(0);
        if (prop === 'create') return Promise.resolve(mockResult);
        if (prop === 'update') return Promise.resolve(mockResult);
        if (prop === 'delete') return Promise.resolve(mockResult);
        if (prop === 'upsert') return Promise.resolve(mockResult);
        return Promise.resolve(null);
      };
    },
  });
};

vi.mock('@/lib/db', () => ({
  prisma: new Proxy({}, {
    get(_target, prop) {
      if (prop === '$transaction') return (fn: any) => fn(new Proxy({}, { get: (_t, p) => createModelProxy(p as string) }));
      return createModelProxy(prop as string);
    },
  }),
}));

import { getScopedDb } from '@/lib/tenancy';

describe('Tenant Isolation Audit', () => {
  beforeEach(() => {
    queryLog.length = 0;
  });

  describe('Test 1: getScopedDb requires orgId', () => {
    it('throws when orgId is empty', () => {
      expect(() => getScopedDb({ orgId: '' })).toThrow();
    });

    it('throws when context is null', () => {
      expect(() => getScopedDb(null as any)).toThrow();
    });

    it('throws when context is undefined', () => {
      expect(() => getScopedDb(undefined as any)).toThrow();
    });
  });

  describe('Test 2: Read queries always include orgId in WHERE', () => {
    it('findMany injects orgId into WHERE clause', async () => {
      const db = getScopedDb({ orgId: 'org-a' });
      await db.booking.findMany({ where: { status: 'confirmed' } });

      const query = queryLog.find(q => q.model === 'booking' && q.op === 'findMany');
      expect(query).toBeDefined();
      expect((query!.args as any).where.orgId).toBe('org-a');
    });

    it('findFirst injects orgId into WHERE clause', async () => {
      const db = getScopedDb({ orgId: 'org-b' });
      await db.booking.findFirst({ where: { id: 'booking-1' } });

      const query = queryLog.find(q => q.model === 'booking' && q.op === 'findFirst');
      expect(query).toBeDefined();
      expect((query!.args as any).where.orgId).toBe('org-b');
    });

    it('count injects orgId into WHERE clause', async () => {
      const db = getScopedDb({ orgId: 'org-c' });
      await db.booking.count({ where: { status: 'pending' } });

      const query = queryLog.find(q => q.model === 'booking' && q.op === 'count');
      expect(query).toBeDefined();
      expect((query!.args as any).where.orgId).toBe('org-c');
    });
  });

  describe('Test 3: Write queries always include orgId', () => {
    it('create injects orgId into data', async () => {
      const db = getScopedDb({ orgId: 'org-a' });
      await db.booking.create({ data: { service: 'Dog Walking' } as any });

      const query = queryLog.find(q => q.model === 'booking' && q.op === 'create');
      expect(query).toBeDefined();
      expect((query!.args as any).data.orgId).toBe('org-a');
    });

    it('update injects orgId into WHERE clause', async () => {
      const db = getScopedDb({ orgId: 'org-a' });
      await db.booking.update({ where: { id: 'b-1' }, data: { status: 'confirmed' } } as any);

      const query = queryLog.find(q => q.model === 'booking' && q.op === 'update');
      expect(query).toBeDefined();
      expect((query!.args as any).where.orgId).toBe('org-a');
    });
  });

  describe('Test 4: Cross-org orgId mismatch is rejected', () => {
    it('throws when WHERE orgId does not match context orgId', () => {
      const db = getScopedDb({ orgId: 'org-a' });

      expect(() =>
        db.booking.findMany({ where: { orgId: 'org-b', status: 'confirmed' } })
      ).toThrow(/orgId in where clause must match/i);
    });

    it('throws when CREATE data orgId does not match context orgId', () => {
      const db = getScopedDb({ orgId: 'org-a' });

      expect(() =>
        db.booking.create({ data: { orgId: 'org-b', service: 'Walk' } as any })
      ).toThrow(/orgId in create data must match/i);
    });
  });

  describe('Test 5: All tenant models are scoped', () => {
    it('booking queries are scoped', async () => {
      const db = getScopedDb({ orgId: 'org-test' });
      await db.booking.findMany({});
      expect((queryLog[0].args as any).where.orgId).toBe('org-test');
    });

    it('client queries are scoped', async () => {
      const db = getScopedDb({ orgId: 'org-test' });
      queryLog.length = 0;
      await db.client.findMany({});
      expect((queryLog[0].args as any).where.orgId).toBe('org-test');
    });

    it('sitter queries are scoped', async () => {
      const db = getScopedDb({ orgId: 'org-test' });
      queryLog.length = 0;
      await db.sitter.findMany({});
      expect((queryLog[0].args as any).where.orgId).toBe('org-test');
    });

    it('messageThread queries are scoped', async () => {
      const db = getScopedDb({ orgId: 'org-test' });
      queryLog.length = 0;
      await db.messageThread.findMany({});
      expect((queryLog[0].args as any).where.orgId).toBe('org-test');
    });

    it('ledgerEntry queries are scoped', async () => {
      const db = getScopedDb({ orgId: 'org-test' });
      queryLog.length = 0;
      await db.ledgerEntry.findMany({});
      expect((queryLog[0].args as any).where.orgId).toBe('org-test');
    });
  });
});
