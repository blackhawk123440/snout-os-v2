import { redirect } from 'next/navigation';

export default function DigestSettingsPage() {
  redirect('/settings?section=digest');
}
