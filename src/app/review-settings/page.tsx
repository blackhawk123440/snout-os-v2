import { redirect } from 'next/navigation';

export default function ReviewSettingsPage() {
  redirect('/settings?section=reviews');
}
