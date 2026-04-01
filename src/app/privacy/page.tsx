import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Privacy Policy - Snout Pet Care',
  description: 'How Snout Pet Care collects, uses, and protects your personal information.',
};

export default function PrivacyPolicyPage() {
  return (
    <main style={{ maxWidth: 720, margin: '0 auto', padding: '40px 20px', fontFamily: 'var(--font-inter), system-ui, sans-serif', color: '#432f21', lineHeight: 1.7 }}>
      <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 8 }}>Privacy Policy</h1>
      <p style={{ fontSize: 14, color: '#8c7769', marginBottom: 32 }}>Last updated: March 17, 2026</p>

      <section style={{ marginBottom: 28 }}>
        <h2 style={{ fontSize: 20, fontWeight: 600, marginBottom: 8 }}>What We Collect</h2>
        <p>When you use Snout Pet Care, we collect the following information:</p>
        <ul style={{ paddingLeft: 20, marginTop: 8 }}>
          <li><strong>Contact information:</strong> name, email address, phone number, and service address.</li>
          <li><strong>Pet information:</strong> pet names, species, breed, special care instructions.</li>
          <li><strong>Booking details:</strong> service type, dates, times, preferences, and notes.</li>
          <li><strong>Payment information:</strong> processed securely through Stripe. We do not store your full card number.</li>
          <li><strong>Account credentials:</strong> email and a hashed password if you create an account.</li>
        </ul>
      </section>

      <section style={{ marginBottom: 28 }}>
        <h2 style={{ fontSize: 20, fontWeight: 600, marginBottom: 8 }}>How We Use Your Information</h2>
        <ul style={{ paddingLeft: 20 }}>
          <li>Managing and fulfilling your pet care bookings.</li>
          <li>Sending booking confirmations, reminders, and updates via SMS and email.</li>
          <li>Processing payments and issuing invoices.</li>
          <li>Coordinating between you and your assigned pet care sitter.</li>
          <li>Improving our services and communicating about changes.</li>
        </ul>
      </section>

      <section style={{ marginBottom: 28 }}>
        <h2 style={{ fontSize: 20, fontWeight: 600, marginBottom: 8 }}>SMS Communications</h2>
        <p>
          When you consent on our booking form, we may send you SMS text messages regarding your bookings,
          including confirmations, reminders, schedule changes, and sitter updates.
        </p>
        <ul style={{ paddingLeft: 20, marginTop: 8 }}>
          <li><strong>Frequency:</strong> Message frequency varies based on your bookings, typically 2-10 messages per month.</li>
          <li><strong>Opt out:</strong> Reply <strong>STOP</strong> to any message to unsubscribe at any time.</li>
          <li><strong>Help:</strong> Reply <strong>HELP</strong> for assistance.</li>
          <li><strong>Rates:</strong> Message and data rates may apply depending on your carrier.</li>
        </ul>
      </section>

      <section style={{ marginBottom: 28 }}>
        <h2 style={{ fontSize: 20, fontWeight: 600, marginBottom: 8 }}>Third-Party Services</h2>
        <p>We use the following services to operate Snout Pet Care:</p>
        <ul style={{ paddingLeft: 20, marginTop: 8 }}>
          <li><strong>Twilio</strong> for sending and receiving SMS messages.</li>
          <li><strong>Stripe</strong> for payment processing.</li>
          <li><strong>Google Calendar</strong> for scheduling (when connected by sitters).</li>
          <li><strong>Sentry</strong> for error monitoring (no personal data is intentionally sent).</li>
        </ul>
        <p style={{ marginTop: 8 }}>We do not sell your personal information to third parties.</p>
      </section>

      <section style={{ marginBottom: 28 }}>
        <h2 style={{ fontSize: 20, fontWeight: 600, marginBottom: 8 }}>Data Retention</h2>
        <p>
          We retain your personal information for as long as your account is active or as needed to provide services.
          Booking records are kept for up to 3 years for business and tax purposes.
          You may request deletion of your data at any time.
        </p>
      </section>

      <section style={{ marginBottom: 28 }}>
        <h2 style={{ fontSize: 20, fontWeight: 600, marginBottom: 8 }}>Your Rights</h2>
        <ul style={{ paddingLeft: 20 }}>
          <li><strong>Access:</strong> You can view your data in the client portal at any time.</li>
          <li><strong>Correction:</strong> You can update your contact information and pet details in the client portal.</li>
          <li><strong>Deletion:</strong> Contact us to request deletion of your account and associated data.</li>
          <li><strong>Opt out of SMS:</strong> Reply STOP to any text message, or contact us directly.</li>
        </ul>
      </section>

      <section style={{ marginBottom: 28 }}>
        <h2 style={{ fontSize: 20, fontWeight: 600, marginBottom: 8 }}>Security</h2>
        <p>
          We use industry-standard measures to protect your data, including encrypted connections (HTTPS),
          hashed passwords, and secure payment processing through Stripe. Access to customer data is limited
          to authorized personnel.
        </p>
      </section>

      <section style={{ marginBottom: 28 }}>
        <h2 style={{ fontSize: 20, fontWeight: 600, marginBottom: 8 }}>Contact Us</h2>
        <p>
          If you have questions about this privacy policy or your data, contact us at{' '}
          <a href="https://snoutservices.com" style={{ color: '#432f21', textDecoration: 'underline' }}>snoutservices.com</a>.
        </p>
      </section>
    </main>
  );
}
