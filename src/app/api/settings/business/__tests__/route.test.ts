import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const { mockFindUnique, mockUpsert } = vi.hoisted(() => ({
  mockFindUnique: vi.fn(),
  mockUpsert: vi.fn(),
}));

vi.mock('@/lib/request-context', () => ({
  getRequestContext: vi.fn(),
}));

vi.mock('@/lib/tenancy', () => ({
  getScopedDb: vi.fn(() => ({
    businessSettings: {
      findUnique: mockFindUnique,
      upsert: mockUpsert,
    },
  })),
}));

import { GET, PATCH } from '@/app/api/settings/business/route';
import { getRequestContext } from '@/lib/request-context';

describe('api/settings/business', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (getRequestContext as any).mockResolvedValue({
      orgId: 'org-settings-1',
      role: 'owner',
      userId: 'u1',
      sitterId: null,
      clientId: null,
    });
    mockFindUnique.mockResolvedValue(null);
    mockUpsert.mockResolvedValue({
      orgId: 'org-settings-1',
      businessName: 'Acme',
      businessPhone: null,
      businessEmail: null,
      businessAddress: null,
      timeZone: 'America/New_York',
    });
  });

  it('GET returns settings for owner (org-scoped)', async () => {
    mockFindUnique.mockResolvedValue({
      businessName: 'Acme Pet Care',
      businessPhone: '+15551234567',
      businessEmail: 'hello@acme.com',
      businessAddress: '123 Main St',
      timeZone: 'America/Los_Angeles',
      operatingHours: null,
      holidays: null,
      taxSettings: null,
      contentBlocks: null,
    });
    const res = await GET();
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.settings.businessName).toBe('Acme Pet Care');
    expect(body.settings.timeZone).toBe('America/Los_Angeles');
    expect(mockFindUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { orgId: 'org-settings-1' } })
    );
  });

  it('GET returns defaults when no row exists', async () => {
    mockFindUnique.mockResolvedValue(null);
    const res = await GET();
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.settings.businessName).toBe('');
    expect(body.settings.timeZone).toBe('America/New_York');
  });

  it('GET rejects sitter role', async () => {
    (getRequestContext as any).mockResolvedValue({
      orgId: 'org-settings-1',
      role: 'sitter',
      userId: 'u2',
      sitterId: 's1',
      clientId: null,
    });
    const res = await GET();
    const body = await res.json();
    expect(res.status).toBe(403);
    expect(body.error).toBe('Forbidden');
  });

  it('PATCH upserts with org scope', async () => {
    mockUpsert.mockResolvedValue({
      orgId: 'org-settings-1',
      businessName: 'Updated Name',
      businessPhone: '+15559999999',
      timeZone: 'America/Chicago',
    });
    const res = await PATCH(
      new NextRequest('http://localhost/api/settings/business', {
        method: 'PATCH',
        body: JSON.stringify({
          businessName: 'Updated Name',
          businessPhone: '+15559999999',
          timeZone: 'America/Chicago',
        }),
        headers: { 'Content-Type': 'application/json' },
      })
    );
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.settings.businessName).toBe('Updated Name');
    expect(mockUpsert).toHaveBeenCalledWith(
      expect.objectContaining({ where: { orgId: 'org-settings-1' } })
    );
  });

  it('PATCH rejects client role', async () => {
    (getRequestContext as any).mockResolvedValue({
      orgId: 'org-settings-1',
      role: 'client',
      userId: 'u3',
      sitterId: null,
      clientId: 'c1',
    });
    const res = await PATCH(
      new NextRequest('http://localhost/api/settings/business', {
        method: 'PATCH',
        body: JSON.stringify({ businessName: 'Hacked' }),
        headers: { 'Content-Type': 'application/json' },
      })
    );
    expect(res.status).toBe(403);
  });
});
