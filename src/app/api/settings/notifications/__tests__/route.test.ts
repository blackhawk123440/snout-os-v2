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
    orgNotificationSettings: {
      findUnique: mockFindUnique,
      upsert: mockUpsert,
    },
  })),
}));

import { GET, PATCH } from '@/app/api/settings/notifications/route';
import { getRequestContext } from '@/lib/request-context';

describe('api/settings/notifications', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (getRequestContext as any).mockResolvedValue({
      orgId: 'org-notif-1',
      role: 'owner',
      userId: 'u1',
      sitterId: null,
      clientId: null,
    });
    mockFindUnique.mockResolvedValue(null);
    mockUpsert.mockResolvedValue({
      orgId: 'org-notif-1',
      smsEnabled: true,
      emailEnabled: false,
      ownerAlerts: true,
      sitterNotifications: true,
      clientReminders: true,
      paymentReminders: true,
      conflictNoticeEnabled: true,
      reminderTiming: '24h',
      preferences: null,
    });
  });

  it('GET returns settings for owner (org-scoped)', async () => {
    mockFindUnique.mockResolvedValue({
      smsEnabled: true,
      emailEnabled: true,
      ownerAlerts: false,
      sitterNotifications: true,
      clientReminders: true,
      paymentReminders: false,
      conflictNoticeEnabled: true,
      reminderTiming: '2h',
      preferences: null,
    });
    const res = await GET();
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.settings.smsEnabled).toBe(true);
    expect(body.settings.emailEnabled).toBe(true);
    expect(body.settings.ownerAlerts).toBe(false);
    expect(body.settings.reminderTiming).toBe('2h');
    expect(mockFindUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { orgId: 'org-notif-1' } })
    );
  });

  it('GET rejects sitter role', async () => {
    (getRequestContext as any).mockResolvedValue({
      orgId: 'org-notif-1',
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
      orgId: 'org-notif-1',
      smsEnabled: false,
      emailEnabled: true,
      ownerAlerts: true,
      sitterNotifications: false,
      clientReminders: true,
      paymentReminders: true,
      conflictNoticeEnabled: false,
      reminderTiming: '48h',
      preferences: null,
    });
    const res = await PATCH(
      new NextRequest('http://localhost/api/settings/notifications', {
        method: 'PATCH',
        body: JSON.stringify({
          smsEnabled: false,
          emailEnabled: true,
          sitterNotifications: false,
          conflictNoticeEnabled: false,
          reminderTiming: '48h',
        }),
        headers: { 'Content-Type': 'application/json' },
      })
    );
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.settings.smsEnabled).toBe(false);
    expect(body.settings.reminderTiming).toBe('48h');
    expect(mockUpsert).toHaveBeenCalledWith(
      expect.objectContaining({ where: { orgId: 'org-notif-1' } })
    );
  });

  it('admin can read and write', async () => {
    (getRequestContext as any).mockResolvedValue({
      orgId: 'org-notif-1',
      role: 'admin',
      userId: 'u-admin',
      sitterId: null,
      clientId: null,
    });
    mockFindUnique.mockResolvedValue({ smsEnabled: true, emailEnabled: false, ownerAlerts: true, sitterNotifications: true, clientReminders: true, paymentReminders: true, conflictNoticeEnabled: true, reminderTiming: '24h', preferences: null });
    const getRes = await GET();
    expect(getRes.status).toBe(200);
    const patchRes = await PATCH(
      new NextRequest('http://localhost/api/settings/notifications', {
        method: 'PATCH',
        body: JSON.stringify({ reminderTiming: '12h' }),
        headers: { 'Content-Type': 'application/json' },
      })
    );
    expect(patchRes.status).toBe(200);
  });
});
