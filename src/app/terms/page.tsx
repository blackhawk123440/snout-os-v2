import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Terms of Service - Snout Pet Care',
  description: 'Terms and conditions for using Snout Pet Care services.',
};

export default function TermsOfServicePage() {
  return (
    <main style={{ maxWidth: 720, margin: '0 auto', padding: '40px 20px', fontFamily: 'var(--font-inter), system-ui, sans-serif', color: '#432f21', lineHeight: 1.7 }}>
      <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 8 }}>Terms of Service</h1>
      <p style={{ fontSize: 14, color: '#8c7769', marginBottom: 32 }}>Last updated: March 17, 2026</p>

      <section style={{ marginBottom: 28 }}>
        <h2 style={{ fontSize: 20, fontWeight: 600, marginBottom: 8 }}>1. Service Description</h2>
        <p>
          Snout Pet Care provides pet care management services including dog walking, pet sitting, drop-in visits,
          house sitting, and pet taxi services. Services are performed by independent pet care professionals
          (&ldquo;Sitters&rdquo;) coordinated through our platform.
        </p>
      </section>

      <section style={{ marginBottom: 28 }}>
        <h2 style={{ fontSize: 20, fontWeight: 600, marginBottom: 8 }}>2. User Responsibilities</h2>
        <ul style={{ paddingLeft: 20 }}>
          <li>Provide accurate contact information and pet details when booking.</li>
          <li>Ensure your pets are up to date on vaccinations and disclose any behavioral or health concerns.</li>
          <li>Provide safe access to your home for in-home services (keys, codes, parking instructions).</li>
          <li>Be available by phone or text during scheduled services in case of emergencies.</li>
        </ul>
      </section>

      <section style={{ marginBottom: 28 }}>
        <h2 style={{ fontSize: 20, fontWeight: 600, marginBottom: 8 }}>3. Booking and Payment</h2>
        <ul style={{ paddingLeft: 20 }}>
          <li>Bookings are confirmed once accepted by Snout Pet Care. You will receive a confirmation via SMS or email.</li>
          <li>Payment is due according to the terms communicated at booking or on your invoice.</li>
          <li>Payments are processed securely through Stripe.</li>
          <li>Pricing is based on the service type, duration, number of pets, and applicable surcharges (after-hours, holidays).</li>
        </ul>
      </section>

      <section style={{ marginBottom: 28 }}>
        <h2 style={{ fontSize: 20, fontWeight: 600, marginBottom: 8 }}>4. Cancellation Policy</h2>
        <p>
          Cancellation terms may vary by service. Generally, cancellations made with at least 24 hours notice
          will not incur a fee. Late cancellations or no-shows may be subject to a cancellation fee.
          Specific cancellation policies will be communicated at the time of booking.
        </p>
      </section>

      <section style={{ marginBottom: 28 }}>
        <h2 style={{ fontSize: 20, fontWeight: 600, marginBottom: 8 }}>5. Independent Contractor Relationship</h2>
        <p>
          Sitters are independent contractors, not employees of Snout Pet Care. While we vet and coordinate
          our sitters, each sitter operates independently and is responsible for their own performance of services.
        </p>
      </section>

      <section style={{ marginBottom: 28 }}>
        <h2 style={{ fontSize: 20, fontWeight: 600, marginBottom: 8 }}>6. Liability</h2>
        <p>
          While we take every reasonable precaution to ensure the safety and well-being of your pets,
          Snout Pet Care&apos;s liability is limited to the cost of the services provided. We are not liable for
          pre-existing medical conditions, injuries resulting from a pet&apos;s own behavior, or circumstances
          beyond our reasonable control.
        </p>
        <p style={{ marginTop: 8 }}>
          We recommend that pet owners maintain pet insurance and inform us of any known health or behavioral issues.
        </p>
      </section>

      <section style={{ marginBottom: 28 }}>
        <h2 style={{ fontSize: 20, fontWeight: 600, marginBottom: 8 }}>7. SMS Communications</h2>
        <p>
          By consenting to SMS on our booking form, you agree to receive text messages related to your bookings
          and pet care. You can opt out at any time by replying STOP. See our{' '}
          <a href="/privacy" style={{ color: '#432f21', textDecoration: 'underline' }}>Privacy Policy</a> for details.
        </p>
      </section>

      <section style={{ marginBottom: 28 }}>
        <h2 style={{ fontSize: 20, fontWeight: 600, marginBottom: 8 }}>8. Dispute Resolution</h2>
        <p>
          If you have a concern about our services, please contact us directly. We are committed to resolving
          issues promptly and fairly. Any disputes that cannot be resolved informally will be subject to
          binding arbitration in accordance with applicable law.
        </p>
      </section>

      <section style={{ marginBottom: 28 }}>
        <h2 style={{ fontSize: 20, fontWeight: 600, marginBottom: 8 }}>9. Modifications</h2>
        <p>
          We may update these terms from time to time. Material changes will be communicated via email
          or through our platform. Continued use of our services after changes constitutes acceptance
          of the updated terms.
        </p>
      </section>

      <section style={{ marginBottom: 28 }}>
        <h2 style={{ fontSize: 20, fontWeight: 600, marginBottom: 8 }}>Contact Us</h2>
        <p>
          Questions about these terms? Contact us at{' '}
          <a href="https://snoutservices.com" style={{ color: '#432f21', textDecoration: 'underline' }}>snoutservices.com</a>.
        </p>
      </section>
    </main>
  );
}
