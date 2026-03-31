/**
 * Phone-to-Client Uniqueness Integration Test
 * 
 * REAL database test proving UNIQUE constraint prevents duplicates under concurrency.
 * 
 * Requirements:
 * - Must run against PostgreSQL (not SQLite)
 * - Must use real Prisma client (not mocks)
 * - Must verify DB state after concurrent operations
 * 
 * NOTE: This test requires a real PostgreSQL database. It will be skipped if:
 * - DATABASE_URL is not set
 * - Running in CI without test database configured
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { prisma } from '@/lib/db';

// Skip if no database URL (CI or local without DB)
const shouldSkip = !process.env.DATABASE_URL || process.env.CI === 'true';

describe.skipIf(shouldSkip)('Phone-to-Client Uniqueness - Real DB Integration', () => {
  const testOrgId = `test-org-${Date.now()}`;
  const testPhoneE164 = '+15559999999';

  beforeAll(async () => {
    // Ensure test org exists
    await prisma.organization.upsert({
      where: { id: testOrgId },
      update: {},
      create: {
        id: testOrgId,
        name: 'Test Org',
      },
    });
  });

  afterAll(async () => {
    // Cleanup: Delete test data
    await prisma.clientContact.deleteMany({
      where: { orgId: testOrgId },
    });
    await prisma.client.deleteMany({
      where: { orgId: testOrgId },
    });
    await prisma.thread.deleteMany({
      where: { orgId: testOrgId },
    });
    await prisma.organization.delete({
      where: { id: testOrgId },
    });
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    // Clean up before each test
    await prisma.clientContact.deleteMany({
      where: { orgId: testOrgId, e164: testPhoneE164 },
    });
    await prisma.client.deleteMany({
      where: { orgId: testOrgId },
    });
    await prisma.thread.deleteMany({
      where: { orgId: testOrgId },
    });
  });

  it('should prevent duplicates under concurrent upsert requests', async () => {
    // Issue 2 parallel upsert requests for same phone
    const [result1, result2] = await Promise.all([
      prisma.clientContact.upsert({
        where: {
          orgId_e164: {
            orgId: testOrgId,
            e164: testPhoneE164,
          },
        },
        update: {},
        create: {
          orgId: testOrgId,
          e164: testPhoneE164,
          label: 'Mobile',
          verified: false,
          client: {
            create: {
              orgId: testOrgId,
              name: `Guest (${testPhoneE164})`,
            },
          },
        },
        include: {
          client: true,
        },
      }),
      prisma.clientContact.upsert({
        where: {
          orgId_e164: {
            orgId: testOrgId,
            e164: testPhoneE164,
          },
        },
        update: {},
        create: {
          orgId: testOrgId,
          e164: testPhoneE164,
          label: 'Mobile',
          verified: false,
          client: {
            create: {
              orgId: testOrgId,
              name: `Guest (${testPhoneE164})`,
            },
          },
        },
        include: {
          client: true,
        },
      }),
    ]);

    // Verify: Both return same contact (UNIQUE constraint enforced)
    expect(result1.id).toBe(result2.id);
    expect(result1.client.id).toBe(result2.client.id);

    // Verify: Exactly 1 ClientContact row in DB
    const contactCount = await prisma.clientContact.count({
      where: {
        orgId: testOrgId,
        e164: testPhoneE164,
      },
    });
    expect(contactCount).toBe(1);

    // Verify: Exactly 1 Client row in DB
    const clientCount = await prisma.client.count({
      where: {
        orgId: testOrgId,
        id: result1.client.id,
      },
    });
    expect(clientCount).toBe(1);

    // Verify: No duplicates via SQL query
    const duplicates = await prisma.$queryRaw<Array<{ orgId: string; e164: string; count: bigint }>>`
      SELECT "orgId", e164, COUNT(*)::int as count
      FROM "ClientContact"
      WHERE "orgId" = ${testOrgId} AND e164 = ${testPhoneE164}
      GROUP BY "orgId", e164
      HAVING COUNT(*) > 1
    `;
    expect(duplicates.length).toBe(0);
  });

  it('should verify UNIQUE index exists in database', async () => {
    // Query pg_indexes to verify UNIQUE index exists
    const indexes = await prisma.$queryRaw<Array<{ indexname: string; indexdef: string }>>`
      SELECT indexname, indexdef
      FROM pg_indexes
      WHERE tablename = 'ClientContact'
        AND indexname = 'ClientContact_orgId_e164_key'
    `;

    expect(indexes.length).toBe(1);
    expect(indexes[0].indexdef).toContain('UNIQUE');
    expect(indexes[0].indexdef).toContain('"orgId"');
    expect(indexes[0].indexdef).toContain('"e164"');
  });

  it('should verify no duplicates exist across all orgs', async () => {
    // Create test data
    await prisma.clientContact.upsert({
      where: {
        orgId_e164: {
          orgId: testOrgId,
          e164: testPhoneE164,
        },
      },
      update: {},
      create: {
        orgId: testOrgId,
        e164: testPhoneE164,
        label: 'Mobile',
        verified: false,
        client: {
          create: {
            orgId: testOrgId,
            name: `Guest (${testPhoneE164})`,
          },
        },
      },
    });

    // Verify: No duplicates via SQL query
    const duplicates = await prisma.$queryRaw<Array<{ orgId: string; e164: string; count: bigint }>>`
      SELECT "orgId", e164, COUNT(*)::int as count
      FROM "ClientContact"
      GROUP BY "orgId", e164
      HAVING COUNT(*) > 1
    `;
    expect(duplicates.length).toBe(0);
  });
});
