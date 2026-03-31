/**
 * automation-utils: getAutomationSettings(orgId) and getMessageTemplate(..., orgId) read persisted data.
 * With no Setting row, defaults are returned (all disabled). With persisted row, merged settings returned.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

const mockFindUnique = vi.fn();
const mockUpsert = vi.fn();

vi.mock('@/lib/db', () => ({
  prisma: {
    setting: {
      findUnique: (...args: unknown[]) => mockFindUnique(...args),
      upsert: (...args: unknown[]) => mockUpsert(...args),
    },
  },
}));

import { getAutomationSettings, getMessageTemplate, isAutomationEnabled, shouldSendToRecipient } from '@/lib/automation-utils';
import { getDefaultAutomationSettings } from '@/lib/automations/types';

describe('automation-utils persistence', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('getAutomationSettings(orgId) returns defaults when no row', async () => {
    mockFindUnique.mockResolvedValue(null);

    const settings = await getAutomationSettings('org-1');

    expect(mockFindUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { orgId_key: { orgId: 'org-1', key: 'automation' } },
      })
    );
    const defaults = getDefaultAutomationSettings();
    expect(settings.bookingConfirmation.enabled).toBe(defaults.bookingConfirmation.enabled);
    expect(settings.ownerNewBookingAlert.enabled).toBe(defaults.ownerNewBookingAlert.enabled);
  });

  it('getAutomationSettings(orgId) returns merged settings when row exists', async () => {
    mockFindUnique.mockResolvedValue({
      value: JSON.stringify({
        bookingConfirmation: { enabled: true, sendToClient: true },
      }),
    });

    const settings = await getAutomationSettings('org-2');

    expect(settings.bookingConfirmation.enabled).toBe(true);
    expect(settings.bookingConfirmation.sendToClient).toBe(true);
    // nightBeforeReminder not in persisted data → falls back to default (enabled: true)
    expect(settings.nightBeforeReminder.enabled).toBe(true);
  });

  it('getMessageTemplate returns null when no template set', async () => {
    mockFindUnique.mockResolvedValue({
      value: JSON.stringify({ bookingConfirmation: {} }),
    });

    const template = await getMessageTemplate('bookingConfirmation', 'client', 'org-1');

    expect(template).toBeNull();
  });

  it('getMessageTemplate returns template when set', async () => {
    mockFindUnique.mockResolvedValue({
      value: JSON.stringify({
        bookingConfirmation: { messageTemplateClient: 'Hi {{firstName}}!' },
      }),
    });

    const template = await getMessageTemplate('bookingConfirmation', 'client', 'org-1');

    expect(template).toBe('Hi {{firstName}}!');
  });

  it('isAutomationEnabled(type, orgId) returns false when disabled', async () => {
    mockFindUnique.mockResolvedValue({
      value: JSON.stringify({ bookingConfirmation: { enabled: false } }),
    });

    const enabled = await isAutomationEnabled('bookingConfirmation', 'org-1');

    expect(enabled).toBe(false);
  });

  it('shouldSendToRecipient returns false when automation disabled', async () => {
    mockFindUnique.mockResolvedValue({
      value: JSON.stringify({ bookingConfirmation: { enabled: false, sendToClient: true } }),
    });

    const send = await shouldSendToRecipient('bookingConfirmation', 'client', 'org-1');

    expect(send).toBe(false);
  });

  it('shouldSendToRecipient returns true when enabled and sendToClient true', async () => {
    mockFindUnique.mockResolvedValue({
      value: JSON.stringify({ bookingConfirmation: { enabled: true, sendToClient: true } }),
    });

    const send = await shouldSendToRecipient('bookingConfirmation', 'client', 'org-1');

    expect(send).toBe(true);
  });
});
