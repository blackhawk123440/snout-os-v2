/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { trackEvent, analytics } from '@/lib/analytics';

describe('Analytics module', () => {
  beforeEach(() => {
    (window as any).gtag = vi.fn();
  });

  it('trackEvent calls gtag with event name', () => {
    trackEvent('test_event');
    expect((window as any).gtag).toHaveBeenCalledWith('event', 'test_event', undefined);
  });

  it('trackEvent passes params to gtag', () => {
    trackEvent('test_event', { key: 'value', num: 42 });
    expect((window as any).gtag).toHaveBeenCalledWith('event', 'test_event', { key: 'value', num: 42 });
  });

  it('trackEvent does not throw when gtag is missing', () => {
    delete (window as any).gtag;
    expect(() => trackEvent('test_event')).not.toThrow();
  });

  it('analytics.bookingFormSubmitted sends correct event', () => {
    analytics.bookingFormSubmitted('Dog Walking', 45);
    expect((window as any).gtag).toHaveBeenCalledWith('event', 'booking_submitted', {
      service: 'Dog Walking',
      value: 45,
    });
  });

  it('analytics.paymentCompleted sends correct event', () => {
    analytics.paymentCompleted(150);
    expect((window as any).gtag).toHaveBeenCalledWith('event', 'payment_completed', {
      value: 150,
      currency: 'USD',
    });
  });

  it('analytics.visitRated sends rating', () => {
    analytics.visitRated(5);
    expect((window as any).gtag).toHaveBeenCalledWith('event', 'visit_rated', { rating: 5 });
  });
});
