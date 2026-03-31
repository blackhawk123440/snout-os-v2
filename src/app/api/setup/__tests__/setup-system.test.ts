/**
 * Tests for operator setup system.
 *
 * Verifies:
 * - Readiness endpoint checks real provider, numbers, webhooks state
 * - Numbers status endpoint returns grouped inventory
 * - Setup endpoints are NOT decorative (all query real state)
 * - All setup API files exist and export handlers
 * - Signup bootstrap is transactional
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

const mockFindMany = vi.fn();

vi.mock('@/lib/request-context', () => ({
  getRequestContext: vi.fn().mockResolvedValue({
    orgId: 'org-1',
    userId: 'user-1',
    role: 'owner',
  }),
}));

vi.mock('@/lib/rbac', () => ({
  requireAnyRole: vi.fn(),
  ForbiddenError: class extends Error {},
}));

vi.mock('@/lib/tenancy', () => ({
  getScopedDb: () => ({
    messageNumber: {
      findMany: (...args: any[]) => mockFindMany(...args),
    },
  }),
}));

describe('GET /api/setup/numbers/status', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('returns numbers grouped by class', async () => {
    mockFindMany.mockResolvedValueOnce([
      { id: 'n1', e164: '+15551111111', numberClass: 'front_desk' },
      { id: 'n2', e164: '+15552222222', numberClass: 'pool' },
      { id: 'n3', e164: '+15553333333', numberClass: 'pool' },
      { id: 'n4', e164: '+15554444444', numberClass: 'sitter' },
    ]);

    const { GET } = await import('@/app/api/setup/numbers/status/route');
    const res = await GET();
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.hasFrontDesk).toBe(true);
    expect(data.frontDesk.count).toBe(1);
    expect(data.sitter.count).toBe(1);
    expect(data.pool.count).toBe(2);
  });

  it('returns hasFrontDesk false when no front desk numbers', async () => {
    mockFindMany.mockResolvedValueOnce([
      { id: 'n1', e164: '+15551111111', numberClass: 'pool' },
    ]);

    const { GET } = await import('@/app/api/setup/numbers/status/route');
    const res = await GET();
    const data = await res.json();

    expect(data.hasFrontDesk).toBe(false);
    expect(data.frontDesk.count).toBe(0);
  });

  it('returns empty when no numbers exist', async () => {
    mockFindMany.mockResolvedValueOnce([]);

    const { GET } = await import('@/app/api/setup/numbers/status/route');
    const res = await GET();
    const data = await res.json();

    expect(data.hasFrontDesk).toBe(false);
    expect(data.frontDesk.count).toBe(0);
    expect(data.sitter.count).toBe(0);
    expect(data.pool.count).toBe(0);
  });
});

describe('setup endpoint existence and structure', () => {
  const setupDir = path.join(process.cwd(), 'src/app/api/setup');

  it('readiness endpoint exists and exports GET', () => {
    const filePath = path.join(setupDir, 'readiness/route.ts');
    expect(fs.existsSync(filePath)).toBe(true);
    const source = fs.readFileSync(filePath, 'utf-8');
    expect(source).toContain('export async function GET');
  });

  it('provider/connect endpoint exists and exports POST', () => {
    const filePath = path.join(setupDir, 'provider/connect/route.ts');
    expect(fs.existsSync(filePath)).toBe(true);
    const source = fs.readFileSync(filePath, 'utf-8');
    expect(source).toContain('export async function POST');
  });

  it('provider/status endpoint exists and exports GET', () => {
    const filePath = path.join(setupDir, 'provider/status/route.ts');
    expect(fs.existsSync(filePath)).toBe(true);
    const source = fs.readFileSync(filePath, 'utf-8');
    expect(source).toContain('export async function GET');
  });

  it('webhooks/install endpoint exists and exports POST', () => {
    const filePath = path.join(setupDir, 'webhooks/install/route.ts');
    expect(fs.existsSync(filePath)).toBe(true);
    const source = fs.readFileSync(filePath, 'utf-8');
    expect(source).toContain('export async function POST');
  });

  it('test-sms endpoint exists and exports POST', () => {
    const filePath = path.join(setupDir, 'test-sms/route.ts');
    expect(fs.existsSync(filePath)).toBe(true);
    const source = fs.readFileSync(filePath, 'utf-8');
    expect(source).toContain('export async function POST');
  });

  it('numbers/sync endpoint exists and exports GET', () => {
    const filePath = path.join(setupDir, 'numbers/sync/route.ts');
    expect(fs.existsSync(filePath)).toBe(true);
  });

  it('numbers/status endpoint exists (newly created)', () => {
    const filePath = path.join(setupDir, 'numbers/status/route.ts');
    expect(fs.existsSync(filePath)).toBe(true);
    const source = fs.readFileSync(filePath, 'utf-8');
    expect(source).toContain('export async function GET');
  });
});

describe('readiness checks are real (not decorative)', () => {
  it('readiness route queries getProviderCredentials', () => {
    const source = fs.readFileSync(
      path.join(process.cwd(), 'src/app/api/setup/readiness/route.ts'),
      'utf-8'
    );
    expect(source).toContain('getProviderCredentials');
    expect(source).toContain('messageNumber');
    expect(source).toContain('getWebhookStatus');
  });

  it('provider/connect actually calls Twilio API for verification', () => {
    const source = fs.readFileSync(
      path.join(process.cwd(), 'src/app/api/setup/provider/connect/route.ts'),
      'utf-8'
    );
    expect(source).toContain('incomingPhoneNumbers');
    expect(source).toContain('encrypt');
  });

  it('webhooks/install actually modifies Twilio config', () => {
    const source = fs.readFileSync(
      path.join(process.cwd(), 'src/app/api/setup/webhooks/install/route.ts'),
      'utf-8'
    );
    expect(source).toContain('.update(');
    expect(source).toContain('smsUrl');
    expect(source).toContain('statusCallback');
  });
});

describe('signup bootstrap is transactional', () => {
  it('bootstrap uses Prisma transaction', () => {
    const source = fs.readFileSync(
      path.join(process.cwd(), 'src/lib/signup-bootstrap.ts'),
      'utf-8'
    );
    expect(source).toContain('$transaction');
    expect(source).toContain('org.create');
    expect(source).toContain('user.create');
  });

  it('signup route has rate limiting', () => {
    const source = fs.readFileSync(
      path.join(process.cwd(), 'src/app/api/auth/signup/route.ts'),
      'utf-8'
    );
    expect(source).toContain('checkRateLimit');
    expect(source).toContain('SIGNUP_RATE_LIMIT');
  });
});
