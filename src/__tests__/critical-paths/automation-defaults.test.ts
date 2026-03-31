import { describe, it, expect } from 'vitest';
import { getDefaultAutomationSettings, AUTOMATION_TYPE_IDS } from '@/lib/automations/types';

describe('Automation defaults', () => {
  it('all automations default to enabled', () => {
    const settings = getDefaultAutomationSettings();
    for (const id of AUTOMATION_TYPE_IDS) {
      expect(settings[id].enabled).toBe(true);
    }
  });

  it('has exactly 10 automation types', () => {
    expect(AUTOMATION_TYPE_IDS).toHaveLength(10);
  });

  it('booking confirmation sends to client by default', () => {
    const settings = getDefaultAutomationSettings();
    expect(settings.bookingConfirmation.sendToClient).toBe(true);
  });

  it('night before reminder sends to both client and sitter', () => {
    const settings = getDefaultAutomationSettings();
    expect(settings.nightBeforeReminder.sendToClient).toBe(true);
    expect(settings.nightBeforeReminder.sendToSitter).toBe(true);
  });

  it('sitter assignment notifies both sitter and owner', () => {
    const settings = getDefaultAutomationSettings();
    expect(settings.sitterAssignment.sendToSitter).toBe(true);
    expect(settings.sitterAssignment.sendToOwner).toBe(true);
  });

  it('checkin notification sends to client and owner', () => {
    const settings = getDefaultAutomationSettings();
    expect(settings.checkinNotification.sendToClient).toBe(true);
    expect(settings.checkinNotification.sendToOwner).toBe(true);
  });

  it('checkout notification sends to client and owner', () => {
    const settings = getDefaultAutomationSettings();
    expect(settings.checkoutNotification.sendToClient).toBe(true);
    expect(settings.checkoutNotification.sendToOwner).toBe(true);
  });

  it('booking cancellation sends to all parties', () => {
    const settings = getDefaultAutomationSettings();
    expect(settings.bookingCancellation.sendToClient).toBe(true);
    expect(settings.bookingCancellation.sendToSitter).toBe(true);
    expect(settings.bookingCancellation.sendToOwner).toBe(true);
  });

  it('visit report notification sends to client', () => {
    const settings = getDefaultAutomationSettings();
    expect(settings.visitReportNotification.sendToClient).toBe(true);
  });

  it('owner new booking alert uses personal phone type', () => {
    const settings = getDefaultAutomationSettings();
    expect(settings.ownerNewBookingAlert.ownerPhoneType).toBe('personal');
  });
});
