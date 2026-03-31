import { redirect } from 'next/navigation';

export default function MessagingTwilioSetupPage() {
  redirect('/settings?section=twilio');
}
