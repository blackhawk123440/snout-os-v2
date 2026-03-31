import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('Email infrastructure', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('sendEmail returns success in dev mode (no API key)', async () => {
    // No RESEND_API_KEY means dev fallback
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const { sendEmail } = await import('@/lib/email');

    const result = await sendEmail({
      to: 'test@example.com',
      subject: 'Test',
      html: '<p>Test</p>',
    });

    expect(result.success).toBe(true);
    expect(result.id).toBe('local-dev-skip');
    consoleSpy.mockRestore();
  });
});

describe('Email templates', () => {
  it('bookingConfirmationEmail produces correct subject and html', async () => {
    const { bookingConfirmationEmail } = await import('@/lib/email-templates');

    const result = bookingConfirmationEmail({
      clientName: 'Jane',
      service: 'Dog Walking',
      date: 'Mon, Mar 17',
      time: '9:00 AM',
    });

    expect(result.subject).toContain('Dog Walking');
    expect(result.subject).toContain('Mon, Mar 17');
    expect(result.html).toContain('Jane');
    expect(result.html).toContain('Dog Walking');
    expect(result.html).toContain('9:00 AM');
  });

  it('bookingConfirmationEmail includes payment link when provided', async () => {
    const { bookingConfirmationEmail } = await import('@/lib/email-templates');

    const result = bookingConfirmationEmail({
      clientName: 'Jane',
      service: 'Dog Walking',
      date: 'Mon, Mar 17',
      time: '9:00 AM',
      paymentLink: 'https://pay.stripe.com/xxx',
    });

    expect(result.html).toContain('https://pay.stripe.com/xxx');
    expect(result.html).toContain('Pay Now');
  });

  it('paymentReceiptEmail formats amount correctly', async () => {
    const { paymentReceiptEmail } = await import('@/lib/email-templates');

    const result = paymentReceiptEmail({
      clientName: 'Bob',
      amount: 45.5,
      service: 'Pet Sitting',
      date: 'Mar 17',
    });

    expect(result.subject).toContain('$45.50');
    expect(result.html).toContain('$45.50');
    expect(result.html).toContain('Bob');
  });

  it('visitReportEmail includes report link', async () => {
    const { visitReportEmail } = await import('@/lib/email-templates');

    const result = visitReportEmail({
      clientName: 'Alice',
      petName: 'Luna',
      sitterName: 'Sarah',
      reportUrl: 'https://app.snout.com/reports/123',
    });

    expect(result.subject).toContain('Luna');
    expect(result.subject).toContain('Sarah');
    expect(result.html).toContain('https://app.snout.com/reports/123');
    expect(result.html).toContain('View Report');
  });
});
