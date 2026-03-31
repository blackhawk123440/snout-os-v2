import { redirect } from 'next/navigation';

export default function MessagingNumbersPage() {
  redirect('/settings?section=numbers');
}
