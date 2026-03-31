/**
 * Tests for sitter training persistence.
 *
 * Verifies:
 * - GET returns persisted completion state (not localStorage)
 * - PATCH updates a single module's completion status
 * - PATCH validates input
 * - Owner can view any sitter's training via /api/sitters/[id]/training
 * - Training page no longer uses localStorage as primary
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

const mockSettingFindFirst = vi.fn();
const mockSettingUpsert = vi.fn().mockResolvedValue({});

vi.mock('@/lib/request-context', () => ({
  getRequestContext: vi.fn().mockResolvedValue({
    orgId: 'org-1',
    userId: 'user-1',
    role: 'sitter',
    sitterId: 'sitter-1',
  }),
}));

vi.mock('@/lib/rbac', () => ({
  requireRole: vi.fn(),
  requireAnyRole: vi.fn(),
  ForbiddenError: class extends Error {},
}));

vi.mock('@/lib/tenancy', () => ({
  getScopedDb: () => ({
    setting: {
      findFirst: (...args: any[]) => mockSettingFindFirst(...args),
      upsert: (...args: any[]) => mockSettingUpsert(...args),
    },
  }),
}));

describe('GET /api/sitter/training', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('returns saved completion state from DB', async () => {
    mockSettingFindFirst.mockResolvedValueOnce({
      value: JSON.stringify({ company_policies: true, safety_procedures: true }),
    });

    const { GET } = await import('@/app/api/sitter/training/route');
    const res = await GET();
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.completed.company_policies).toBe(true);
    expect(data.completed.safety_procedures).toBe(true);
  });

  it('returns empty when no saved state', async () => {
    mockSettingFindFirst.mockResolvedValueOnce(null);

    const { GET } = await import('@/app/api/sitter/training/route');
    const res = await GET();
    const data = await res.json();

    expect(data.completed).toEqual({});
  });
});

describe('PATCH /api/sitter/training', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('updates a single module completion', async () => {
    mockSettingFindFirst.mockResolvedValueOnce({
      value: JSON.stringify({ company_policies: true }),
    });

    const { PATCH } = await import('@/app/api/sitter/training/route');
    const req = new Request('http://localhost/api/sitter/training', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ moduleId: 'safety_procedures', completed: true }),
    });

    const res = await PATCH(req as any);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.completed.company_policies).toBe(true);
    expect(data.completed.safety_procedures).toBe(true);

    // Verify upsert was called
    expect(mockSettingUpsert).toHaveBeenCalledTimes(1);
    const saved = JSON.parse(mockSettingUpsert.mock.calls[0][0].update.value);
    expect(saved.safety_procedures).toBe(true);
  });

  it('can toggle module off', async () => {
    mockSettingFindFirst.mockResolvedValueOnce({
      value: JSON.stringify({ company_policies: true }),
    });

    const { PATCH } = await import('@/app/api/sitter/training/route');
    const req = new Request('http://localhost/api/sitter/training', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ moduleId: 'company_policies', completed: false }),
    });

    const res = await PATCH(req as any);
    const data = await res.json();

    expect(data.completed.company_policies).toBe(false);
  });

  it('rejects missing moduleId', async () => {
    const { PATCH } = await import('@/app/api/sitter/training/route');
    const req = new Request('http://localhost/api/sitter/training', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ completed: true }),
    });

    const res = await PATCH(req as any);
    expect(res.status).toBe(400);
  });

  it('rejects non-boolean completed', async () => {
    const { PATCH } = await import('@/app/api/sitter/training/route');
    const req = new Request('http://localhost/api/sitter/training', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ moduleId: 'gps_checkin', completed: 'yes' }),
    });

    const res = await PATCH(req as any);
    expect(res.status).toBe(400);
  });
});

describe('owner training visibility', () => {
  it('owner endpoint returns completion with counts', async () => {
    mockSettingFindFirst.mockResolvedValueOnce({
      value: JSON.stringify({
        company_policies: true,
        safety_procedures: true,
        gps_checkin: true,
      }),
    });

    // Override context to owner for this test
    const { getRequestContext } = await import('@/lib/request-context');
    (getRequestContext as any).mockResolvedValueOnce({
      orgId: 'org-1',
      userId: 'owner-1',
      role: 'owner',
    });

    const { GET } = await import('@/app/api/sitters/[id]/training/route');
    const res = await GET(
      new Request('http://localhost') as any,
      { params: Promise.resolve({ id: 'sitter-1' }) }
    );
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.sitterId).toBe('sitter-1');
    expect(data.completedCount).toBe(3);
    expect(data.totalModules).toBe(8);
    expect(data.percentComplete).toBe(38);
  });
});

describe('training page uses API, not localStorage', () => {
  it('page source calls /api/sitter/training (not just localStorage)', () => {
    const source = fs.readFileSync(
      path.join(process.cwd(), 'src/app/sitter/training/page.tsx'),
      'utf-8'
    );
    expect(source).toContain('/api/sitter/training');
    expect(source).toContain("method: 'PATCH'");
    // localStorage should be a fallback, not the primary
    expect(source).toContain('localStorage'); // still there as fallback
    expect(source).toContain('fetch('); // API is primary
  });
});
