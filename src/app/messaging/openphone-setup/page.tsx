import { redirect } from 'next/navigation';

export default function OpenPhoneSetupPage() {
  redirect('/settings?section=openphone');
}
