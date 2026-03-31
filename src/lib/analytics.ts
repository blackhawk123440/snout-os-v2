'use client';

/**
 * Client-side analytics helper for GA4 custom events.
 * Gracefully no-ops if gtag is not loaded.
 */

export function trackEvent(eventName: string, params?: Record<string, string | number>) {
  if (typeof window !== 'undefined' && (window as any).gtag) {
    (window as any).gtag('event', eventName, params);
  }
}

export const analytics = {
  bookingFormViewed: () => trackEvent('booking_form_viewed'),
  bookingFormStarted: () => trackEvent('booking_form_started'),
  bookingFormSubmitted: (service: string, value: number) =>
    trackEvent('booking_submitted', { service, value }),
  paymentLinkClicked: (amount: number) =>
    trackEvent('payment_link_clicked', { value: amount }),
  paymentCompleted: (amount: number) =>
    trackEvent('payment_completed', { value: amount, currency: 'USD' }),
  clientSignedUp: () => trackEvent('client_signup'),
  petProfileCreated: () => trackEvent('pet_profile_created'),
  visitReportViewed: () => trackEvent('visit_report_viewed'),
  visitRated: (rating: number) => trackEvent('visit_rated', { rating }),
  referralCodeShared: () => trackEvent('referral_shared'),
  referralCodeUsed: () => trackEvent('referral_used'),
};
