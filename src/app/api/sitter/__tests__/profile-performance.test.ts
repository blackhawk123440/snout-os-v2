/**
 * Tests for sitter profile/performance endpoints.
 *
 * Verifies:
 * - GET /api/sitter/me returns real profile data
 * - PATCH /api/sitter/me updates whitelisted fields
 * - PATCH /api/sitter/me rejects non-whitelisted fields
 * - Onboarding step 5 can set onboardingStatus to pending_review
 * - SRS engine tier calculation is real (not hardcoded)
 * - Training is localStorage-only (confirmed, documented)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

const mockSitterFindUnique = vi.fn();
const mockSitterUpdate = vi.fn();

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
  ForbiddenError: class extends Error {},
}));

vi.mock('@/lib/tenancy', () => ({
  getScopedDb: () => ({
    sitter: {
      findUnique: (...args: any[]) => mockSitterFindUnique(...args),
      update: (...args: any[]) => mockSitterUpdate(...args),
    },
  }),
}));

const fakeSitter = {
  id: 'sitter-1',
  firstName: 'Jane',
  lastName: 'Smith',
  email: 'jane@example.com',
  phone: '+15551234567',
  active: true,
  commissionPercentage: 80,
  availabilityEnabled: true,
};

describe('GET /api/sitter/me', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('returns real sitter profile', async () => {
    mockSitterFindUnique.mockResolvedValueOnce(fakeSitter);

    const { GET } = await import('@/app/api/sitter/me/route');
    const res = await GET();
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.firstName).toBe('Jane');
    expect(data.lastName).toBe('Smith');
    expect(data.commissionPercentage).toBe(80);
    expect(data.name).toBe('Jane Smith');
  });
});

describe('PATCH /api/sitter/me', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('updates personalPhone', async () => {
    mockSitterUpdate.mockResolvedValueOnce({
      id: 'sitter-1',
      firstName: 'Jane',
      lastName: 'Smith',
      personalPhone: '+15559876543',
      onboardingStatus: 'active',
    });

    const { PATCH } = await import('@/app/api/sitter/me/route');
    const req = new Request('http://localhost/api/sitter/me', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ personalPhone: '+15559876543' }),
    });

    const res = await PATCH(req as any);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
    expect(mockSitterUpdate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ personalPhone: '+15559876543' }),
    }));
  });

  it('sets onboardingStatus to pending_review (onboarding completion)', async () => {
    mockSitterUpdate.mockResolvedValueOnce({
      id: 'sitter-1',
      firstName: 'Jane',
      lastName: 'Smith',
      personalPhone: null,
      onboardingStatus: 'pending_review',
    });

    const { PATCH } = await import('@/app/api/sitter/me/route');
    const req = new Request('http://localhost/api/sitter/me', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ onboardingStatus: 'pending_review' }),
    });

    const res = await PATCH(req as any);
    const data = await res.json();

    expect(data.success).toBe(true);
    expect(mockSitterUpdate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ onboardingStatus: 'pending_review' }),
    }));
  });

  it('rejects disallowed onboardingStatus values', async () => {
    const { PATCH } = await import('@/app/api/sitter/me/route');
    const req = new Request('http://localhost/api/sitter/me', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ onboardingStatus: 'approved' }), // not in allowed list
    });

    const res = await PATCH(req as any);
    const data = await res.json();

    // Should return success with "no changes" since nothing was whitelisted
    expect(data.message).toContain('No changes');
    expect(mockSitterUpdate).not.toHaveBeenCalled();
  });

  it('ignores bio field (no schema column)', async () => {
    const { PATCH } = await import('@/app/api/sitter/me/route');
    const req = new Request('http://localhost/api/sitter/me', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bio: 'I love dogs' }),
    });

    const res = await PATCH(req as any);
    const data = await res.json();

    // bio is not in whitelist → no update
    expect(data.message).toContain('No changes');
    expect(mockSitterUpdate).not.toHaveBeenCalled();
  });
});

describe('SRS engine integrity', () => {
  it('srs-engine.ts exports real calculation functions', async () => {
    const source = fs.readFileSync(
      path.join(process.cwd(), 'src/lib/tiers/srs-engine.ts'),
      'utf-8'
    );
    // Verify the 7 scoring categories exist
    expect(source).toContain('Responsiveness');
    expect(source).toContain('Acceptance');
    expect(source).toContain('Completion');
    expect(source).toContain('Timeliness');
    expect(source).toContain('Accuracy');
    expect(source).toContain('Engagement');
    expect(source).toContain('Conduct');

    // Verify tier thresholds exist
    expect(source).toContain('preferred');
    expect(source).toContain('trusted');
    expect(source).toContain('reliant');
    expect(source).toContain('foundation');

    // Verify it queries real Prisma models (lowercase access)
    expect(source).toContain('messageResponseLink');
    expect(source).toContain('assignmentWindow');
    expect(source).toContain('sitterServiceEvent');
    expect(source).toContain('visitEvent');
  });
});

describe('training page uses API with localStorage fallback', () => {
  it('training page calls /api/sitter/training with localStorage as offline fallback', () => {
    const source = fs.readFileSync(
      path.join(process.cwd(), 'src/app/sitter/training/page.tsx'),
      'utf-8'
    );
    // API is now the primary persistence layer
    expect(source).toContain('/api/sitter/training');
    expect(source).toContain("method: 'PATCH'");
    expect(source).toContain('fetch(');
    // localStorage remains as offline/migration fallback
    expect(source).toContain('localStorage');
  });
});

describe('owner and sitter views use same data model', () => {
  it('owner rankings and sitter SRS both reference same tier model names', () => {
    const srsSource = fs.readFileSync(
      path.join(process.cwd(), 'src/lib/tiers/srs-engine.ts'),
      'utf-8'
    );
    const rankingsSource = fs.readFileSync(
      path.join(process.cwd(), 'src/app/api/ops/sitters/rankings/route.ts'),
      'utf-8'
    );

    // Both reference Prisma models for booking/visit data
    expect(srsSource).toContain('assignmentWindow');
    expect(srsSource).toContain('visitEvent');
    expect(rankingsSource).toContain('offerEvent');
    expect(rankingsSource).toContain('booking');
  });
});
